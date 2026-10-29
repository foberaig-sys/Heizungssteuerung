/// <reference types="node" />
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

import { candidateUrls, probeController, scanForControllers, subnetPrefix } from './discovery';

test('leitet das Netz aus einer Adresse ab', () => {
  assert.equal(subnetPrefix('192.168.0.100'), '192.168.0');
  assert.equal(subnetPrefix('http://192.168.178.20:8080'), '192.168.178');
  assert.equal(subnetPrefix('heizung.local'), undefined);
  assert.equal(subnetPrefix('300.1.1.1'), undefined);
});

test('erzeugt Kandidaten für alle Hosts und Ports', () => {
  const urls = candidateUrls('10.0.0', [80, 8080]);
  assert.equal(urls.length, 508);
  assert.equal(urls[0], 'http://10.0.0.1');
  assert.equal(urls[507], 'http://10.0.0.254:8080');
});

test('erkennt einen echten Regler und ignoriert andere Webserver', async () => {
  const controller = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const names = (JSON.parse(body) as { name: string }[]).map((n) => n.name);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(names.map((name) => ({ name, value: '11.6' }))));
    });
  }).listen(0);
  const router = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<html>FRITZ!Box</html>');
  }).listen(0);
  try {
    const port = (s: typeof controller) => (s.address() as AddressInfo).port;
    assert.deepEqual(await probeController(`http://127.0.0.1:${port(controller)}`), {
      url: `http://127.0.0.1:${port(controller)}`,
      outdoorTemperature: 11.6,
    });
    assert.equal(await probeController(`http://127.0.0.1:${port(router)}`), undefined);
    assert.equal(await probeController('http://127.0.0.1:1', 500), undefined);
  } finally {
    controller.close();
    router.close();
  }
});

test('Suche findet den Regler und meldet den Fortschritt', async () => {
  let progress = 0;
  const found = await scanForControllers('192.168.0', {
    ports: [80],
    probe: async (url) => (url === 'http://192.168.0.57' ? { url, outdoorTemperature: 5 } : undefined),
    onProgress: (done) => (progress = done),
  });
  assert.deepEqual(found, [{ url: 'http://192.168.0.57', outdoorTemperature: 5 }]);
  assert.equal(progress, 254);
});
