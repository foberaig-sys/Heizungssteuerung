// Sucht den Regler im Heimnetz: fragt jede Adresse eines /24-Netzes (z. B. 192.168.0.1–254) einmal
// nach der Außentemperatur. Nur der KEBA-Regler antwortet darauf mit dem passenden JSON.
import { KebaClient, directPost } from './client';
import { KebaVar } from './variables';

export interface FoundController {
  url: string;
  outdoorTemperature?: number;
}

/** Ports, auf denen die WebHMI erfahrungsgemäß läuft. */
export const DEFAULT_PORTS = [80, 8080];

/** "192.168.0.100" oder "http://192.168.0.100:80" → "192.168.0" */
export function subnetPrefix(address: string): string | undefined {
  const match = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}/.exec(address);
  if (!match) return undefined;
  const parts = match.slice(1, 4).map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts.join('.') : undefined;
}

export function candidateUrls(prefix: string, ports = DEFAULT_PORTS): string[] {
  const urls: string[] = [];
  for (const port of ports) {
    for (let host = 1; host <= 254; host++) {
      urls.push(port === 80 ? `http://${prefix}.${host}` : `http://${prefix}.${host}:${port}`);
    }
  }
  return urls;
}

/** Prüft, ob unter `url` ein KEBA-Regler antwortet. */
export async function probeController(url: string, timeoutMs = 2000): Promise<FoundController | undefined> {
  try {
    const values = await new KebaClient(directPost(url, undefined, timeoutMs)).read([KebaVar.outdoorTemperature]);
    const variable = values[KebaVar.outdoorTemperature];
    if (!variable) return undefined;
    const temperature = Number(variable.value);
    return { url, outdoorTemperature: Number.isFinite(temperature) ? temperature : undefined };
  } catch {
    return undefined;
  }
}

export interface ScanOptions {
  ports?: number[];
  concurrency?: number;
  timeoutMs?: number;
  onProgress?: (done: number, total: number) => void;
  /** Bei true bricht die Suche ab. */
  isCancelled?: () => boolean;
  probe?: (url: string, timeoutMs: number) => Promise<FoundController | undefined>;
}

/** Durchsucht das Netz und liefert alle gefundenen Regler (meist genau einer). */
export async function scanForControllers(prefix: string, options: ScanOptions = {}): Promise<FoundController[]> {
  const { ports = DEFAULT_PORTS, concurrency = 32, timeoutMs = 2000, onProgress, isCancelled } = options;
  const probe = options.probe ?? probeController;
  const urls = candidateUrls(prefix, ports);
  const found: FoundController[] = [];
  let next = 0;
  let done = 0;

  const worker = async () => {
    while (next < urls.length && !isCancelled?.()) {
      const url = urls[next++];
      const result = await probe(url, timeoutMs);
      if (result) found.push(result);
      done++;
      onProgress?.(done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return found;
}
