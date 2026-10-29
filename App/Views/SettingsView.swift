import SwiftUI
import KebaKit

struct SettingsView: View {
    var onConnectRemote: () -> Void

    @Environment(HeatingStore.self) private var store
    @Environment(AppSettings.self) private var settings
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        @Bindable var settings = settings
        NavigationStack {
            Form {
                Section {
                    Picker("Verbindung", selection: $settings.mode) {
                        ForEach(ConnectionMode.allCases) { mode in
                            Text(mode.label).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                } footer: {
                    switch settings.mode {
                    case .local:
                        Text("Am schnellsten und unabhängig vom Hersteller. Funktioniert im WLAN zuhause oder unterwegs über ein eigenes VPN (z. B. FRITZ!Box, WireGuard, Tailscale).")
                    case .remote:
                        Text("Nutzt deinen Zugang zu remote.keba.com. Du meldest dich einmal im Web an, danach steuert die App die Heizung direkt. Die Sitzung läuft nach einiger Zeit ab.")
                    }
                }

                switch settings.mode {
                case .local:
                    Section("Regler im Heimnetz") {
                        TextField("IP-Adresse, z. B. 192.168.1.50", text: $settings.localAddress)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        TextField("Benutzer (falls nötig)", text: $settings.username)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        SecureField("Passwort (falls nötig)", text: $settings.password)
                    }
                    Section {
                        Button("Verbinden") {
                            guard let connection = settings.localConnection else { return }
                            dismiss()
                            Task { await store.connect(connection) }
                        }
                        .disabled(settings.localConnection == nil)
                    }
                case .remote:
                    Section {
                        Button("Bei remote.keba.com anmelden") {
                            onConnectRemote()
                        }
                    }
                }

                if store.isConnected {
                    Section {
                        Button("Verbindung trennen", role: .destructive) {
                            store.disconnect()
                        }
                    }
                }
            }
            .navigationTitle("Einstellungen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { dismiss() }
                }
            }
        }
    }
}
