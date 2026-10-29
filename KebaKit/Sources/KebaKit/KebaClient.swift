import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public enum KebaError: Error, LocalizedError, Equatable {
    case unauthorized
    /// Statt JSON kam eine HTML-Seite, meist ist der Fernzugriffstunnel abgelaufen.
    case sessionExpired
    case server(String)
    case http(status: Int, body: String)
    case invalidResponse(String)

    public var errorDescription: String? {
        switch self {
        case .unauthorized:
            "Benutzername oder Passwort falsch."
        case .sessionExpired:
            "Die Sitzung ist abgelaufen. Bitte neu verbinden."
        case .server(let message):
            "Der Regler meldet einen Fehler: \(message)"
        case .http(let status, _):
            "Unerwartete Antwort vom Regler (HTTP \(status))."
        case .invalidResponse(let detail):
            "Antwort konnte nicht gelesen werden: \(detail)"
        }
    }
}

/// Zugangsdaten zum Regler.
/// - Lokal: `http://<IP-des-Reglers>`, ggf. mit Basic-Auth.
/// - Fernzugriff: `https://remote.keba.com:<Port>` plus die Cookies der Secomea-Sitzung.
public struct KebaConnection: @unchecked Sendable {
    public var baseURL: URL
    public var cookies: [HTTPCookie]
    public var username: String?
    public var password: String?

    public init(baseURL: URL, cookies: [HTTPCookie] = [], username: String? = nil, password: String? = nil) {
        self.baseURL = baseURL
        self.cookies = cookies
        self.username = username
        self.password = password
    }
}

public protocol KebaTransport: Sendable {
    func read(_ names: [String], withAttributes: Bool) async throws -> [String: KebaVariable]
    func write(_ values: [KebaWrite]) async throws
}

/// Spricht dieselbe JSON-Schnittstelle an wie die WebHMI im Browser.
public final class KebaClient: KebaTransport, @unchecked Sendable {
    public let connection: KebaConnection
    public let languageCode: String
    private let session: URLSession
    /// Die HMI fragt maximal ~25 Variablen pro Request ab; wir bleiben in der Größenordnung.
    private let batchSize = 30

    public init(connection: KebaConnection, languageCode: String = "de") {
        self.connection = connection
        self.languageCode = languageCode

        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 15
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        if let storage = config.httpCookieStorage {
            for cookie in connection.cookies {
                storage.setCookie(cookie)
            }
        }
        session = URLSession(configuration: config)
    }

    deinit {
        session.invalidateAndCancel()
    }

    public func read(_ names: [String], withAttributes: Bool = false) async throws -> [String: KebaVariable] {
        var result: [String: KebaVariable] = [:]
        var start = 0
        while start < names.count {
            let chunk = Array(names[start..<min(start + batchSize, names.count)])
            let body = try JSONEncoder().encode(chunk.map { ReadRequest(name: $0, attr: withAttributes ? "1" : nil) })
            let data = try await post("var/readWriteVars", query: [URLQueryItem(name: "languageCode", value: languageCode)],
                                      body: body)
            for variable in try Self.decodeVariables(data) {
                result[variable.name] = variable
            }
            start += batchSize
        }
        return result
    }

    public func write(_ values: [KebaWrite]) async throws {
        guard !values.isEmpty else { return }
        let body = try JSONEncoder().encode(values)
        _ = try await post("var/readWriteVars", query: [URLQueryItem(name: "action", value: "set")], body: body)
    }

    /// Anzahl aktiver Alarme (Glocke in der HMI). Das Antwortformat ist nicht dokumentiert,
    /// daher wird die erste Zahl in der Antwort genommen.
    public func alarmCount() async throws -> Int? {
        let data = try await post("alarm", query: [URLQueryItem(name: "action", value: "getCount"),
                                                   URLQueryItem(name: "languageCode", value: languageCode)],
                                  body: nil)
        return Self.firstInteger(in: data)
    }

    /// Rohzugriff für Experimente/Diagnose.
    public func rawPost(_ path: String, query: [URLQueryItem] = [], body: Data?) async throws -> Data {
        try await post(path, query: query, body: body)
    }

    // MARK: - Intern

    struct ReadRequest: Encodable {
        let name: String
        let attr: String?
    }

    private func post(_ path: String, query: [URLQueryItem], body: Data?) async throws -> Data {
        guard var components = URLComponents(url: connection.baseURL.appendingPathComponent(path),
                                             resolvingAgainstBaseURL: false) else {
            throw KebaError.invalidResponse("Ungültige Adresse \(connection.baseURL)")
        }
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else {
            throw KebaError.invalidResponse("Ungültige Adresse \(connection.baseURL)")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = body ?? Data()
        request.setValue("application/json; charset=UTF-8", forHTTPHeaderField: "Content-Type")
        request.setValue("*/*", forHTTPHeaderField: "Accept")
        request.setValue(languageCode, forHTTPHeaderField: "Accept-Language")
        let origin = Self.origin(of: connection.baseURL)
        request.setValue(origin, forHTTPHeaderField: "Origin")
        request.setValue(origin + "/", forHTTPHeaderField: "Referer")
        if let user = connection.username, !user.isEmpty {
            let token = Data("\(user):\(connection.password ?? "")".utf8).base64EncodedString()
            request.setValue("Basic \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw KebaError.invalidResponse("Keine HTTP-Antwort")
        }
        return try Self.validate(status: http.statusCode,
                                 contentType: http.value(forHTTPHeaderField: "Content-Type"),
                                 data: data)
    }

    static func validate(status: Int, contentType: String?, data: Data) throws -> Data {
        if status == 401 {
            throw KebaError.unauthorized
        }
        if looksLikeHTML(contentType: contentType, data: data) {
            throw KebaError.sessionExpired
        }
        if status == 500, let message = developerMessage(in: data) {
            throw KebaError.server(message)
        }
        guard (200..<300).contains(status) else {
            throw KebaError.http(status: status, body: String(decoding: data.prefix(500), as: UTF8.self))
        }
        return data
    }

    static func decodeVariables(_ data: Data) throws -> [KebaVariable] {
        do {
            return try JSONDecoder().decode([KebaVariable].self, from: data)
        } catch {
            // Einzelabfragen ({"name": ...}) liefern evtl. ein Objekt statt einer Liste.
            if let single = try? JSONDecoder().decode(KebaVariable.self, from: data) {
                return [single]
            }
            throw KebaError.invalidResponse(String(decoding: data.prefix(200), as: UTF8.self))
        }
    }

    static func looksLikeHTML(contentType: String?, data: Data) -> Bool {
        if let contentType, contentType.lowercased().contains("text/html") {
            return true
        }
        let head = String(decoding: data.prefix(64), as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
        return head.hasPrefix("<")
    }

    static func developerMessage(in data: Data) -> String? {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return object["developerMessage"] as? String
    }

    static func firstInteger(in data: Data) -> Int? {
        let text = String(decoding: data, as: UTF8.self)
        var digits = ""
        for ch in text {
            if ch.isNumber {
                digits.append(ch)
            } else if !digits.isEmpty {
                break
            }
        }
        return Int(digits)
    }

    static func origin(of url: URL) -> String {
        var components = URLComponents()
        components.scheme = url.scheme
        components.host = url.host
        components.port = url.port
        return components.string ?? url.absoluteString
    }
}
