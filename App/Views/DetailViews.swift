import SwiftUI
import KebaKit

struct HeatCircuitDetailView: View {
    let index: Int
    @Environment(HeatingStore.self) private var store

    private var circuit: HeatCircuitStatus? {
        store.snapshot?.heatCircuits.first { $0.index == index }
    }

    var body: some View {
        Form {
            if let circuit {
                Section("Status") {
                    LabeledContent("Aktueller Sollwert", value: Temperature.text(circuit.currentSetTemperature))
                    if let room = circuit.roomTemperature {
                        LabeledContent("Raumtemperatur", value: Temperature.text(room))
                    }
                    if let humidity = circuit.roomHumidity {
                        LabeledContent("Luftfeuchte",
                                       value: humidity.formatted(.number.precision(.fractionLength(0))) + " %")
                    }
                    if let flow = circuit.flowSetTemperature {
                        LabeledContent("Vorlauf-Soll", value: Temperature.text(flow))
                    }
                    LabeledContent("Heizanforderung", value: circuit.heatRequest == true ? "Ja" : "Nein")
                }

                Section("Betriebsart") {
                    Picker("Betriebsart", selection: modeBinding(circuit)) {
                        ForEach(HeatCircuitOperatingMode.selectable) { mode in
                            Text(mode.label).tag(Optional(mode))
                        }
                        if let current = circuit.operatingMode, !HeatCircuitOperatingMode.selectable.contains(current) {
                            Text(current.label).tag(Optional(current))
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                    .disabled(store.isWriting)
                }

                Section {
                    if let normal = circuit.normalSetTemperature {
                        SetpointEditor(title: "Komfort (Tag)", setpoint: normal, step: 0.5) { value in
                            await store.perform { try await $0.setNormalTemperature(value, circuit: index) }
                        }
                    }
                    if let reduced = circuit.reducedSetTemperature {
                        SetpointEditor(title: "Absenkung (Nacht)", setpoint: reduced, step: 0.5) { value in
                            await store.perform { try await $0.setReducedTemperature(value, circuit: index) }
                        }
                    }
                    if let offset = circuit.offset {
                        SetpointEditor(title: "Korrektur", setpoint: offset, step: 0.5, unit: " K") { value in
                            await store.perform { try await $0.setOffset(value, circuit: index) }
                        }
                    }
                } header: {
                    Text("Temperaturen")
                } footer: {
                    Text("Die Korrektur entspricht den Pfeiltasten auf dem Startbildschirm der Heizung.")
                }
            }
        }
        .navigationTitle(circuit?.name ?? "Heizkreis")
        .refreshable { await store.refresh() }
    }

    private func modeBinding(_ circuit: HeatCircuitStatus) -> Binding<HeatCircuitOperatingMode?> {
        Binding(
            get: { circuit.operatingMode },
            set: { newValue in
                guard let newValue, newValue != circuit.operatingMode else { return }
                Task { await store.perform { try await $0.setHeatCircuitMode(newValue, circuit: index) } }
            }
        )
    }
}

struct HotWaterDetailView: View {
    let index: Int
    @Environment(HeatingStore.self) private var store

    private var tank: HotWaterStatus? {
        store.snapshot?.hotWaterTanks.first { $0.index == index }
    }

    var body: some View {
        Form {
            if let tank {
                Section("Status") {
                    LabeledContent("Temperatur oben", value: Temperature.text(tank.temperature))
                    LabeledContent("Wird geheizt", value: tank.heatRequest == true ? "Ja" : "Nein")
                }

                Section("Betriebsart") {
                    Picker("Betriebsart", selection: modeBinding(tank)) {
                        ForEach(HotWaterOperatingMode.selectable) { mode in
                            Text(mode.label).tag(Optional(mode))
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                    .disabled(store.isWriting)
                }

                if let set = tank.setTemperature {
                    Section("Temperatur") {
                        SetpointEditor(title: "Solltemperatur", setpoint: set, step: 1) { value in
                            await store.perform { try await $0.setHotWaterTemperature(value, tank: index) }
                        }
                    }
                }
            }
        }
        .navigationTitle(tank?.name ?? "Warmwasser")
        .refreshable { await store.refresh() }
    }

    private func modeBinding(_ tank: HotWaterStatus) -> Binding<HotWaterOperatingMode?> {
        Binding(
            get: { tank.operatingMode },
            set: { newValue in
                guard let newValue, newValue != tank.operatingMode else { return }
                Task { await store.perform { try await $0.setHotWaterMode(newValue, tank: index) } }
            }
        )
    }
}

/// Stepper mit "Übernehmen"-Knopf, damit nicht jeder Zwischenschritt an den Regler geht.
struct SetpointEditor: View {
    let title: String
    let setpoint: Setpoint
    let step: Double
    var unit: String = "°"
    let onCommit: (Double) async -> Void

    @State private var draft: Double?
    @Environment(HeatingStore.self) private var store

    private var value: Double { draft ?? setpoint.value }
    private var range: ClosedRange<Double> { setpoint.range ?? (setpoint.value - 20)...(setpoint.value + 20) }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Stepper(value: Binding(get: { value }, set: { draft = $0 }), in: range, step: step) {
                HStack {
                    Text(title)
                    Spacer()
                    Text(value.formatted(.number.precision(.fractionLength(1))) + unit)
                        .monospacedDigit()
                        .foregroundStyle(draft == nil ? Color.primary : Color.mtecOrange)
                }
            }
            if let draft, draft != setpoint.value {
                HStack {
                    Button("Verwerfen", role: .cancel) { self.draft = nil }
                    Spacer()
                    Button("Übernehmen") {
                        Task {
                            await onCommit(draft)
                            self.draft = nil
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(store.isWriting)
                }
                .buttonStyle(.bordered)
            }
        }
    }
}
