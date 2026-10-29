import Foundation

/// Variablennamen des KEBA-Reglers (M-TEC Wärmepumpe), so wie die WebHMI sie anfragt.
/// Indizes sind 0-basiert: `heatCircuit[0]` ist der erste Heizkreis.
public enum KebaVar {
    static let prefix = "APPL.CtrlAppl.sParam"

    public static let outdoorTemperature = "\(prefix).outdoorTemp.values.actValue"
    public static let systemOperatingMode = "\(prefix).param.operatingMode"
    public static let numberOfHeatingCircuits = "\(prefix).options.systemNumberOfHeatingCircuits"
    public static let numberOfHotWaterTanks = "\(prefix).options.systemNumberOfHotWaterTanks"
    public static let numberOfHeatPumps = "\(prefix).options.systemNumberOfHeatPumps"

    public enum HeatCircuit {
        static func path(_ i: Int, _ suffix: String) -> String { "\(prefix).heatCircuit[\(i)].\(suffix)" }

        public static func name(_ i: Int) -> String { path(i, "param.name") }
        public static func hasRoomTemperature(_ i: Int) -> String { "\(prefix).options.heatCircuit[\(i)].hasRoomTemp" }
        public static func hasRoomHumidity(_ i: Int) -> String { "\(prefix).options.heatCircuit[\(i)].hasRoomHumidity" }
        public static func roomTemperature(_ i: Int) -> String { path(i, "tempRoom.values.actValue") }
        public static func roomHumidity(_ i: Int) -> String { path(i, "humidityRoom.values.actValue") }
        /// Aktueller Sollwert inkl. Korrektur (große Zahl auf dem HMI-Startbildschirm).
        public static func setValue(_ i: Int) -> String { path(i, "values.setValue") }
        public static func selectedSetTemperature(_ i: Int) -> String { path(i, "values.selectedSetTemp") }
        /// Korrektur, die die Pfeiltasten der HMI in 0,5-K-Schritten verändern.
        public static func offset(_ i: Int) -> String { path(i, "param.offsetRoomTemp") }
        public static func normalSetTemperature(_ i: Int) -> String { path(i, "param.normalSetTemp") }
        public static func reducedSetTemperature(_ i: Int) -> String { path(i, "param.reducedSetTemp") }
        public static func operatingMode(_ i: Int) -> String { path(i, "param.operatingMode") }
        public static func heatRequest(_ i: Int) -> String { path(i, "values.heatRequest") }
        public static func flowSetTemperature(_ i: Int) -> String { path(i, "values.flowSetTemp") }

        static func all(_ i: Int) -> [String] {
            [name(i), hasRoomTemperature(i), hasRoomHumidity(i), roomTemperature(i), roomHumidity(i),
             setValue(i), selectedSetTemperature(i), offset(i), normalSetTemperature(i),
             reducedSetTemperature(i), operatingMode(i), heatRequest(i), flowSetTemperature(i)]
        }
    }

    public enum HotWaterTank {
        static func path(_ i: Int, _ suffix: String) -> String { "\(prefix).hotWaterTank[\(i)].\(suffix)" }

        public static func name(_ i: Int) -> String { path(i, "param.name") }
        public static func temperature(_ i: Int) -> String { path(i, "topTemp.values.actValue") }
        public static func setTemperature(_ i: Int) -> String { path(i, "param.normalSetTempMax.value") }
        public static func operatingMode(_ i: Int) -> String { path(i, "param.operatingMode") }
        public static func heatRequest(_ i: Int) -> String { path(i, "values.heatRequestTop") }

        static func all(_ i: Int) -> [String] {
            [name(i), temperature(i), setTemperature(i), operatingMode(i), heatRequest(i)]
        }
    }
}

/// Betriebsarten laut `keba_keenergy_api` (superbox-dev), passend zu den Icons der HMI.
public enum SystemOperatingMode: Int, CaseIterable, Sendable, Identifiable {
    case setup = -1
    case standby = 0
    case summer = 1
    case autoHeat = 2
    case autoCool = 3
    case auto = 4

    public var id: Int { rawValue }

    /// Was die HMI im Menü "Betriebsart" zur Auswahl anbietet.
    public static let selectable: [SystemOperatingMode] = [.standby, .summer, .autoHeat]

    public var label: String {
        switch self {
        case .setup: "Inbetriebnahme"
        case .standby: "Aus (Standby)"
        case .summer: "Nur Warmwasser"
        case .autoHeat: "Heizen + Warmwasser"
        case .autoCool: "Kühlen"
        case .auto: "Automatik Heizen/Kühlen"
        }
    }
}

public enum HeatCircuitOperatingMode: Int, CaseIterable, Sendable, Identifiable {
    case off = 0
    case auto = 1
    case day = 2
    case night = 3
    case holiday = 4
    case party = 5
    case external = 8
    case roomControl = 9

    public var id: Int { rawValue }

    public static let selectable: [HeatCircuitOperatingMode] = [.off, .auto, .day, .night]

    public var label: String {
        switch self {
        case .off: "Aus"
        case .auto: "Automatik (Zeitprogramm)"
        case .day: "Dauernd Komfort"
        case .night: "Dauernd Absenkung"
        case .holiday: "Urlaub"
        case .party: "Party"
        case .external: "Extern"
        case .roomControl: "Raumregelung"
        }
    }
}

public enum HotWaterOperatingMode: Int, CaseIterable, Sendable, Identifiable {
    case off = 0
    case auto = 1
    case on = 2
    case heatUp = 3

    public var id: Int { rawValue }

    public static let selectable: [HotWaterOperatingMode] = [.off, .auto, .on, .heatUp]

    public var label: String {
        switch self {
        case .off: "Aus"
        case .auto: "Automatik (Zeitprogramm)"
        case .on: "Dauernd Ein"
        case .heatUp: "Einmal aufheizen"
        }
    }
}
