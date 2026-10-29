/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

import { PortalMessage, buildPortalAutomationScript, parsePortalMessage } from './portalAutomation';

/** Nachbau des Secomea-Portals: Login → Geräteliste (zugeklappt) → Geräteseite mit „WWW“. */
function fakePortal() {
  const dom = new JSDOM(
    `<body>
      <div id="login">
        <h2>KEBA_RemoteMaintenance</h2>
        <label>Username:</label><input type="text" id="user">
        <label>Password:</label><input type="password" id="pwd">
        <a href="#" id="loginBtn" class="ui-btn">Login</a>
        <i>Forgot password?</i>
      </div>
      <div id="list" style="display:none">
        <div data-role="collapsible" class="ui-collapsible ui-collapsible-collapsed">
          <h3 class="ui-collapsible-heading ui-collapsible-heading-collapsed">
            <a href="#" class="ui-collapsible-heading-toggle">Oberaigner / Dietach / AHPA413 / Kdnr 225549 (Fernzugriff 2025)</a>
          </h3>
          <div class="ui-collapsible-content" id="content" style="display:none">
            <ul>
              <li><a href="#" id="dev">Oberaigner Dietach AHPA413 [AP440-1]</a></li>
              <li><a href="#" id="full">Oberaigner Dietach AHPA413 Full Access</a></li>
              <li><a href="#" id="hmi">Oberaigner Dietach AHPA413 WebHmi</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div id="device" style="display:none">
        <h1>Oberaigner Dietach AHPA413 WebHmi (Oberaigner Dietach AHPA413)</h1>
        <a href="#" id="www" class="ui-btn"><span>WWW</span></a>
      </div>
    </body>`,
    { runScripts: 'outside-only', url: 'https://remote.keba.com/app/cgi/main.cgi' },
  );
  const w = dom.window;
  const d = w.document;
  const show = (id: string) =>
    ['login', 'list', 'device'].forEach((p) => ((d.getElementById(p) as HTMLElement).style.display = p === id ? '' : 'none'));
  const events: string[] = [];
  let credentials: { user: string; pwd: string } | undefined;

  d.getElementById('loginBtn')!.addEventListener('click', () => {
    credentials = {
      user: (d.getElementById('user') as HTMLInputElement).value,
      pwd: (d.getElementById('pwd') as HTMLInputElement).value,
    };
    events.push('login');
    if (credentials.pwd === 'richtig') show('list');
  });
  d.querySelector('.ui-collapsible-heading-toggle')!.addEventListener('click', () => {
    events.push('expand');
    (d.getElementById('content') as HTMLElement).style.display = '';
    d.querySelector('[data-role=collapsible]')!.classList.remove('ui-collapsible-collapsed');
  });
  for (const id of ['dev', 'full', 'hmi']) {
    d.getElementById(id)!.addEventListener('click', () => {
      events.push(`device:${id}`);
      if (id === 'hmi') show('device');
    });
  }
  d.getElementById('www')!.addEventListener('click', () => events.push('www'));

  // Zeit und Intervall steuern wir selbst.
  let now = 1_000_000;
  let tick: (() => void) | undefined;
  w.Date.now = () => now;
  (w as unknown as { setInterval: (fn: () => void) => number }).setInterval = (fn) => {
    tick = fn;
    return 1;
  };
  (w as unknown as { clearInterval: () => void }).clearInterval = () => {
    tick = undefined;
  };
  const messages: PortalMessage[] = [];
  (w as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {
    postMessage: (data: string) => messages.push(parsePortalMessage(data)!),
  };

  return {
    run: (script: string) => w.eval(script),
    advance: (seconds: number) => {
      for (let i = 0; i < seconds; i++) {
        now += 1000;
        tick?.();
      }
    },
    events,
    messages,
    credentials: () => credentials,
    running: () => tick !== undefined,
  };
}

test('meldet sich an, öffnet die Anlage und tippt auf WWW', () => {
  const portal = fakePortal();
  portal.run(buildPortalAutomationScript({ username: 'oberaigner', password: 'richtig', device: 'WebHmi' }));
  portal.advance(20);

  assert.deepEqual(portal.credentials(), { user: 'oberaigner', pwd: 'richtig' });
  assert.deepEqual(portal.events.slice(0, 4), ['login', 'expand', 'device:hmi', 'www']);
  assert.ok(!portal.events.includes('device:dev') && !portal.events.includes('device:full'), 'nur der WebHmi-Eintrag');
  assert.deepEqual(
    portal.messages.map((m) => ('step' in m ? m.step : m.error)).slice(0, 4),
    ['login', 'expand', 'device', 'www'],
  );
});

test('falsches Passwort wird nach zwei Versuchen gemeldet', () => {
  const portal = fakePortal();
  portal.run(buildPortalAutomationScript({ username: 'x', password: 'falsch', device: 'WebHmi' }));
  portal.advance(30);
  assert.equal(portal.events.filter((e) => e === 'login').length, 2);
  assert.ok(portal.messages.some((m) => 'error' in m && m.error === 'loginFailed'));
  assert.equal(portal.running(), false);
});

test('gibt nach der Zeitgrenze auf', () => {
  const portal = fakePortal();
  portal.run(buildPortalAutomationScript({ username: 'x', password: 'richtig', device: 'GibtsNicht' }, 15));
  portal.advance(20);
  assert.ok(portal.messages.some((m) => 'error' in m && m.error === 'timeout'));
  assert.equal(portal.running(), false);
});

test('Sonderzeichen im Passwort bleiben erhalten', () => {
  const portal = fakePortal();
  const password = `a"b'c\\d</script>`;
  portal.run(buildPortalAutomationScript({ username: 'u', password, device: 'WebHmi' }));
  portal.advance(1);
  assert.equal(portal.credentials()?.pwd, password);
});
