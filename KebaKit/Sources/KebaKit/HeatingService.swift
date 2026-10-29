import Foundation

private typealias HC = KebaVar.HeatCircuit
private typealias HW = KebaVar.HotWaterTank

/// Fasst die einzelnen Reglervariablen zu einem Zustand zusammen und kapselt die Schreibbefehle.
public struct HeatingService: Sendable {
    public let transport: any KebaTransport

    public init(transport: any KebaTransport) {
        self.transport = transport
    }

    public func loadSnapshot(now: Date = Date()) async throws -> HeatingSnapshot {
        let counts = try await transport.read([KebaVar.numberOfHeatingCircuits, KebaVar.numberOfHotWaterTanks],
                                              withAttributes: false)
        let circuitCount = Self.clamp(counts[KebaVar.numberOfHeatingCircuits]?.int ?? 1, max: 8)
        let tankCount = Self.clamp(counts[KebaVar.numberOfHotWaterTanks]?.int ?? 1, max: 4)

        var names = [KebaVar.outdoorTemperature, KebaVar.systemOperatingMode]
        for i in 0..<circuitCount { names += KebaVar.HeatCircuit.all(i) }
        for i in 0..<tankCount { names += KebaVar.HotWaterTank.all(i) }

        let v = try await transport.read(names, withAttributes: true)

        let circuits = (0..<circuitCount).map { i -> HeatCircuitStatus in
            let hasRoomTemp = v[HC.hasRoomTemperature(i)]?.bool ?? true
            let hasHumidity = v[HC.hasRoomHumidity(i)]?.bool ?? true
            return HeatCircuitStatus(
                index: i,
                name: Self.nonEmpty(v[HC.name(i)]?.value) ?? "Heizkreis \(i + 1)",
                roomTemperature: hasRoomTemp ? v[HC.roomTemperature(i)]?.double : nil,
                roomHumidity: hasHumidity ? v[HC.roomHumidity(i)]?.double : nil,
                currentSetTemperature: v[HC.setValue(i)]?.double,
                selectedSetTemperature: v[HC.selectedSetTemperature(i)]?.double,
                flowSetTemperature: v[HC.flowSetTemperature(i)]?.double,
                offset: Self.setpoint(v[HC.offset(i)]),
                normalSetTemperature: Self.setpoint(v[HC.normalSetTemperature(i)]),
                reducedSetTemperature: Self.setpoint(v[HC.reducedSetTemperature(i)]),
                operatingModeRaw: v[HC.operatingMode(i)]?.int,
                heatRequest: v[HC.heatRequest(i)]?.bool
            )
        }

        let tanks = (0..<tankCount).map { i -> HotWaterStatus in
            return HotWaterStatus(
                index: i,
                name: Self.nonEmpty(v[HW.name(i)]?.value) ?? (tankCount == 1 ? "Warmwasser" : "Warmwasser \(i + 1)"),
                temperature: v[HW.temperature(i)]?.double,
                setTemperature: Self.setpoint(v[HW.setTemperature(i)]),
                operatingModeRaw: v[HW.operatingMode(i)]?.int,
                heatRequest: v[HW.heatRequest(i)]?.bool
            )
        }

        return HeatingSnapshot(
            outdoorTemperature: v[KebaVar.outdoorTemperature]?.double,
            systemOperatingModeRaw: v[KebaVar.systemOperatingMode]?.int,
            heatCircuits: circuits,
            hotWaterTanks: tanks,
            fetchedAt: now
        )
    }

    // MARK: - Schreiben

    public func setSystemMode(_ mode: SystemOperatingMode) async throws {
        try await transport.write([KebaWrite(name: KebaVar.systemOperatingMode, int: mode.rawValue)])
    }

    /// Entspricht den Pfeiltasten auf dem HMI-Startbildschirm.
    public func setOffset(_ value: Double, circuit: Int) async throws {
        try await transport.write([KebaWrite(name: KebaVar.HeatCircuit.offset(circuit), number: value)])
    }

    public func setNormalTemperature(_ value: Double, circuit: Int) async throws {
        try await transport.write([KebaWrite(name: KebaVar.HeatCircuit.normalSetTemperature(circuit), number: value)])
    }

    public func setReducedTemperature(_ value: Double, circuit: Int) async throws {
        try await transport.write([KebaWrite(name: KebaVar.HeatCircuit.reducedSetTemperature(circuit), number: value)])
    }

    public func setHeatCircuitMode(_ mode: HeatCircuitOperatingMode, circuit: Int) async throws {
        try await transport.write([KebaWrite(name: KebaVar.HeatCircuit.operatingMode(circuit), int: mode.rawValue)])
    }

    public func setHotWaterTemperature(_ value: Double, tank: Int) async throws {
        try await transport.write([KebaWrite(name: KebaVar.HotWaterTank.setTemperature(tank), number: value)])
    }

    public func setHotWaterMode(_ mode: HotWaterOperatingMode, tank: Int) async throws {
        try await transport.write([KebaWrite(name: KebaVar.HotWaterTank.operatingMode(tank), int: mode.rawValue)])
    }

    // MARK: - Hilfen

    static func clamp(_ value: Int, max upper: Int) -> Int {
        Swift.min(Swift.max(value, 0), upper)
    }

    static func nonEmpty(_ s: String?) -> String? {
        guard let s = s?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return nil }
        return s
    }

    static func setpoint(_ variable: KebaVariable?) -> Setpoint? {
        guard let variable, let value = variable.double else { return nil }
        return Setpoint(value: value, range: variable.attributes?.range)
    }
}
