// Minimaler Modbus-TCP-Client (Funktion 3 „Read Holding Registers“ und 6 „Write Single Register“).
// Unabhängig von der Socket-Bibliothek: In der App steckt react-native-tcp-socket dahinter, in den
// Tests node:net.

export interface ByteSocket {
  write(data: Uint8Array): unknown;
  on(event: 'data', listener: (data: Uint8Array | string) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'close', listener: () => void): unknown;
  destroy(): unknown;
}

/** Baut eine Verbindung auf und ruft `onConnect`, sobald sie steht. */
export type SocketFactory = (host: string, port: number, onConnect: () => void) => ByteSocket;

export class ModbusError extends Error {
  constructor(
    message: string,
    public kind: 'connection' | 'timeout' | 'exception',
    public exceptionCode?: number,
  ) {
    super(message);
    this.name = 'ModbusError';
  }
}

const READ_HOLDING = 3;
const WRITE_SINGLE = 6;
/** Modbus erlaubt bis 125 Register pro Leseanfrage. */
export const MAX_READ = 120;

interface Pending {
  transaction: number;
  resolve: (pdu: Uint8Array) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ModbusTcpClient {
  private socket: ByteSocket | null = null;
  private connecting: Promise<void> | null = null;
  private buffer = new Uint8Array(0);
  private pending: Pending | null = null;
  private transaction = 0;
  /** Anfragen laufen nacheinander – der Regler mag keine parallelen Anfragen auf einer Verbindung. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private factory: SocketFactory,
    private host: string,
    private port = 502,
    private unit = 1,
    private timeoutMs = 4000,
  ) {}

  readHolding(address: number, count: number): Promise<number[]> {
    if (count < 1 || count > 125) throw new RangeError(`Ungültige Anzahl ${count}`);
    return this.enqueue(async () => {
      const pdu = await this.request([READ_HOLDING, address >> 8, address & 0xff, count >> 8, count & 0xff]);
      const byteCount = pdu[1];
      const values: number[] = [];
      for (let i = 0; i < byteCount / 2; i++) values.push((pdu[2 + 2 * i] << 8) | pdu[3 + 2 * i]);
      return values;
    });
  }

  writeSingle(address: number, value: number): Promise<void> {
    const v = value & 0xffff;
    return this.enqueue(async () => {
      await this.request([WRITE_SINGLE, address >> 8, address & 0xff, v >> 8, v & 0xff]);
    });
  }

  close() {
    this.failPending(new ModbusError('Verbindung geschlossen', 'connection'));
    this.socket?.destroy();
    this.socket = null;
    this.connecting = null;
  }

  // MARK: Intern

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private connect(): Promise<void> {
    if (this.socket && !this.connecting) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.buffer = new Uint8Array(0);
    this.connecting = new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.close();
        reject(new ModbusError(`Keine Antwort von ${this.host}:${this.port}`, 'timeout'));
      }, this.timeoutMs);
      const socket = this.factory(this.host, this.port, () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.connecting = null;
        resolve();
      });
      this.socket = socket;
      socket.on('data', (data) => this.onData(data));
      socket.on('error', (error) => {
        const wrapped = new ModbusError(`Verbindung zu ${this.host}:${this.port} fehlgeschlagen: ${error.message}`, 'connection');
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(wrapped);
        }
        this.dropSocket(socket, wrapped);
      });
      socket.on('close', () => this.dropSocket(socket, new ModbusError('Verbindung vom Regler geschlossen', 'connection')));
    });
    return this.connecting;
  }

  private dropSocket(socket: ByteSocket, error: Error) {
    if (this.socket !== socket) return;
    this.socket = null;
    this.connecting = null;
    this.failPending(error);
  }

  private async request(pdu: number[]): Promise<Uint8Array> {
    await this.connect();
    const socket = this.socket;
    if (!socket) throw new ModbusError('Keine Verbindung', 'connection');
    this.transaction = (this.transaction + 1) & 0xffff;
    const tid = this.transaction;
    const length = pdu.length + 1;
    const frame = new Uint8Array([tid >> 8, tid & 0xff, 0, 0, length >> 8, length & 0xff, this.unit, ...pdu]);

    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        // Nach einer Zeitüberschreitung ist der Datenstrom nicht mehr sicher zuzuordnen → neu verbinden.
        this.close();
        reject(new ModbusError('Der Regler antwortet nicht (Zeitüberschreitung)', 'timeout'));
      }, this.timeoutMs);
      this.pending = {
        transaction: tid,
        timer,
        reject,
        resolve: (response) => {
          if (response[0] & 0x80) {
            reject(new ModbusError(`Regler meldet Modbus-Ausnahme ${response[1]}`, 'exception', response[1]));
          } else {
            resolve(response);
          }
        },
      };
      socket.write(frame);
    });
  }

  private onData(data: Uint8Array | string) {
    const chunk = typeof data === 'string' ? latin1Bytes(data) : data;
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;

    // MBAP-Kopf: Transaktion(2) Protokoll(2) Länge(2) Unit(1), danach Länge-1 Bytes PDU.
    while (this.buffer.length >= 7) {
      const length = (this.buffer[4] << 8) | this.buffer[5];
      if (this.buffer.length < 6 + length) return;
      const tid = (this.buffer[0] << 8) | this.buffer[1];
      const pdu = this.buffer.slice(7, 6 + length);
      this.buffer = this.buffer.slice(6 + length);
      const pending = this.pending;
      if (pending && pending.transaction === tid) {
        this.pending = null;
        clearTimeout(pending.timer);
        pending.resolve(pdu);
      }
    }
  }

  private failPending(error: Error) {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.reject(error);
  }
}

function latin1Bytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

export const toSigned16 = (v: number) => (v >= 0x8000 ? v - 0x10000 : v);
