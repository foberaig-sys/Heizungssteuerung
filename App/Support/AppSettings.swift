import Foundation
import Observation
import Security
import KebaKit

enum ConnectionMode: String, CaseIterable, Identifiable {
    /// Direkt im Heimnetz (oder per eigenem VPN) mit der IP des Reglers.
    case local
    /// Über remote.keba.com (Secomea). Die Sitzung wird per Web-Login geholt.
    case remote

    var id: String { rawValue }

    var label: String {
        switch self {
        case .local: "Heimnetz / VPN"
        case .remote: "KEBA Fernzugriff"
        }
    }
}

@MainActor
@Observable
final class AppSettings {
    @ObservationIgnored private let defaults = UserDefaults.standard

    var mode: ConnectionMode {
        didSet { defaults.set(mode.rawValue, forKey: "connectionMode") }
    }

    var localAddress: String {
        didSet { defaults.set(localAddress, forKey: "localAddress") }
    }

    var username: String {
        didSet { defaults.set(username, forKey: "username") }
    }

    var password: String {
        didSet { Keychain.set(password, for: "heizung.password") }
    }

    init() {
        mode = ConnectionMode(rawValue: defaults.string(forKey: "connectionMode") ?? "") ?? .remote
        localAddress = defaults.string(forKey: "localAddress") ?? ""
        username = defaults.string(forKey: "username") ?? ""
        password = Keychain.get("heizung.password") ?? ""
    }

    /// `192.168.1.50` → `http://192.168.1.50`
    var localURL: URL? {
        var text = localAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        if !text.contains("://") {
            text = "http://" + text
        }
        guard let url = URL(string: text), url.host != nil else { return nil }
        return url
    }

    var localConnection: KebaConnection? {
        guard let localURL else { return nil }
        return KebaConnection(baseURL: localURL,
                              username: username.isEmpty ? nil : username,
                              password: password.isEmpty ? nil : password)
    }
}

enum Keychain {
    static func set(_ value: String, for key: String) {
        delete(key)
        guard !value.isEmpty else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: Data(value.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    static func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
