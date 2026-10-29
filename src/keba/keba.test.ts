/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';

import { WebViewBridge, buildFetchScript, hmiBaseUrl } from './bridge';
import { KebaClient, KebaError, RawPost, formatNumber, normalizeLocalAddress, parseVariables, validate } from './client';
import { commands, loadSnapshot } from './service';

const P = 'APPL.CtrlAppl.sParam';

test('liest Antworten mit Attributen und Zahlenwerten', () => {
  const vars = parseVariables(
    JSON.stringify([
      {
        name: `${P}.outdoorTemp.values.actValue`,
        attributes: { formatId: 'fmtTemp', lowerLimit: '-100', unitId: 'Temp', upperLimit: '100' },
        value: '10.808357',
      },
      { name: 'a', value: 3 },
      { name: 'b', value: false },
    ]),
  );
  assert.equal(vars[0].value, '10.808357');
  assert.equal(vars[0].attributes?.lowerLimit, '-100');
  assert.deepEqual(vars.slice(1).map((v) => v.value), ['3', 'false']);
  assert.equal(parseVariables('{"name":"x","value":"de"}')[0].value, 'de');
});

test('HTML-Antwort bedeutet abgelaufene Sitzung', () => {
  const kind = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return (e as KebaError).kind;
    }
  };
  assert.equal(kind(() => validate({ status: 200, contentType: 'text/html', body: '<html>' })), 'sessionExpired');
  assert.equal(kind(() => validate({ status: 200, contentType: null, body: '  <!DOCTYPE' })), 'sessionExpired');
  assert.equal(kind(() => validate({ status: 401, contentType: null, body: '' })), 'unauthorized');
  assert.equal(kind(() => validate({ status: 500, contentType: 'application/json', body: '{"developerMessage":"x"}' })), 'server');
});

test('Zahlen und Adressen werden wie in der HMI formatiert', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(0.5), '0.5');
  assert.equal(formatNumber(-1.5), '-1.5');
  assert.equal(formatNumber(0.1 + 0.2), '0.3');
  assert.equal(normalizeLocalAddress(' 192.168.1.50 '), 'http://192.168.1.50');
  assert.equal(normalizeLocalAddress('http://heizung.local/foo'), 'http://heizung.local');
  assert.equal(normalizeLocalAddress(''), undefined);
});

test('erkennt die HMI-Adresse des Fernzugriffs', () => {
  assert.equal(hmiBaseUrl('https://remote.keba.com:58841/'), 'https://remote.keba.com:58841');
  assert.equal(hmiBaseUrl('https://remote.keba.com:59238'), 'https://remote.keba.com:59238');
  assert.equal(hmiBaseUrl('https://remote.keba.com/app/cgi/main.cgi'), undefined);
  assert.equal(hmiBaseUrl('https://evil.example:1234/remote.keba.com:5'), undefined);
});

test('Client sendet dasselbe Format wie die HMI', async () => {
  const calls: { path: string; body: unknown }[] = [];
  const post: RawPost = async (path, body) => {
    calls.push({ path, body: JSON.parse(body) });
    return { status: 200, contentType: 'application/json', body: '[]' };
  };
  const client = new KebaClient(post);
  await client.read(['x', 'y'], true);
  await commands.setOffset(client, 0, 0.5);
  assert.deepEqual(calls, [
    { path: '/var/readWriteVars?languageCode=de', body: [{ name: 'x', attr: '1' }, { name: 'y', attr: '1' }] },
    { path: '/var/readWriteVars?action=set', body: [{ name: `${P}.heatCircuit[0].param.offsetRoomTemp`, value: '0.5' }] },
  ]);
});

test('baut den Anlagenzustand zusammen', async () => {
  const state: Record<string, string> = {
    [`${P}.options.systemNumberOfHeatingCircuits`]: '2',
    [`${P}.options.systemNumberOfHotWaterTanks`]: '1',
    [`${P}.outdoorTemp.values.actValue`]: '11.6',
    [`${P}.param.operatingMode`]: '2',
    [`${P}.heatCircuit[0].param.name`]: 'Puffer FBH',
    [`${P}.heatCircuit[0].values.setValue`]: '22.0',
    [`${P}.heatCircuit[0].param.offsetRoomTemp`]: '0.5',
    [`${P}.options.heatCircuit[0].hasRoomTemp`]: 'false',
    [`${P}.heatCircuit[0].tempRoom.values.actValue`]: '-99',
    [`${P}.heatCircuit[1].param.name`]: 'Heizkörper',
    [`${P}.hotWaterTank[0].topTemp.values.actValue`]: '47.1',
    [`${P}.hotWaterTank[0].param.normalSetTempMax.value`]: '50',
    [`${P}.hotWaterTank[0].param.operatingMode`]: '1',
  };
  const post: RawPost = async (_path, body) => {
    const requested = JSON.parse(body) as { name: string; attr?: string }[];
    const out = requested
      .filter((r) => r.name in state)
      .map((r) => ({
        name: r.name,
        value: state[r.name],
        ...(r.attr && r.name.endsWith('offsetRoomTemp') ? { attributes: { lowerLimit: '-5', upperLimit: '5' } } : {}),
      }));
    return { status: 200, contentType: 'application/json', body: JSON.stringify(out) };
  };
  const s = await loadSnapshot(new KebaClient(post));
  assert.equal(s.outdoorTemperature, 11.6);
  assert.equal(s.systemOperatingMode, 2);
  assert.deepEqual(s.heatCircuits.map((c) => c.name), ['Puffer FBH', 'Heizkörper']);
  assert.equal(s.heatCircuits[0].currentSetTemperature, 22);
  assert.deepEqual(s.heatCircuits[0].offset, { value: 0.5, range: { min: -5, max: 5 } });
  assert.equal(s.heatCircuits[0].roomTemperature, undefined, 'ohne Raumfühler keine Raumtemperatur');
  assert.equal(s.hotWaterTanks[0].name, 'Warmwasser');
  assert.equal(s.hotWaterTanks[0].temperature, 47.1);
  assert.equal(s.hotWaterTanks[0].operatingMode, 1);
});

test('Bridge: injiziertes Skript ruft fetch auf und meldet die Antwort zurück', async () => {
  const bridge = new WebViewBridge(1000);
  let fetched: { url: string; init: { body: string; credentials: string } } | undefined;
  // Simuliert die HMI-Seite in der WebView.
  const page = {
    fetch: async (url: string, init: { body: string; credentials: string }) => {
      fetched = { url, init };
      return { status: 200, headers: { get: () => 'application/json' }, text: async () => '[{"name":"x","value":"1"}]' };
    },
    ReactNativeWebView: { postMessage: (data: string) => bridge.handleMessage(data) },
  };
  const context = vm.createContext({ ...page, window: page, JSON, String });
  bridge.attach({ injectJavaScript: (script) => vm.runInContext(script, context) });

  const response = await bridge.post('/var/readWriteVars?languageCode=de', '[{"name":"x"}]');
  assert.equal(response.body, '[{"name":"x","value":"1"}]');
  assert.equal(fetched?.url, '/var/readWriteVars?languageCode=de');
  assert.equal(fetched?.init.body, '[{"name":"x"}]');
  assert.equal(fetched?.init.credentials, 'include');
  assert.equal(bridge.handleMessage('kein json'), false);
});

test('Bridge: Zeitüberschreitung und fehlende WebView', async () => {
  const bridge = new WebViewBridge(20);
  await assert.rejects(bridge.post('/x', ''), (e: KebaError) => e.kind === 'sessionExpired');
  bridge.attach({ injectJavaScript: () => {} });
  await assert.rejects(bridge.post('/x', ''), (e: KebaError) => e.kind === 'network');
  assert.match(buildFetchScript('a', '/p', '"quote"'), /body: "\\"quote\\""/);
});
