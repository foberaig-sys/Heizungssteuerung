import Foundation

/// Ein Eintrag aus der Antwort von `/var/readWriteVars`, z. B.
/// `{"name": "...outdoorTemp.values.actValue", "attributes": {"unitId": "Temp", ...}, "value": "10.808357"}`.
public struct KebaVariable: Decodable, Sendable, Equatable {
    public let name: String
    public let value: String
    public let attributes: KebaAttributes?

    public init(name: String, value: String, attributes: KebaAttributes? = nil) {
        self.name = name
        self.value = value
        self.attributes = attributes
    }

    enum CodingKeys: String, CodingKey { case name, value, attributes }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        value = try c.decodeIfPresent(FlexibleString.self, forKey: .value)?.value ?? ""
        attributes = try c.decodeIfPresent(KebaAttributes.self, forKey: .attributes)
    }

    public var double: Double? { Double(value.trimmingCharacters(in: .whitespaces)) }
    public var int: Int? { Int(value) ?? double.map { Int($0.rounded()) } }
    public var bool: Bool? {
        switch value.lowercased() {
        case "true", "1": true
        case "false", "0": false
        default: nil
        }
    }
}

/// Zusatzinfos, die der Regler bei `"attr": "1"` mitliefert.
public struct KebaAttributes: Decodable, Sendable, Equatable {
    public var formatId: String?
    public var longText: String?
    public var unitId: String?
    public var lowerLimit: String?
    public var upperLimit: String?

    public init(formatId: String? = nil, longText: String? = nil, unitId: String? = nil,
                lowerLimit: String? = nil, upperLimit: String? = nil) {
        self.formatId = formatId
        self.longText = longText
        self.unitId = unitId
        self.lowerLimit = lowerLimit
        self.upperLimit = upperLimit
    }

    enum CodingKeys: String, CodingKey { case formatId, longText, unitId, lowerLimit, upperLimit }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        formatId = try c.decodeIfPresent(FlexibleString.self, forKey: .formatId)?.value
        longText = try c.decodeIfPresent(FlexibleString.self, forKey: .longText)?.value
        unitId = try c.decodeIfPresent(FlexibleString.self, forKey: .unitId)?.value
        lowerLimit = try c.decodeIfPresent(FlexibleString.self, forKey: .lowerLimit)?.value
        upperLimit = try c.decodeIfPresent(FlexibleString.self, forKey: .upperLimit)?.value
    }

    public var range: ClosedRange<Double>? {
        guard let lo = lowerLimit.flatMap(Double.init), let hi = upperLimit.flatMap(Double.init), lo <= hi else {
            return nil
        }
        return lo...hi
    }
}

/// Der Regler liefert Werte meist als String, toleriert wird aber auch Zahl/Bool.
struct FlexibleString: Decodable {
    let value: String

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self) {
            value = s
        } else if let b = try? c.decode(Bool.self) {
            value = b ? "true" : "false"
        } else if let i = try? c.decode(Int.self) {
            value = String(i)
        } else if let d = try? c.decode(Double.self) {
            value = String(d)
        } else if c.decodeNil() {
            value = ""
        } else {
            throw DecodingError.typeMismatch(String.self, .init(codingPath: decoder.codingPath,
                                                                debugDescription: "Unbekannter Werttyp"))
        }
    }
}

public struct KebaWrite: Encodable, Sendable, Equatable {
    public let name: String
    public let value: String

    public init(name: String, value: String) {
        self.name = name
        self.value = value
    }

    public init(name: String, number: Double) {
        self.init(name: name, value: KebaFormat.number(number))
    }

    public init(name: String, int: Int) {
        self.init(name: name, value: String(int))
    }
}

public enum KebaFormat {
    /// Zahlen so schreiben, wie die HMI es tut: "0", "0.5", "22.5" (Punkt als Dezimaltrenner).
    public static func number(_ value: Double) -> String {
        let rounded = (value * 100).rounded() / 100
        if rounded == rounded.rounded() {
            return String(Int(rounded))
        }
        var s = String(format: "%.2f", locale: Locale(identifier: "en_US_POSIX"), rounded)
        while s.hasSuffix("0") { s.removeLast() }
        return s
    }
}

// MARK: - Aufbereiteter Zustand für die App

public struct Setpoint: Sendable, Equatable {
    public var value: Double
    public var range: ClosedRange<Double>?
}

public struct HeatCircuitStatus: Sendable, Equatable, Identifiable {
    public var index: Int
    public var name: String
    public var roomTemperature: Double?
    public var roomHumidity: Double?
    public var currentSetTemperature: Double?
    public var selectedSetTemperature: Double?
    public var flowSetTemperature: Double?
    public var offset: Setpoint?
    public var normalSetTemperature: Setpoint?
    public var reducedSetTemperature: Setpoint?
    public var operatingModeRaw: Int?
    public var heatRequest: Bool?

    public var id: Int { index }
    public var operatingMode: HeatCircuitOperatingMode? { operatingModeRaw.flatMap(HeatCircuitOperatingMode.init) }
}

public struct HotWaterStatus: Sendable, Equatable, Identifiable {
    public var index: Int
    public var name: String
    public var temperature: Double?
    public var setTemperature: Setpoint?
    public var operatingModeRaw: Int?
    public var heatRequest: Bool?

    public var id: Int { index }
    public var operatingMode: HotWaterOperatingMode? { operatingModeRaw.flatMap(HotWaterOperatingMode.init) }
}

public struct HeatingSnapshot: Sendable, Equatable {
    public var outdoorTemperature: Double?
    public var systemOperatingModeRaw: Int?
    public var heatCircuits: [HeatCircuitStatus]
    public var hotWaterTanks: [HotWaterStatus]
    public var fetchedAt: Date

    public var systemOperatingMode: SystemOperatingMode? { systemOperatingModeRaw.flatMap(SystemOperatingMode.init) }
}
