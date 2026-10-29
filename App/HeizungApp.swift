import SwiftUI

@main
struct HeizungApp: App {
    @State private var store = HeatingStore()
    @State private var settings = AppSettings()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(settings)
                .tint(.mtecOrange)
        }
    }
}

extension Color {
    static let mtecOrange = Color(red: 1.0, green: 0.62, blue: 0.0)
}
