import { ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { WebViewBridge } from './keba/bridge';
import { KebaClient, KebaError } from './keba/client';
import { PortalMessage, buildPortalAutomationScript, portalStepLabel } from './keba/portalAutomation';
import { HeatingSnapshot, KebaTransport, loadSnapshot } from './keba/service';
import { ModbusTcpClient } from './modbus/modbusClient';
import { ModbusTransport } from './modbus/modbusTransport';
import { isModbusAvailable, loadSocketFactory } from './modbus/nativeSocket';
import { Settings, circuitNameList, hasPortalCredentials } from './settings';

export type Phase = 'notConnected' | 'loading' | 'ready' | 'failed' | 'sessionExpired';

/**
 * Zustand der WebView für den Fernzugriff:
 * - auto: unsichtbar, die App meldet sich selbst im Portal an,
 * - login: sichtbar, der Nutzer meldet sich von Hand an (ohne gespeicherte Zugangsdaten oder als Rückfall),
 * - connected: unsichtbar, die HMI ist offen und die App schickt ihre Anfragen darüber.
 */
export type RemoteStage = 'idle' | 'auto' | 'login' | 'connected';

interface HeatingContextValue {
  phase: Phase;
  snapshot?: HeatingSnapshot;
  error?: string;
  /** Fortschritt beim Verbinden, z. B. „Anmelden bei KEBA …“. */
  progress: string;
  /** Hinweis über der sichtbaren Portal-Seite. */
  loginNotice?: string;
  /** Letzte Ereignisse beim Verbindungsaufbau (für die Fehlersuche). */
  diagnostics: string[];
  /** Fehler, der auftritt, während schon Daten angezeigt werden (z. B. Schreibfehler). */
  transientError?: string;
  writing: boolean;
  /** Letzte Aktualisierung fehlgeschlagen (z. B. außer Haus) – angezeigt wird der letzte Stand. */
  offline: boolean;
  remoteStage: RemoteStage;
  /** Erhöht sich bei jedem neuen Verbindungsaufbau, damit die WebView frisch startet. */
  remoteSession: number;
  /** Skript für die automatische Anmeldung (nur in Stufe „auto“). */
  portalScript?: string;
  bridge: WebViewBridge;
  /** Ob sich ein Wert über die aktuelle Verbindung ändern lässt (Modbus: nur bestätigte Sollwerte). */
  canWrite: (variableName: string) => boolean;
  connect: (settings: Settings) => Promise<void>;
  cancelRemoteLogin: () => void;
  onHmiReached: () => void;
  onHmiLeft: () => void;
  onPortalMessage: (message: PortalMessage) => void;
  /** Portal-Seite sichtbar machen, ohne sie neu zu laden (Automatik hängt oder Nutzer will sehen). */
  revealPortal: (notice: string) => void;
  addDiagnostic: (line: string) => void;
  refresh: () => Promise<void>;
  perform: (action: (client: KebaTransport) => Promise<void>) => Promise<void>;
  disconnect: () => void;
  clearTransientError: () => void;
}

const HeatingContext = createContext<HeatingContextValue | null>(null);

export function useHeating(): HeatingContextValue {
  const value = useContext(HeatingContext);
  if (!value) throw new Error('useHeating außerhalb von <HeatingProvider>');
  return value;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Abgelaufene Sitzung höchstens so oft still erneuern, sonst Endlosschleife bei Portal-Problemen. */
const AUTO_RECONNECT_INTERVAL_MS = 60_000;

export function HeatingProvider({ children }: { children: ReactNode }) {
  const bridge = useRef(new WebViewBridge()).current;
  const client = useRef<KebaTransport | null>(null);
  const modbusClient = useRef<ModbusTcpClient | null>(null);
  const refreshing = useRef(false);
  const settingsRef = useRef<Settings | null>(null);
  const lastAutoConnect = useRef(0);
  const snapshotRef = useRef<HeatingSnapshot>(undefined);

  const [phase, setPhase] = useState<Phase>('notConnected');
  const [snapshot, setSnapshot] = useState<HeatingSnapshot>();
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState('');
  const [loginNotice, setLoginNotice] = useState<string>();
  const [transientError, setTransientError] = useState<string>();
  const [writing, setWriting] = useState(false);
  const [offline, setOffline] = useState(false);
  const [remoteStage, setRemoteStage] = useState<RemoteStage>('idle');
  const [remoteSession, setRemoteSession] = useState(0);
  const [portalScript, setPortalScript] = useState<string>();
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const addDiagnostic = useCallback((line: string) => {
    const time = new Date().toLocaleTimeString('de-DE');
    setDiagnostics((d) => [...d.slice(-7), `${time} ${line}`]);
  }, []);

  const fail = useCallback((message: string) => {
    setError(message);
    setPhase('failed');
  }, []);

  /** Fernzugriff aufbauen – automatisch mit gespeicherten Zugangsdaten, sonst sichtbar zum Anmelden. */
  const startRemote = useCallback(
    (settings: Settings, notice?: string) => {
      bridge.reset();
      client.current = null;
      setDiagnostics([]);
      setRemoteSession((n) => n + 1);
      if (hasPortalCredentials(settings) && !notice) {
        lastAutoConnect.current = Date.now();
        setPortalScript(
          buildPortalAutomationScript({
            username: settings.portalUsername.trim(),
            password: settings.portalPassword,
            device: settings.portalDevice.trim(),
          }),
        );
        setProgress(portalStepLabel(undefined));
        setPhase('loading');
        setRemoteStage('auto');
      } else {
        setPortalScript(undefined);
        setLoginNotice(notice);
        setRemoteStage('login');
      }
    },
    [bridge],
  );

  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof KebaError && e.kind === 'sessionExpired') {
        const settings = settingsRef.current;
        if (
          settings?.mode === 'remote' &&
          hasPortalCredentials(settings) &&
          Date.now() - lastAutoConnect.current > AUTO_RECONNECT_INTERVAL_MS
        ) {
          // Tunnel abgelaufen → still neu verbinden, die angezeigten Daten bleiben solange stehen.
          startRemote(settings);
          if (snapshotRef.current) setPhase('ready');
          return;
        }
        setRemoteStage('idle');
        setPhase('sessionExpired');
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      if (snapshotRef.current) setTransientError(message);
      else fail(message);
    },
    [fail, startRemote],
  );

  const refresh = useCallback(async () => {
    if (!client.current || refreshing.current) return;
    refreshing.current = true;
    try {
      const next = await loadSnapshot(client.current);
      snapshotRef.current = next;
      setSnapshot(next);
      setOffline(false);
      setPhase('ready');
    } catch (e) {
      // Regelmäßiges Aktualisieren ohne Netz: kein Fehlerfenster alle 30 s, nur Hinweis „letzter Stand“.
      if (e instanceof KebaError && e.kind === 'network' && snapshotRef.current) {
        setOffline(true);
        return;
      }
      handleError(e);
    } finally {
      refreshing.current = false;
    }
  }, [handleError]);

  const closeModbus = useCallback(() => {
    modbusClient.current?.close();
    modbusClient.current = null;
  }, []);

  const start = useCallback(
    async (next: KebaTransport) => {
      client.current = next;
      setError(undefined);
      if (!snapshotRef.current) {
        setProgress('Lade Daten …');
        setPhase('loading');
      }
      await refresh();
    },
    [refresh],
  );

  const connect = useCallback(
    async (settings: Settings) => {
      settingsRef.current = settings;
      snapshotRef.current = undefined;
      setSnapshot(undefined);
      setError(undefined);

      closeModbus();
      if (settings.mode === 'remote') {
        startRemote(settings);
        return;
      }

      if (settings.mode === 'modbus') {
        setRemoteStage('idle');
        bridge.reset();
        const host = settings.modbusAddress.trim().replace(/^[a-z]+:\/\//i, '').replace(/[:/].*$/, '');
        if (!host) {
          fail('Bitte die IP-Adresse der Wärmepumpe eintragen (z. B. 192.168.0.100).');
          return;
        }
        const factory = isModbusAvailable() ? await loadSocketFactory() : undefined;
        if (!factory) {
          fail(
            'Modbus braucht die eigene App-Version – in Expo Go/Snack gibt es keine TCP-Verbindungen. ' +
              'Zum Testen in Snack in den Einstellungen „Fernzugriff“ wählen.',
          );
          return;
        }
        const mb = new ModbusTcpClient(factory, host, 502, 1);
        modbusClient.current = mb;
        await start(new ModbusTransport(mb, { circuitNames: circuitNameList(settings) }));
      }
    },
    [bridge, closeModbus, fail, start, startRemote],
  );

  const cancelRemoteLogin = useCallback(() => {
    setRemoteStage('idle');
    setLoginNotice(undefined);
    if (!snapshotRef.current) setPhase('notConnected');
  }, []);

  const onHmiReached = useCallback(() => {
    setRemoteStage('connected');
    setLoginNotice(undefined);
    setPortalScript(undefined);
    void start(new KebaClient(bridge.post));
  }, [bridge, start]);

  const onHmiLeft = useCallback(() => {
    // Die HMI-Seite wurde verlassen (z. B. Weiterleitung zum Login) → Tunnel ist weg.
    bridge.reset('Die Sitzung ist abgelaufen.');
    client.current = null;
    handleError(new KebaError('sessionExpired', 'Die Sitzung ist abgelaufen.'));
  }, [bridge, handleError]);

  const revealPortal = useCallback((notice: string) => {
    setLoginNotice(notice);
    setRemoteStage((stage) => (stage === 'auto' ? 'login' : stage));
  }, []);

  const onPortalMessage = useCallback(
    (message: PortalMessage) => {
      if ('step' in message) {
        if (message.step === 'alive') {
          if (message.info) addDiagnostic(`Seite: ${message.info}`);
          setProgress((p) => (p === portalStepLabel(undefined) ? portalStepLabel('alive') : p));
        } else {
          addDiagnostic(`Schritt: ${message.step}`);
          setProgress(portalStepLabel(message.step));
        }
        return;
      }
      addDiagnostic(`Abbruch: ${message.error} ${message.detail ?? ''}`);
      if (message.error === 'loginFailed') {
        revealPortal('Anmeldung fehlgeschlagen – bitte Benutzername und Passwort in den Einstellungen prüfen oder hier von Hand anmelden.');
      } else {
        // Das Portal sieht anders aus als erwartet → Seite zeigen, damit man es von Hand machen kann.
        revealPortal('Die automatische Anmeldung hat nicht geklappt. Bitte einmal von Hand „WebHmi“ → „WWW“ antippen.');
      }
    },
    [addDiagnostic, revealPortal],
  );

  const perform = useCallback(
    async (action: (client: KebaTransport) => Promise<void>) => {
      if (!client.current) return;
      setWriting(true);
      try {
        await action(client.current);
        // Der Regler übernimmt neue Sollwerte nicht sofort in alle abgeleiteten Werte.
        await wait(700);
        await refresh();
      } catch (e) {
        handleError(e);
      } finally {
        setWriting(false);
      }
    },
    [handleError, refresh],
  );

  const disconnect = useCallback(() => {
    bridge.reset();
    closeModbus();
    client.current = null;
    settingsRef.current = null;
    snapshotRef.current = undefined;
    setSnapshot(undefined);
    setRemoteStage('idle');
    setPhase('notConnected');
  }, [bridge, closeModbus]);

  const canWrite = useCallback((name: string) => {
    const transport = client.current;
    return transport instanceof ModbusTransport ? transport.canWrite(name) : true;
  }, []);

  const clearTransientError = useCallback(() => setTransientError(undefined), []);

  const value = useMemo<HeatingContextValue>(
    () => ({
      phase,
      snapshot,
      error,
      progress,
      loginNotice,
      diagnostics,
      transientError,
      writing,
      offline,
      remoteStage,
      remoteSession,
      portalScript,
      bridge,
      canWrite,
      connect,
      cancelRemoteLogin,
      onHmiReached,
      onHmiLeft,
      onPortalMessage,
      revealPortal,
      addDiagnostic,
      refresh,
      perform,
      disconnect,
      clearTransientError,
    }),
    [phase, snapshot, error, progress, loginNotice, diagnostics, transientError, writing, offline, remoteStage,
      remoteSession, portalScript, bridge, canWrite, connect, cancelRemoteLogin, onHmiReached, onHmiLeft, onPortalMessage,
      revealPortal, addDiagnostic, refresh, perform, disconnect, clearTransientError],
  );

  return <HeatingContext.Provider value={value}>{children}</HeatingContext.Provider>;
}
