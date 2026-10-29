// Spricht dieselbe JSON-Schnittstelle an wie die WebHMI im Browser (siehe docs/API.md).

export interface KebaAttributes {
  formatId?: string;
  longText?: string;
  unitId?: string;
  lowerLimit?: string;
  upperLimit?: string;
}

/** Ein Eintrag aus der Antwort von /var/readWriteVars. Werte kommen immer als String. */
export interface KebaVariable {
  name: string;
  value: string;
  attributes?: KebaAttributes;
}

export interface KebaWrite {
  name: string;
  value: string;
}

export interface RawResponse {
  status: number;
  contentType: string | null;
  body: string;
}

/** Schickt einen POST an den Regler. `path` beginnt mit "/" und enthält die Query. */
export type RawPost = (path: string, body: string) => Promise<RawResponse>;

export type KebaErrorKind = 'unauthorized' | 'sessionExpired' | 'server' | 'http' | 'invalidResponse' | 'network';

export class KebaError extends Error {
  constructor(public kind: KebaErrorKind, message: string) {
    super(message);
    this.name = 'KebaError';
  }
}

export class KebaClient {
  /** Die HMI fragt maximal ~25 Variablen pro Request ab; wir bleiben in der Größenordnung. */
  private batchSize = 30;

  constructor(private post: RawPost, private languageCode = 'de') {}

  async read(names: string[], withAttributes = false): Promise<Record<string, KebaVariable>> {
    const result: Record<string, KebaVariable> = {};
    for (let start = 0; start < names.length; start += this.batchSize) {
      const chunk = names.slice(start, start + this.batchSize);
      const payload = chunk.map((name) => (withAttributes ? { name, attr: '1' } : { name }));
      const response = await this.post(`/var/readWriteVars?languageCode=${this.languageCode}`, JSON.stringify(payload));
      for (const variable of parseVariables(validate(response))) {
        result[variable.name] = variable;
      }
    }
    return result;
  }

  async write(values: KebaWrite[]): Promise<void> {
    if (values.length === 0) return;
    validate(await this.post('/var/readWriteVars?action=set', JSON.stringify(values)));
  }
}

export function validate(response: RawResponse): string {
  const { status, contentType, body } = response;
  if (status === 401) {
    throw new KebaError('unauthorized', 'Benutzername oder Passwort falsch.');
  }
  if ((contentType ?? '').toLowerCase().includes('text/html') || body.trimStart().startsWith('<')) {
    // Statt JSON kam eine HTML-Seite, meist ist der Fernzugriffstunnel abgelaufen.
    throw new KebaError('sessionExpired', 'Die Sitzung ist abgelaufen. Bitte neu verbinden.');
  }
  if (status === 500) {
    const message = developerMessage(body);
    if (message) throw new KebaError('server', `Der Regler meldet einen Fehler: ${message}`);
  }
  if (status < 200 || status >= 300) {
    throw new KebaError('http', `Unerwartete Antwort vom Regler (HTTP ${status}).`);
  }
  return body;
}

export function parseVariables(body: string): KebaVariable[] {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new KebaError('invalidResponse', `Antwort konnte nicht gelesen werden: ${body.slice(0, 120)}`);
  }
  // Einzelabfragen ({"name": ...}) liefern evtl. ein Objekt statt einer Liste.
  const items = Array.isArray(json) ? json : [json];
  return items
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && 'name' in item)
    .map((item) => ({
      name: String(item.name),
      value: stringify(item.value),
      attributes: parseAttributes(item.attributes),
    }));
}

function parseAttributes(raw: unknown): KebaAttributes | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const a = raw as Record<string, unknown>;
  const pick = (key: string) => (a[key] === undefined || a[key] === null ? undefined : stringify(a[key]));
  return {
    formatId: pick('formatId'),
    longText: pick('longText'),
    unitId: pick('unitId'),
    lowerLimit: pick('lowerLimit'),
    upperLimit: pick('upperLimit'),
  };
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value : String(value);
}

function developerMessage(body: string): string | undefined {
  try {
    const json = JSON.parse(body);
    return typeof json?.developerMessage === 'string' ? json.developerMessage : undefined;
  } catch {
    return undefined;
  }
}

// MARK: Werte umwandeln

export function toNumber(v: KebaVariable | undefined): number | undefined {
  if (!v || v.value.trim() === '') return undefined;
  const n = Number(v.value);
  return Number.isFinite(n) ? n : undefined;
}

export function toInt(v: KebaVariable | undefined): number | undefined {
  const n = toNumber(v);
  return n === undefined ? undefined : Math.round(n);
}

export function toBool(v: KebaVariable | undefined): boolean | undefined {
  switch (v?.value.toLowerCase()) {
    case 'true':
    case '1':
      return true;
    case 'false':
    case '0':
      return false;
    default:
      return undefined;
  }
}

export interface Range {
  min: number;
  max: number;
}

export function toRange(attributes: KebaAttributes | undefined): Range | undefined {
  const min = Number(attributes?.lowerLimit);
  const max = Number(attributes?.upperLimit);
  if (attributes?.lowerLimit === undefined || attributes?.upperLimit === undefined) return undefined;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return undefined;
  return { min, max };
}

/** Zahlen so schreiben, wie die HMI es tut: "0", "0.5", "22.5". */
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

// MARK: Transport ohne WebView (Heimnetz / eigenes VPN)

export function directPost(baseUrl: string, auth?: { username: string; password: string }, timeoutMs = 15000): RawPost {
  const base = baseUrl.replace(/\/+$/, '');
  return async (path, body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: '*/*',
    };
    if (auth?.username) {
      headers.Authorization = `Basic ${base64(`${auth.username}:${auth.password}`)}`;
    }
    try {
      const response = await fetch(base + path, { method: 'POST', headers, body, signal: controller.signal });
      return { status: response.status, contentType: response.headers.get('content-type'), body: await response.text() };
    } catch (error) {
      const aborted = (error as { name?: string })?.name === 'AbortError';
      throw new KebaError('network', aborted ? 'Der Regler antwortet nicht (Zeitüberschreitung).' : 'Regler nicht erreichbar. Bist du im richtigen WLAN?');
    } finally {
      clearTimeout(timer);
    }
  };
}

function base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

/** "192.168.1.50" → "http://192.168.1.50" */
export function normalizeLocalAddress(address: string): string | undefined {
  let text = address.trim();
  if (!text) return undefined;
  if (!text.includes('://')) text = `http://${text}`;
  const match = /^(https?):\/\/([^/\s]+)/i.exec(text);
  return match ? `${match[1].toLowerCase()}://${match[2]}` : undefined;
}
