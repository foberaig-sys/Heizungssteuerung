// Fernzugriff über remote.keba.com: Die Secomea-Sitzung lebt in Cookies der WebView, an die
// React Native nicht herankommt. Deshalb laufen die API-Aufrufe *in* der (unsichtbaren) WebView,
// die die HMI geöffnet hat, und die Antworten kommen per postMessage zurück.
import type { RawPost, RawResponse } from './client';
import { KebaError } from './client';

export const REMOTE_PORTAL_URL = 'https://remote.keba.com/app';

/** `https://remote.keba.com:58841/...` → `https://remote.keba.com:58841` */
export function hmiBaseUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const match = /^https:\/\/([a-z0-9.-]*keba\.com):(\d+)(?:[/?#]|$)/i.exec(url);
  if (!match || match[2] === '443') return undefined;
  return `https://${match[1].toLowerCase()}:${match[2]}`;
}

interface Pending {
  resolve: (response: RawResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface Injectable {
  injectJavaScript: (script: string) => void;
}

export class WebViewBridge {
  private webView: Injectable | null = null;
  private pending = new Map<string, Pending>();
  private counter = 0;

  constructor(private timeoutMs = 20000) {}

  attach(webView: Injectable | null) {
    this.webView = webView;
  }

  /** Bricht offene Anfragen ab, z. B. wenn die HMI-Seite verlassen wurde. */
  reset(reason = 'Verbindung getrennt') {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new KebaError('sessionExpired', reason));
      this.pending.delete(id);
    }
  }

  post: RawPost = (path, body) =>
    new Promise<RawResponse>((resolve, reject) => {
      if (!this.webView) {
        reject(new KebaError('sessionExpired', 'Fernzugriff ist nicht verbunden.'));
        return;
      }
      const id = `keba-${++this.counter}`;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new KebaError('network', 'Der Fernzugriff antwortet nicht (Zeitüberschreitung).'));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.webView.injectJavaScript(buildFetchScript(id, path, body));
    });

  /** An `onMessage` der WebView hängen. Gibt true zurück, wenn die Nachricht von der Bridge kam. */
  handleMessage(data: string): boolean {
    let message: BridgeMessage;
    try {
      message = JSON.parse(data);
    } catch {
      return false;
    }
    if (typeof message?.kebaId !== 'string') return false;
    const p = this.pending.get(message.kebaId);
    if (!p) return true;
    this.pending.delete(message.kebaId);
    clearTimeout(p.timer);
    if (message.error !== undefined) {
      p.reject(new KebaError('network', `Fernzugriff: ${message.error}`));
    } else {
      p.resolve({ status: message.status ?? 0, contentType: message.contentType ?? null, body: message.body ?? '' });
    }
    return true;
  }
}

interface BridgeMessage {
  kebaId?: string;
  status?: number;
  contentType?: string | null;
  body?: string;
  error?: string;
}

/** Same-Origin-fetch innerhalb der HMI-Seite; Cookies schickt der Browser selbst mit. */
export function buildFetchScript(id: string, path: string, body: string): string {
  return `(function(){
  var id = ${JSON.stringify(id)};
  function send(m){ m.kebaId = id; window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  fetch(${JSON.stringify(path)}, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Accept': '*/*' },
    body: ${JSON.stringify(body)}
  }).then(function(r){
    return r.text().then(function(t){ send({ status: r.status, contentType: r.headers.get('content-type'), body: t }); });
  }).catch(function(e){ send({ error: String(e) }); });
})(); true;`;
}
