import SwiftUI
import KebaKit

struct DashboardView: View {
    @Environment(HeatingStore.self) private var store

    var body: some View {
        ScrollView {
            if let snapshot = store.snapshot {
                VStack(spacing: 16) {
                    SystemCard(snapshot: snapshot)
                    ForEach(snapshot.heatCircuits) { circuit in
                        NavigationLink(value: Destination.heatCircuit(circuit.index)) {
                            HeatCircuitCard(circuit: circuit)
                        }
                        .buttonStyle(.plain)
                    }
                    ForEach(snapshot.hotWaterTanks) { tank in
                        NavigationLink(value: Destination.hotWater(tank.index)) {
                            HotWaterCard(tank: tank)
                        }
                        .buttonStyle(.plain)
                    }
                    Text("Stand: \(snapshot.fetchedAt.formatted(date: .omitted, time: .standard))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding()
            }
        }
        .background(Color(.systemGroupedBackground))
        .refreshable { await store.refresh() }
        .task {
            // Solange das Dashboard sichtbar ist, alle 30 s aktualisieren.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                await store.refresh()
            }
        }
        .navigationDestination(for: Destination.self) { destination in
            switch destination {
            case .heatCircuit(let index): HeatCircuitDetailView(index: index)
            case .hotWater(let index): HotWaterDetailView(index: index)
            }
        }
        .alert("Fehler", isPresented: Binding(get: { store.transientError != nil },
                                              set: { if !$0 { store.transientError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(store.transientError ?? "")
        }
        .overlay(alignment: .top) {
            if store.isWriting {
                ProgressView()
                    .padding(8)
                    .background(.regularMaterial, in: Capsule())
                    .padding(.top, 4)
            }
        }
    }
}

enum Destination: Hashable {
    case heatCircuit(Int)
    case hotWater(Int)
}

// MARK: - Karten

private struct SystemCard: View {
    let snapshot: HeatingSnapshot
    @Environment(HeatingStore.self) private var store

    var body: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Außen").font(.subheadline).foregroundStyle(.secondary)
                Text(Temperature.text(snapshot.outdoorTemperature))
                    .font(.system(size: 34, weight: .semibold, design: .rounded))
            }
            Spacer()
            Menu {
                Picker("Betriebsart", selection: modeBinding) {
                    ForEach(SystemOperatingMode.selectable) { mode in
                        Text(mode.label).tag(Optional(mode))
                    }
                }
            } label: {
                VStack(alignment: .trailing, spacing: 4) {
                    Text("Anlage").font(.subheadline).foregroundStyle(.secondary)
                    HStack(spacing: 4) {
                        Text(snapshot.systemOperatingMode?.label ?? modeFallback)
                        Image(systemName: "chevron.up.chevron.down").font(.caption)
                    }
                    .font(.headline)
                }
            }
            .disabled(store.isWriting)
        }
        .cardStyle()
    }

    private var modeFallback: String {
        snapshot.systemOperatingModeRaw.map { "Modus \($0)" } ?? "–"
    }

    private var modeBinding: Binding<SystemOperatingMode?> {
        Binding(
            get: { snapshot.systemOperatingMode },
            set: { newValue in
                guard let newValue, newValue != snapshot.systemOperatingMode else { return }
                Task { await store.perform { try await $0.setSystemMode(newValue) } }
            }
        )
    }
}

struct HeatCircuitCard: View {
    let circuit: HeatCircuitStatus
    @Environment(HeatingStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(circuit.name).font(.headline)
                if circuit.heatRequest == true {
                    Image(systemName: "flame.fill").foregroundStyle(Color.mtecOrange)
                        .accessibilityLabel("Heizt gerade")
                }
                Spacer()
                Text(circuit.operatingMode?.label ?? "")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
            }

            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(Temperature.text(circuit.currentSetTemperature))
                        .font(.system(size: 56, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.mtecOrange)
                        .contentTransition(.numericText())
                    if let offset = circuit.offset?.value, offset != 0 {
                        Text("Korrektur \(Temperature.signed(offset))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    if let room = circuit.roomTemperature {
                        Text("Raum \(Temperature.text(room))")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if circuit.offset != nil {
                    VStack(spacing: 10) {
                        stepButton(systemImage: "chevron.up", delta: 0.5)
                        stepButton(systemImage: "chevron.down", delta: -0.5)
                    }
                }
            }
        }
        .cardStyle()
    }

    private func stepButton(systemImage: String, delta: Double) -> some View {
        Button {
            guard let offset = circuit.offset else { return }
            var newValue = offset.value + delta
            if let range = offset.range {
                newValue = min(max(newValue, range.lowerBound), range.upperBound)
            }
            guard newValue != offset.value else { return }
            Task { await store.perform { try await $0.setOffset(newValue, circuit: circuit.index) } }
        } label: {
            Image(systemName: systemImage)
                .font(.title2.weight(.semibold))
                .frame(width: 52, height: 44)
        }
        .buttonStyle(.bordered)
        .disabled(store.isWriting)
        .accessibilityLabel(delta > 0 ? "Wärmer" : "Kälter")
    }
}

struct HotWaterCard: View {
    let tank: HotWaterStatus

    var body: some View {
        HStack {
            Image(systemName: "drop.fill")
                .font(.title)
                .foregroundStyle(.blue)
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(tank.name).font(.headline)
                    if tank.heatRequest == true {
                        Image(systemName: "flame.fill").foregroundStyle(Color.mtecOrange)
                    }
                }
                if let set = tank.setTemperature {
                    Text("Soll \(Temperature.text(set.value)) · \(tank.operatingMode?.label ?? "")")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text(Temperature.text(tank.temperature))
                .font(.system(size: 34, weight: .semibold, design: .rounded))
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
        }
        .cardStyle()
    }
}

// MARK: - Hilfen

enum Temperature {
    static func text(_ value: Double?) -> String {
        guard let value else { return "–" }
        return value.formatted(.number.precision(.fractionLength(1))) + "°"
    }

    static func signed(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(1)).sign(strategy: .always())) + " K"
    }
}

extension View {
    func cardStyle() -> some View {
        padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}
