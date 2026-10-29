import Foundation
import Observation
import KebaKit

@MainActor
@Observable
final class HeatingStore {
    enum Phase: Equatable {
        case notConnected
        case loading
        case ready
        case failed(String)
        case sessionExpired
    }

    private(set) var snapshot: HeatingSnapshot?
    private(set) var phase: Phase = .notConnected
    private(set) var isWriting = false
    /// Fehler, der auftritt, während schon Daten angezeigt werden (z. B. Schreibfehler).
    var transientError: String?

    private var service: HeatingService?

    var isConnected: Bool { service != nil }

    func connect(_ connection: KebaConnection) async {
        service = HeatingService(transport: KebaClient(connection: connection))
        snapshot = nil
        phase = .loading
        await refresh()
    }

    func disconnect() {
        service = nil
        snapshot = nil
        phase = .notConnected
    }

    func refresh() async {
        guard let service else { return }
        do {
            snapshot = try await service.loadSnapshot()
            phase = .ready
        } catch {
            handle(error)
        }
    }

    /// Schreibt einen Wert und liest danach den neuen Zustand ein.
    func perform(_ action: (HeatingService) async throws -> Void) async {
        guard let service, !isWriting else { return }
        isWriting = true
        defer { isWriting = false }
        do {
            try await action(service)
            // Der Regler übernimmt neue Sollwerte nicht sofort in alle abgeleiteten Werte.
            try? await Task.sleep(for: .milliseconds(700))
            await refresh()
        } catch {
            handle(error)
        }
    }

    private func handle(_ error: Error) {
        if error is CancellationError || (error as? URLError)?.code == .cancelled {
            return
        }
        if let kebaError = error as? KebaError, kebaError == .sessionExpired {
            phase = .sessionExpired
            return
        }
        let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        if snapshot == nil {
            phase = .failed(message)
        } else {
            transientError = message
        }
    }
}
