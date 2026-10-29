// Klickt sich unsichtbar durch das Secomea-Portal (remote.keba.com/app), genau wie man es von Hand tut:
// 1. Benutzername/Passwort eintragen und „Login“,
// 2. Anlagen-Gruppe aufklappen und den Eintrag „… WebHmi“ antippen,
// 3. „WWW“ antippen → der Browser landet auf https://remote.keba.com:<Port> (die HMI).
// Das Skript läuft in der WebView und meldet seinen Fortschritt per postMessage.

export interface PortalCredentials {
  username: string;
  password: string;
  /** Textstück des Geräteeintrags, Standard „WebHmi“. */
  device: string;
}

export type PortalStep = 'login' | 'expand' | 'device' | 'www';

export type PortalMessage =
  | { kebaPortal: true; step: PortalStep }
  | { kebaPortal: true; error: 'loginFailed' | 'timeout'; detail?: string };

export function parsePortalMessage(data: string): PortalMessage | undefined {
  try {
    const message = JSON.parse(data);
    return message?.kebaPortal === true ? (message as PortalMessage) : undefined;
  } catch {
    return undefined;
  }
}

export function portalStepLabel(step: PortalStep | undefined): string {
  switch (step) {
    case 'login':
      return 'Anmelden bei KEBA …';
    case 'expand':
    case 'device':
      return 'Anlage wird gesucht …';
    case 'www':
      return 'Verbindung zur Heizung wird aufgebaut …';
    default:
      return 'Verbinde mit KEBA …';
  }
}

export function buildPortalAutomationScript(credentials: PortalCredentials, timeoutSeconds = 60): string {
  const config = JSON.stringify({
    username: credentials.username,
    password: credentials.password,
    device: (credentials.device || 'WebHmi').toLowerCase(),
    timeout: timeoutSeconds,
  });

  return `(function(){
  // Auf der HMI selbst (eigener Port) nichts tun.
  if (window.location.port && window.location.port !== '443') return;
  if (window.__kebaPortal) return;
  window.__kebaPortal = true;
  var cfg = ${config};
  var started = Date.now();
  var last = { login: 0, expand: 0, device: 0, www: 0 };
  var loginAttempts = 0;
  var timer;

  function send(m) {
    m.kebaPortal = true;
    try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {}
  }
  function stop() { clearInterval(timer); }
  function since(key, ms) { return Date.now() - last[key] > ms; }

  // Sichtbar = kein Vorfahre mit display:none / visibility:hidden (jQuery Mobile versteckt alte Seiten so).
  function visible(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden) return false;
      var s = window.getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
    }
    return true;
  }
  function text(el) { return (el.innerText || el.textContent || el.value || '').replace(/\\s+/g, ' ').trim(); }
  // Das innerste sichtbare Element, dessen Text passt.
  function find(test) {
    var all = document.body ? document.body.querySelectorAll('*') : [];
    var hit = null;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
      if (test(text(el).toLowerCase(), el) && visible(el)) {
        if (!hit || hit.contains(el)) hit = el;
      }
    }
    return hit;
  }
  function clickable(el) { return el.closest('a,button,li,[onclick],[role=button]') || el; }
  function setValue(input, value) {
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function step() {
    if (Date.now() - started > cfg.timeout * 1000) {
      stop();
      send({ error: 'timeout', detail: (document.body ? text(document.body) : '').slice(0, 300) });
      return;
    }

    // 1. Login-Formular
    var password = Array.prototype.filter.call(document.querySelectorAll('input[type=password]'), visible)[0];
    if (password) {
      if (!since('login', 8000)) return;
      if (loginAttempts >= 2) {
        stop();
        send({ error: 'loginFailed', detail: text(document.body).slice(0, 300) });
        return;
      }
      var fields = Array.prototype.filter.call(document.querySelectorAll('input'), function (i) {
        var t = (i.getAttribute('type') || 'text').toLowerCase();
        return visible(i) && (t === 'text' || t === 'email');
      });
      if (fields[0]) setValue(fields[0], cfg.username);
      setValue(password, cfg.password);
      last.login = Date.now();
      loginAttempts++;
      send({ step: 'login' });
      var button = find(function (t, el) {
        return /^(login|log in|anmelden|sign in)$/.test(t) || (el.tagName === 'INPUT' && /submit|button/i.test(el.type) && /login|anmelden/i.test(el.value));
      });
      if (button) clickable(button).click();
      else if (password.form) password.form.submit();
      return;
    }

    // 3. Geräteseite mit „WWW“-Knopf
    var www = find(function (t) { return t === 'www'; });
    if (www) {
      if (!since('www', 6000)) return;
      last.www = Date.now();
      send({ step: 'www' });
      var link = www.closest('a');
      if (link && link.href && /:\\d+/.test(link.href.replace(/^https?:\\/\\//, ''))) {
        window.location.href = link.href;
      } else {
        clickable(www).click();
      }
      return;
    }

    // 2. Geräteliste: Eintrag „… WebHmi“
    var device = find(function (t) { return t.indexOf(cfg.device) !== -1 && t.length < 160; });
    if (device) {
      if (!since('device', 6000)) return;
      last.device = Date.now();
      send({ step: 'device' });
      clickable(device).click();
      return;
    }

    // Gruppe zugeklappt → aufklappen (jQuery Mobile „collapsible“)
    if (since('expand', 4000)) {
      var heads = document.querySelectorAll('.ui-collapsible-collapsed .ui-collapsible-heading-toggle, .ui-collapsible-heading-collapsed a, [data-role=collapsible] > h1, [data-role=collapsible] > h2, [data-role=collapsible] > h3, [data-role=collapsible] > h4');
      var head = Array.prototype.filter.call(heads, visible)[0];
      if (head) {
        last.expand = Date.now();
        send({ step: 'expand' });
        (head.querySelector('a,button') || head).click();
      }
    }
  }

  timer = setInterval(step, 1000);
  step();
})(); true;`;
}
