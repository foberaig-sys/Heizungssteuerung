import SwiftUI
import KebaKit

struct RootView: View {
    @Environment(HeatingStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @Environment(\.scenePhase) private var scenePhase
    @State private var showSettings = false
    @State private var showRemoteLogin = false
    /// Erst nach dem Schließen der Einstellungen öffnen – zwei Sheets gleichzeitig mag SwiftUI nicht.
    @State private var openRemoteLoginAfterSettings = false

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Heizung")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showSettings = true
                        } label: {
                            Image(systemName: "gearshape")
                        }
                        .accessibilityLabel("Einstellungen")
                    }
                }
        }
        .sheet(isPresented: $showSettings, onDismiss: {
            if openRemoteLoginAfterSettings {
                openRemoteLoginAfterSettings = false
                showRemoteLogin = true
            }
        }) {
            SettingsView(onConnectRemote: {
                openRemoteLoginAfterSettings = true
                showSettings = false
            })
        }
        .sheet(isPresented: $showRemoteLogin) {
            RemoteLoginView { url, cookies in
                Task { await store.connect(KebaConnection(baseURL: url, cookies: cookies)) }
            }
        }
        .task {
            await autoConnect()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await store.refresh() }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch store.phase {
        case .notConnected:
            ContentUnavailableView {
                Label("Nicht verbunden", systemImage: "thermometer.medium.slash")
            } description: {
                Text("Verbinde die App mit deiner Wärmepumpe – direkt im Heimnetz oder über den KEBA Fernzugriff.")
            } actions: {
                connectButton
                Button("Einstellungen") { showSettings = true }
            }
        case .loading:
            ProgressView("Lade Daten …")
        case .failed(let message):
            ContentUnavailableView {
                Label("Keine Verbindung", systemImage: "wifi.exclamationmark")
            } description: {
                Text(message)
            } actions: {
                Button("Erneut versuchen") { Task { await store.refresh() } }
                    .buttonStyle(.borderedProminent)
                Button("Einstellungen") { showSettings = true }
            }
        case .sessionExpired:
            ContentUnavailableView {
                Label("Sitzung abgelaufen", systemImage: "clock.badge.exclamationmark")
            } description: {
                Text("Der Fernzugriff-Tunnel wurde geschlossen. Bitte neu verbinden.")
            } actions: {
                connectButton
            }
        case .ready:
            DashboardView()
        }
    }

    private var connectButton: some View {
        Button(settings.mode == .remote ? "Über KEBA Fernzugriff verbinden" : "Verbinden") {
            Task { await connect() }
        }
        .buttonStyle(.borderedProminent)
    }

    private func connect() async {
        switch settings.mode {
        case .remote:
            showRemoteLogin = true
        case .local:
            if let connection = settings.localConnection {
                await store.connect(connection)
            } else {
                showSettings = true
            }
        }
    }

    private func autoConnect() async {
        guard !store.isConnected, settings.mode == .local, let connection = settings.localConnection else { return }
        await store.connect(connection)
    }
}
