/// <reference types="node" />
import assert from 'node:assert/strict';
import { Server, Socket, createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

import { commands, loadSnapshot } from '../keba/service';
import { ModbusTcpClient, SocketFactory } from './modbusClient';
import { ModbusTransport, groupAddresses } from './modbusTransport';

/** Nachbau des Reglers mit den Werten aus dem echten Scan. Register 403 ist schreibgeschützt. */
function fakeController(registers: Map<number, number>, options: { splitFrames?: boolean } = {}) {
  const writes: [number, number][] = [];
  const server: Server = createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 7) {
        const length = buffer.readUInt16BE(4);
        if (buffer.length < 6 + length) return;
        const frame = buffer.subarray(0, 6 + length);
        buffer = buffer.subarray(6 + length);
        const tid = frame.readUInt16BE(0);
        const fn = frame[7];
        const address = frame.readUInt16BE(8);
        const arg = frame.readUInt16BE(10);
        let pdu: Buffer;
        if (fn === 3) {
          pdu = Buffer.alloc(2 + arg * 2);
          pdu[0] = 3;
          pdu[1] = arg * 2;
          for (let i = 0; i < arg; i++) pdu.writeUInt16BE(registers.get(address + i) ?? 0, 2 + 2 * i);
        } else if (fn === 6 && address !== 403) {
          registers.set(address, arg);
          writes.push([address, arg]);
          pdu = frame.subarray(7, 12);
        } else {
          pdu = Buffer.from([fn | 0x80, 2]);
        }
        const header = Buffer.alloc(7);
        header.writeUInt16BE(tid, 0);
        header.writeUInt16BE(pdu.length + 1, 4);
        header[6] = frame[6];
        const response = Buffer.concat([header, pdu]);
        if (options.splitFrames) {
          // Antwort in Häppchen schicken – der Client muss sie wieder zusammensetzen.
          socket.write(response.subarray(0, 3));
          setTimeout(() => socket.write(response.subarray(3)), 5);
        } else {
          socket.write(response);
        }
      }
    });
  });
  return new Promise<{ port: number; writes: [number, number][]; close: () => void }>((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ port: (server.address() as AddressInfo).port, writes, close: () => server.close() }),
    ),
  );
}

const nodeFactory: SocketFactory = (host, port, onConnect) => new Socket().connect(port, host, onConnect);

const scanValues = () =>
  new Map<number, number>([
    [2, 220], [3, 220], [4, 220], [5, 195], [7, 1], [8, 1],
    [52, 210], [53, 210], [54, 210], [55, 185], [57, 1], [58, 0],
    [401, 476], [402, 480], [403, 1],
  ]);

test('fasst Register zu wenigen Leseblöcken zusammen', () => {
  assert.deepEqual(groupAddresses([5, 2, 4, 52, 55, 401, 402, 403]), [
    { start: 2, count: 4 },
    { start: 52, count: 4 },
    { start: 401, count: 3 },
  ]);
  assert.deepEqual(groupAddresses([0, 10, 20]), [{ start: 0, count: 21 }]);
});

test('Modbus-Client liest und schreibt, auch bei zerstückelten Antworten', async () => {
  const registers = scanValues();
  const controller = await fakeController(registers, { splitFrames: true });
  const client = new ModbusTcpClient(nodeFactory, '127.0.0.1', controller.port);
  try {
    assert.deepEqual(await client.readHolding(2, 4), [220, 220, 220, 195]);
    await client.writeSingle(402, 490);
    assert.deepEqual(await client.readHolding(401, 3), [476, 490, 1]);
    // Parallele Aufrufe werden nacheinander abgearbeitet.
    const [a, b] = await Promise.all([client.readHolding(4, 1), client.readHolding(54, 1)]);
    assert.deepEqual([a, b], [[220], [210]]);
    await assert.rejects(client.writeSingle(403, 2), /Ausnahme 2/);
  } finally {
    client.close();
    controller.close();
  }
});

test('Heizungs-Zustand kommt über Modbus wie über die WebHMI', async () => {
  const controller = await fakeController(scanValues());
  const client = new ModbusTcpClient(nodeFactory, '127.0.0.1', controller.port);
  const transport = new ModbusTransport(client, { circuitNames: ['Puffer FBH', 'Heizkörper'] });
  try {
    const s = await loadSnapshot(transport);
    assert.deepEqual(s.heatCircuits.map((c) => c.name), ['Puffer FBH', 'Heizkörper']);
    assert.equal(s.heatCircuits[0].currentSetTemperature, 22);
    assert.deepEqual(s.heatCircuits[0].normalSetTemperature, { value: 22, range: { min: 10, max: 30 } });
    assert.deepEqual(s.heatCircuits[0].reducedSetTemperature, { value: 19.5, range: { min: 10, max: 30 } });
    assert.equal(s.heatCircuits[0].operatingMode, 1);
    assert.equal(s.heatCircuits[0].heatRequest, true);
    assert.equal(s.heatCircuits[1].heatRequest, false);
    assert.equal(s.heatCircuits[1].reducedSetTemperature?.value, 18.5);
    assert.equal(s.heatCircuits[0].roomTemperature, undefined);
    assert.equal(s.hotWaterTanks[0].temperature, 47.6);
    assert.deepEqual(s.hotWaterTanks[0].setTemperature, { value: 48, range: { min: 30, max: 60 } });

    await commands.setNormalTemperature(transport, 0, 22.5);
    await commands.setHotWaterTemperature(transport, 0, 49);
    assert.deepEqual(controller.writes, [[4, 225], [402, 490]]);

    // Nicht bestätigte oder unsinnige Werte werden gar nicht erst geschickt.
    await assert.rejects(commands.setHeatCircuitMode(transport, 0, 2), /nicht freigeschaltet/);
    await assert.rejects(commands.setHotWaterTemperature(transport, 0, 75), /außerhalb/);
    assert.equal(controller.writes.length, 2);
    assert.equal(transport.canWrite('APPL.CtrlAppl.sParam.heatCircuit[0].param.operatingMode'), false);
  } finally {
    client.close();
    controller.close();
  }
});

test('nicht erreichbarer Regler ergibt eine verständliche Meldung', async () => {
  const client = new ModbusTcpClient(nodeFactory, '127.0.0.1', 1, 1, 500);
  const transport = new ModbusTransport(client, { circuitNames: ['A'] });
  await assert.rejects(loadSnapshot(transport), /nicht erreichbar/);
  client.close();
});
