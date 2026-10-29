import { ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { WebViewBridge } from './keba/bridge';
import { KebaClient, KebaError, directPost, normalizeLocalAddress } from './keba/client';
import { HeatingSnapshot, KebaTransport, loadSnapshot } from './keba/service';
import type { Settings } from './settings';

export type Phase = 'notConnected' | 'loading' | 'ready' | 'failed' | 'sessionExpired';

/** Zustand der unsichtbaren WebView für den Fernzugriff. */
export type RemoteStage = 'idle' | 'login' | 'connected';

interface HeatingContextValue {
  phase: Phase;
  snapshot?: HeatingSnapshot;
  error?: string;
  /** Fehler, der auftritt, während schon Daten angezeigt werden (z. B. Schreibfehler). */
  transientError?: string;
  writing: boolean;
  remoteStage: RemoteStage;
  /** Erhöht sich bei jeder neuen Anmeldung, damit die WebView frisch startet. */
  remoteSession: number;
  bridge: WebViewBridge;
  connectLocal: (settings: Settings) => Promise<void>;
  startRemoteLogin: () => void;
  cancelRemoteLogin: () => void;
  onHmiReached: () => void;
  onHmiLeft: () => void;
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

export function HeatingProvider({ children }: { children: ReactNode }) {
  const bridge = useRef(new WebViewBridge()).current;
  const client = useRef<KebaClient | null>(null);
  const refreshing = useRef(false);

  const [phase, setPhase] = useState<Phase>('notConnected');
  const [snapshot, setSnapshot] = useState<HeatingSnapshot>();
  const [error, setError] = useState<string>();
  const [transientError, setTransientError] = useState<string>();
  const [writing, setWriting] = useState(false);
  const [remoteStage, setRemoteStage] = useState<RemoteStage>('idle');
  const [remoteSession, setRemoteSession] = useState(0);
  const snapshotRef = useRef<HeatingSnapshot>(undefined);

  const handleError = useCallback((e: unknown) => {
    const kebaError = e instanceof KebaError ? e : undefined;
    if (kebaError?.kind === 'sessionExpired') {
      setPhase('sessionExpired');
      return;
    }
    const message = e instanceof Error ? e.message : String(e);
    if (snapshotRef.current) {
      setTransientError(message);
    } else {
      setError(message);
      setPhase('failed');
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!client.current || refreshing.current) return;
    refreshing.current = true;
    try {
      const next = await loadSnapshot(client.current);
      snapshotRef.current = next;
      setSnapshot(next);
      setPhase('ready');
    } catch (e) {
      handleError(e);
    } finally {
      refreshing.current = false;
    }
  }, [handleError]);

  const start = useCallback(
    async (next: KebaClient) => {
      client.current = next;
      snapshotRef.current = undefined;
      setSnapshot(undefined);
      setError(undefined);
      setPhase('loading');
      await refresh();
    },
    [refresh],
  );

  const connectLocal = useCallback(
    async (settings: Settings) => {
      const url = normalizeLocalAddress(settings.localAddress);
      if (!url) {
        setError('Bitte die IP-Adresse des Reglers eintragen.');
        setPhase('failed');
        return;
      }
      setRemoteStage('idle');
      bridge.reset();
      const auth = settings.username ? { username: settings.username, password: settings.password } : undefined;
      await start(new KebaClient(directPost(url, auth)));
    },
    [bridge, start],
  );

  const startRemoteLogin = useCallback(() => {
    bridge.reset();
    client.current = null;
    setRemoteSession((n) => n + 1);
    setRemoteStage('login');
  }, [bridge]);

  const cancelRemoteLogin = useCallback(() => {
    setRemoteStage((stage) => (stage === 'login' ? 'idle' : stage));
  }, []);

  const onHmiReached = useCallback(() => {
    setRemoteStage('connected');
    void start(new KebaClient(bridge.post));
  }, [bridge, start]);

  const onHmiLeft = useCallback(() => {
    // Die HMI-Seite wurde verlassen (z. B. Weiterleitung zum Login) → Tunnel ist weg.
    bridge.reset('Die Sitzung ist abgelaufen.');
    client.current = null;
    setRemoteStage('idle');
    setPhase('sessionExpired');
  }, [bridge]);

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
    client.current = null;
    snapshotRef.current = undefined;
    setSnapshot(undefined);
    setRemoteStage('idle');
    setPhase('notConnected');
  }, [bridge]);

  const value = useMemo<HeatingContextValue>(
    () => ({
      phase,
      snapshot,
      error,
      transientError,
      writing,
      remoteStage,
      remoteSession,
      bridge,
      connectLocal,
      startRemoteLogin,
      cancelRemoteLogin,
      onHmiReached,
      onHmiLeft,
      refresh,
      perform,
      disconnect,
      clearTransientError: () => setTransientError(undefined),
    }),
    [phase, snapshot, error, transientError, writing, remoteStage, remoteSession, bridge, connectLocal,
      startRemoteLogin, cancelRemoteLogin, onHmiReached, onHmiLeft, refresh, perform, disconnect],
  );

  return <HeatingContext.Provider value={value}>{children}</HeatingContext.Provider>;
}
