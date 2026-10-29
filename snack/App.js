// Heizung – M-TEC/KEBA Wärmepumpe
// AUTOMATISCH ERZEUGT aus App.tsx und src/ (npm run snack). Nicht von Hand ändern.
//
// In Snack (snack.expo.dev): diesen Inhalt komplett in App.js einfügen. Snack fragt nach den
// fehlenden Paketen – einfach "Add dependency" bestätigen:
//   react-native-webview@14.0.1
//   react-native-safe-area-context@~5.10.1
//   @react-native-async-storage/async-storage@2.2.0
//   expo-secure-store@~58.0.2
//   expo-status-bar@~58.0.4
//   react-native-tcp-socket@^6.4.3
//   expo-symbols@~58.0.4
//   expo-blur@~58.0.5
//   expo-haptics@~58.0.7
//   @expo/vector-icons@^15.1.1

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// App.tsx
import { StatusBar } from "expo-status-bar";
import { useEffect as useEffect4, useState as useState6 } from "react";
import { Alert, AppState, BackHandler, StyleSheet as StyleSheet10, Text as Text10, View as View7 } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

// src/screens/DataScreen.tsx
import { StyleSheet as StyleSheet4, Text as Text4 } from "react-native";

// src/store.tsx
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

// src/keba/client.ts
var KebaError = class extends Error {
  constructor(kind, message) {
    super(message);
    __publicField(this, "kind", kind);
    this.name = "KebaError";
  }
};
var KebaClient = class {
  constructor(post, languageCode = "de") {
    __publicField(this, "post", post);
    __publicField(this, "languageCode", languageCode);
    /** Die HMI fragt maximal ~25 Variablen pro Request ab; wir bleiben in der Größenordnung. */
    __publicField(this, "batchSize", 30);
  }
  async read(names, withAttributes = false) {
    const result = {};
    for (let start = 0; start < names.length; start += this.batchSize) {
      const chunk = names.slice(start, start + this.batchSize);
      const payload = chunk.map((name) => withAttributes ? { name, attr: "1" } : { name });
      const response = await this.post(`/var/readWriteVars?languageCode=${this.languageCode}`, JSON.stringify(payload));
      for (const variable of parseVariables(validate(response))) {
        result[variable.name] = variable;
      }
    }
    return result;
  }
  async write(values) {
    if (values.length === 0) return;
    validate(await this.post("/var/readWriteVars?action=set", JSON.stringify(values)));
  }
};
function validate(response) {
  const { status, contentType, body } = response;
  if (status === 401) {
    throw new KebaError("unauthorized", "Benutzername oder Passwort falsch.");
  }
  if ((contentType ?? "").toLowerCase().includes("text/html") || body.trimStart().startsWith("<")) {
    throw new KebaError("sessionExpired", "Die Sitzung ist abgelaufen. Bitte neu verbinden.");
  }
  if (status === 500) {
    const message = developerMessage(body);
    if (message) throw new KebaError("server", `Der Regler meldet einen Fehler: ${message}`);
  }
  if (status < 200 || status >= 300) {
    throw new KebaError("http", `Unerwartete Antwort vom Regler (HTTP ${status}).`);
  }
  return body;
}
function parseVariables(body) {
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new KebaError("invalidResponse", `Antwort konnte nicht gelesen werden: ${body.slice(0, 120)}`);
  }
  const items = Array.isArray(json) ? json : [json];
  return items.filter((item) => typeof item === "object" && item !== null && "name" in item).map((item) => ({
    name: String(item.name),
    value: stringify(item.value),
    attributes: parseAttributes(item.attributes)
  }));
}
function parseAttributes(raw2) {
  if (typeof raw2 !== "object" || raw2 === null) return void 0;
  const a = raw2;
  const pick = (key) => a[key] === void 0 || a[key] === null ? void 0 : stringify(a[key]);
  return {
    formatId: pick("formatId"),
    longText: pick("longText"),
    unitId: pick("unitId"),
    lowerLimit: pick("lowerLimit"),
    upperLimit: pick("upperLimit")
  };
}
function stringify(value) {
  if (value === void 0 || value === null) return "";
  return typeof value === "string" ? value : String(value);
}
function developerMessage(body) {
  try {
    const json = JSON.parse(body);
    return typeof json?.developerMessage === "string" ? json.developerMessage : void 0;
  } catch {
    return void 0;
  }
}
function toNumber(v) {
  if (!v || v.value.trim() === "") return void 0;
  const n = Number(v.value);
  return Number.isFinite(n) ? n : void 0;
}
function toInt(v) {
  const n = toNumber(v);
  return n === void 0 ? void 0 : Math.round(n);
}
function toBool(v) {
  const text = v?.value.trim().toLowerCase();
  if (text === "true") return true;
  if (text === "false") return false;
  const n = text === void 0 || text === "" ? NaN : Number(text);
  return Number.isFinite(n) ? n !== 0 : void 0;
}
function toRange(attributes) {
  const min = Number(attributes?.lowerLimit);
  const max = Number(attributes?.upperLimit);
  if (attributes?.lowerLimit === void 0 || attributes?.upperLimit === void 0) return void 0;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return void 0;
  return { min, max };
}
function formatNumber(value) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

// src/keba/bridge.ts
var REMOTE_PORTAL_URL = "https://remote.keba.com/app";
function hmiBaseUrl(url) {
  if (!url) return void 0;
  const match = /^https:\/\/([a-z0-9.-]*keba\.com):(\d+)(?:[/?#]|$)/i.exec(url);
  if (!match || match[2] === "443") return void 0;
  return `https://${match[1].toLowerCase()}:${match[2]}`;
}
var WebViewBridge = class {
  constructor(timeoutMs = 2e4) {
    __publicField(this, "timeoutMs", timeoutMs);
    __publicField(this, "webView", null);
    __publicField(this, "pending", /* @__PURE__ */ new Map());
    __publicField(this, "counter", 0);
    __publicField(this, "post", (path, body) => new Promise((resolve, reject) => {
      if (!this.webView) {
        reject(new KebaError("sessionExpired", "Fernzugriff ist nicht verbunden."));
        return;
      }
      const id = `keba-${++this.counter}`;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new KebaError("network", "Der Fernzugriff antwortet nicht (Zeit\xFCberschreitung)."));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.webView.injectJavaScript(buildFetchScript(id, path, body));
    }));
  }
  attach(webView) {
    this.webView = webView;
  }
  /** Bricht offene Anfragen ab, z. B. wenn die HMI-Seite verlassen wurde. */
  reset(reason = "Verbindung getrennt") {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new KebaError("sessionExpired", reason));
      this.pending.delete(id);
    }
  }
  /** An `onMessage` der WebView hängen. Gibt true zurück, wenn die Nachricht von der Bridge kam. */
  handleMessage(data) {
    let message;
    try {
      message = JSON.parse(data);
    } catch {
      return false;
    }
    if (typeof message?.kebaId !== "string") return false;
    const p = this.pending.get(message.kebaId);
    if (!p) return true;
    this.pending.delete(message.kebaId);
    clearTimeout(p.timer);
    if (message.error !== void 0) {
      p.reject(new KebaError("network", `Fernzugriff: ${message.error}`));
    } else {
      p.resolve({ status: message.status ?? 0, contentType: message.contentType ?? null, body: message.body ?? "" });
    }
    return true;
  }
};
function buildFetchScript(id, path, body) {
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

// src/keba/portalAutomation.ts
function parsePortalMessage(data) {
  try {
    const message = JSON.parse(data);
    return message?.kebaPortal === true ? message : void 0;
  } catch {
    return void 0;
  }
}
function portalStepLabel(step) {
  switch (step) {
    case "alive":
      return "Portal ge\xF6ffnet \u2026";
    case "login":
      return "Anmelden bei KEBA \u2026";
    case "expand":
    case "device":
      return "Anlage wird gesucht \u2026";
    case "www":
    case "hmi":
      return "Verbindung zur Heizung wird aufgebaut \u2026";
    default:
      return "Verbinde mit KEBA \u2026";
  }
}
var STOP_PORTAL_AUTOMATION_SCRIPT = "window.__kebaPortalStop = true; true;";
function buildPortalAutomationScript(credentials, timeoutSeconds = 75) {
  const config = JSON.stringify({
    username: credentials.username,
    password: credentials.password,
    device: (credentials.device || "WebHmi").toLowerCase(),
    timeout: timeoutSeconds
  });
  return `(function(){
  // Auf der HMI selbst (eigener Port): nur melden, dass sie erreicht ist \u2013 unabh\xE4ngig davon,
  // ob die WebView jemals \u201Efertig geladen\u201C meldet.
  if (window.location.port && window.location.port !== '443') {
    if (!window.__kebaHmiSent) {
      window.__kebaHmiSent = true;
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ kebaPortal: true, step: 'hmi', info: location.href })); } catch (e) {}
    }
    return;
  }
  if (window.__kebaPortal) return;
  window.__kebaPortal = true;
  var cfg = ${config};
  var started = Date.now();
  var last = { login: 0, expand: 0, device: 0, www: 0, info: 0 };
  var loginAttempts = 0;
  var timer;

  function send(m) {
    m.kebaPortal = true;
    try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {}
  }
  function stop() { clearInterval(timer); }
  function since(key, ms) { return Date.now() - last[key] > ms; }

  // Hauptdokument plus alle iFrames, auf die wir zugreifen d\xFCrfen (gleicher Ursprung).
  function docs() {
    var list = [document];
    for (var i = 0; i < list.length; i++) {
      var frames = list[i].querySelectorAll('iframe,frame');
      for (var j = 0; j < frames.length; j++) {
        try { if (frames[j].contentDocument && frames[j].contentDocument.body) list.push(frames[j].contentDocument); } catch (e) {}
      }
    }
    return list;
  }
  function all(selector) {
    var out = [];
    docs().forEach(function (d) { Array.prototype.push.apply(out, d.querySelectorAll(selector)); });
    return out;
  }
  // Sichtbar = kein Vorfahre mit display:none / visibility:hidden (jQuery Mobile versteckt alte Seiten so).
  function visible(el) {
    var view = el.ownerDocument.defaultView || window;
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden) return false;
      var s = view.getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
    }
    return true;
  }
  function text(el) { return (el.innerText || el.textContent || el.value || '').replace(/\\s+/g, ' ').trim(); }
  // Das innerste sichtbare Element, dessen Text passt.
  function find(test) {
    var hit = null;
    all('body *').forEach(function (el) {
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
      if (test(text(el).toLowerCase(), el) && visible(el)) {
        if (!hit || hit.contains(el)) hit = el;
      }
    });
    return hit;
  }
  function clickable(el) { return el.closest('a,button,li,[onclick],[role=button]') || el; }
  function setValue(input, value) {
    var view = input.ownerDocument.defaultView || window;
    var setter = Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new view.Event('input', { bubbles: true }));
    input.dispatchEvent(new view.Event('change', { bubbles: true }));
  }
  function describe() {
    var inputs = all('input').filter(visible).map(function (i) { return i.type || 'text'; });
    return location.href.slice(0, 80) + ' (' + document.readyState + ') | Frames: ' + (docs().length - 1) + ' | Felder: ' + (inputs.join(',') || 'keine') +
      ' | Text: ' + (document.body ? text(document.body).slice(0, 120) : '\u2013');
  }

  function step() {
    if (window.__kebaPortalStop) { stop(); return; }
    if (Date.now() - started > cfg.timeout * 1000) {
      stop();
      send({ error: 'timeout', detail: describe() });
      return;
    }
    if (since('info', 5000)) {
      last.info = Date.now();
      send({ step: 'alive', info: describe() });
    }

    // 1. Login-Formular
    var password = all('input[type=password]').filter(visible)[0];
    if (password) {
      if (!since('login', 8000)) return;
      if (loginAttempts >= 2) {
        stop();
        send({ error: 'loginFailed', detail: describe() });
        return;
      }
      var fields = all('input').filter(function (i) {
        var t = (i.getAttribute('type') || 'text').toLowerCase();
        return visible(i) && (t === 'text' || t === 'email');
      });
      if (fields[0]) setValue(fields[0], cfg.username);
      setValue(password, cfg.password);
      last.login = Date.now();
      loginAttempts++;
      send({ step: 'login' });
      var button = find(function (t, el) {
        return /^(login|log in|anmelden|sign in)$/.test(t) ||
          (el.tagName === 'INPUT' && /submit|button/i.test(el.type) && /login|anmelden/i.test(el.value));
      });
      if (button) clickable(button).click();
      else if (password.form) password.form.submit();
      return;
    }

    // 3. Ger\xE4teseite mit \u201EWWW\u201C-Knopf
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

    // 2. Ger\xE4teliste: Eintrag \u201E\u2026 WebHmi\u201C
    var device = find(function (t) { return t.indexOf(cfg.device) !== -1 && t.length < 160; });
    if (device) {
      if (!since('device', 6000)) return;
      last.device = Date.now();
      send({ step: 'device' });
      clickable(device).click();
      return;
    }

    // Gruppe zugeklappt \u2192 aufklappen (jQuery Mobile \u201Ecollapsible\u201C)
    if (since('expand', 4000)) {
      var heads = all('.ui-collapsible-collapsed .ui-collapsible-heading-toggle, .ui-collapsible-heading-collapsed a, [data-role=collapsible] > h1, [data-role=collapsible] > h2, [data-role=collapsible] > h3, [data-role=collapsible] > h4');
      var head = heads.filter(visible)[0];
      if (head) {
        last.expand = Date.now();
        send({ step: 'expand' });
        (head.querySelector('a,button') || head).click();
      }
    }
  }

  send({ step: 'alive', info: describe() });
  timer = setInterval(step, 1000);
  step();
})(); true;`;
}

// src/keba/variables.ts
var P = "APPL.CtrlAppl.sParam";
var KebaVar = {
  outdoorTemperature: `${P}.outdoorTemp.values.actValue`,
  systemOperatingMode: `${P}.param.operatingMode`,
  numberOfHeatingCircuits: `${P}.options.systemNumberOfHeatingCircuits`,
  numberOfHotWaterTanks: `${P}.options.systemNumberOfHotWaterTanks`,
  heatCircuit: {
    name: (i) => `${P}.heatCircuit[${i}].param.name`,
    hasRoomTemperature: (i) => `${P}.options.heatCircuit[${i}].hasRoomTemp`,
    hasRoomHumidity: (i) => `${P}.options.heatCircuit[${i}].hasRoomHumidity`,
    roomTemperature: (i) => `${P}.heatCircuit[${i}].tempRoom.values.actValue`,
    roomHumidity: (i) => `${P}.heatCircuit[${i}].humidityRoom.values.actValue`,
    /** Aktueller Sollwert inkl. Korrektur (große Zahl auf dem HMI-Startbildschirm). */
    setValue: (i) => `${P}.heatCircuit[${i}].values.setValue`,
    flowSetTemperature: (i) => `${P}.heatCircuit[${i}].values.flowSetTemp`,
    /** Korrektur, die die Pfeiltasten der HMI in 0,5-K-Schritten verändern. */
    offset: (i) => `${P}.heatCircuit[${i}].param.offsetRoomTemp`,
    normalSetTemperature: (i) => `${P}.heatCircuit[${i}].param.normalSetTemp`,
    reducedSetTemperature: (i) => `${P}.heatCircuit[${i}].param.reducedSetTemp`,
    operatingMode: (i) => `${P}.heatCircuit[${i}].param.operatingMode`,
    heatRequest: (i) => `${P}.heatCircuit[${i}].values.heatRequest`
  },
  heatPump: {
    flowTemperature: (i) => `${P}.heatpump[${i}].TempHeatFlow.values.actValue`,
    returnTemperature: (i) => `${P}.heatpump[${i}].TempHeatReflux.values.actValue`,
    sourceInTemperature: (i) => `${P}.heatpump[${i}].TempSourceIn.values.actValue`,
    sourceOutTemperature: (i) => `${P}.heatpump[${i}].TempSourceOut.values.actValue`
  },
  bufferTank: {
    topTemperature: (i) => `${P}.bufferTank[${i}].topTemp.values.actValue`,
    midTemperature: (i) => `${P}.bufferTank[${i}].midTemp.values.actValue`
  },
  hotWaterTank: {
    name: (i) => `${P}.hotWaterTank[${i}].param.name`,
    temperature: (i) => `${P}.hotWaterTank[${i}].topTemp.values.actValue`,
    setTemperature: (i) => `${P}.hotWaterTank[${i}].param.normalSetTempMax.value`,
    operatingMode: (i) => `${P}.hotWaterTank[${i}].param.operatingMode`,
    heatRequest: (i) => `${P}.hotWaterTank[${i}].values.heatRequestTop`
  }
};
var allHeatCircuitVars = (i) => Object.values(KebaVar.heatCircuit).map((f) => f(i));
var allHotWaterVars = (i) => Object.values(KebaVar.hotWaterTank).map((f) => f(i));
var allHeatPumpVars = (i) => [
  ...Object.values(KebaVar.heatPump).map((f) => f(i)),
  ...Object.values(KebaVar.bufferTank).map((f) => f(i))
];

// src/keba/service.ts
async function loadSnapshot(client, now = /* @__PURE__ */ new Date()) {
  const counts = await client.read([KebaVar.numberOfHeatingCircuits, KebaVar.numberOfHotWaterTanks]);
  const circuitCount = clamp(toInt(counts[KebaVar.numberOfHeatingCircuits]) ?? 1, 8);
  const tankCount = clamp(toInt(counts[KebaVar.numberOfHotWaterTanks]) ?? 1, 4);
  const names = [KebaVar.outdoorTemperature, KebaVar.systemOperatingMode];
  for (let i = 0; i < circuitCount; i++) names.push(...allHeatCircuitVars(i));
  for (let i = 0; i < tankCount; i++) names.push(...allHotWaterVars(i));
  names.push(...allHeatPumpVars(0));
  const v = await client.read(names, true);
  const HC = KebaVar.heatCircuit;
  const HW = KebaVar.hotWaterTank;
  const heatCircuits = range(circuitCount).map((i) => {
    const hasRoomTemp = toBool(v[HC.hasRoomTemperature(i)]) ?? true;
    const hasHumidity = toBool(v[HC.hasRoomHumidity(i)]) ?? true;
    return {
      index: i,
      name: nonEmpty(v[HC.name(i)]?.value) ?? `Heizkreis ${i + 1}`,
      roomTemperature: hasRoomTemp ? toNumber(v[HC.roomTemperature(i)]) : void 0,
      roomHumidity: hasHumidity ? toNumber(v[HC.roomHumidity(i)]) : void 0,
      currentSetTemperature: toNumber(v[HC.setValue(i)]),
      flowSetTemperature: toNumber(v[HC.flowSetTemperature(i)]),
      offset: setpoint(v[HC.offset(i)]),
      normalSetTemperature: setpoint(v[HC.normalSetTemperature(i)]),
      reducedSetTemperature: setpoint(v[HC.reducedSetTemperature(i)]),
      operatingMode: toInt(v[HC.operatingMode(i)]),
      heatRequest: toBool(v[HC.heatRequest(i)])
    };
  });
  const hotWaterTanks = range(tankCount).map((i) => ({
    index: i,
    name: nonEmpty(v[HW.name(i)]?.value) ?? (tankCount === 1 ? "Warmwasser" : `Warmwasser ${i + 1}`),
    temperature: toNumber(v[HW.temperature(i)]),
    setTemperature: setpoint(v[HW.setTemperature(i)]),
    operatingMode: toInt(v[HW.operatingMode(i)]),
    heatRequest: toBool(v[HW.heatRequest(i)])
  }));
  const HP = KebaVar.heatPump;
  const BT = KebaVar.bufferTank;
  const heatPump = {
    flowTemperature: toNumber(v[HP.flowTemperature(0)]),
    returnTemperature: toNumber(v[HP.returnTemperature(0)]),
    sourceInTemperature: toNumber(v[HP.sourceInTemperature(0)]),
    sourceOutTemperature: toNumber(v[HP.sourceOutTemperature(0)]),
    bufferTopTemperature: toNumber(v[BT.topTemperature(0)]),
    bufferMidTemperature: toNumber(v[BT.midTemperature(0)])
  };
  return {
    outdoorTemperature: toNumber(v[KebaVar.outdoorTemperature]),
    heatPump: Object.values(heatPump).some((x) => x !== void 0) ? heatPump : void 0,
    systemOperatingMode: toInt(v[KebaVar.systemOperatingMode]),
    heatCircuits,
    hotWaterTanks,
    fetchedAt: now
  };
}
var writeNumber = (client, name, value) => client.write([{ name, value: formatNumber(value) }]);
var commands = {
  setSystemMode: (c, mode) => writeNumber(c, KebaVar.systemOperatingMode, mode),
  /** Entspricht den Pfeiltasten auf dem HMI-Startbildschirm. */
  setOffset: (c, circuit, value) => writeNumber(c, KebaVar.heatCircuit.offset(circuit), value),
  setNormalTemperature: (c, circuit, value) => writeNumber(c, KebaVar.heatCircuit.normalSetTemperature(circuit), value),
  setReducedTemperature: (c, circuit, value) => writeNumber(c, KebaVar.heatCircuit.reducedSetTemperature(circuit), value),
  setHeatCircuitMode: (c, circuit, mode) => writeNumber(c, KebaVar.heatCircuit.operatingMode(circuit), mode),
  setHotWaterTemperature: (c, tank, value) => writeNumber(c, KebaVar.hotWaterTank.setTemperature(tank), value),
  setHotWaterMode: (c, tank, mode) => writeNumber(c, KebaVar.hotWaterTank.operatingMode(tank), mode)
};
var clamp = (value, max) => Math.min(Math.max(value, 0), max);
var range = (n) => Array.from({ length: n }, (_, i) => i);
function nonEmpty(s) {
  const t = s?.trim();
  return t ? t : void 0;
}
function setpoint(v) {
  const value = toNumber(v);
  return value === void 0 ? void 0 : { value, range: toRange(v?.attributes) };
}

// src/modbus/modbusClient.ts
var ModbusError = class extends Error {
  constructor(message, kind, exceptionCode) {
    super(message);
    __publicField(this, "kind", kind);
    __publicField(this, "exceptionCode", exceptionCode);
    this.name = "ModbusError";
  }
};
var READ_HOLDING = 3;
var WRITE_SINGLE = 6;
var MAX_READ = 120;
var ModbusTcpClient = class {
  constructor(factory, host, port = 502, unit = 1, timeoutMs = 4e3) {
    __publicField(this, "factory", factory);
    __publicField(this, "host", host);
    __publicField(this, "port", port);
    __publicField(this, "unit", unit);
    __publicField(this, "timeoutMs", timeoutMs);
    __publicField(this, "socket", null);
    __publicField(this, "connecting", null);
    __publicField(this, "buffer", new Uint8Array(0));
    __publicField(this, "pending", null);
    __publicField(this, "transaction", 0);
    /** Anfragen laufen nacheinander – der Regler mag keine parallelen Anfragen auf einer Verbindung. */
    __publicField(this, "queue", Promise.resolve());
  }
  readHolding(address, count) {
    if (count < 1 || count > 125) throw new RangeError(`Ung\xFCltige Anzahl ${count}`);
    return this.enqueue(async () => {
      const pdu = await this.request([READ_HOLDING, address >> 8, address & 255, count >> 8, count & 255]);
      const byteCount = pdu[1];
      const values = [];
      for (let i = 0; i < byteCount / 2; i++) values.push(pdu[2 + 2 * i] << 8 | pdu[3 + 2 * i]);
      return values;
    });
  }
  writeSingle(address, value) {
    const v = value & 65535;
    return this.enqueue(async () => {
      await this.request([WRITE_SINGLE, address >> 8, address & 255, v >> 8, v & 255]);
    });
  }
  close() {
    this.failPending(new ModbusError("Verbindung geschlossen", "connection"));
    this.socket?.destroy();
    this.socket = null;
    this.connecting = null;
  }
  // MARK: Intern
  enqueue(job) {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => void 0);
    return run;
  }
  connect() {
    if (this.socket && !this.connecting) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.buffer = new Uint8Array(0);
    this.connecting = new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.close();
        reject(new ModbusError(`Keine Antwort von ${this.host}:${this.port}`, "timeout"));
      }, this.timeoutMs);
      const socket = this.factory(this.host, this.port, () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.connecting = null;
        resolve();
      });
      this.socket = socket;
      socket.on("data", (data) => this.onData(data));
      socket.on("error", (error) => {
        const wrapped = new ModbusError(`Verbindung zu ${this.host}:${this.port} fehlgeschlagen: ${error.message}`, "connection");
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(wrapped);
        }
        this.dropSocket(socket, wrapped);
      });
      socket.on("close", () => this.dropSocket(socket, new ModbusError("Verbindung vom Regler geschlossen", "connection")));
    });
    return this.connecting;
  }
  dropSocket(socket, error) {
    if (this.socket !== socket) return;
    this.socket = null;
    this.connecting = null;
    this.failPending(error);
  }
  async request(pdu) {
    await this.connect();
    const socket = this.socket;
    if (!socket) throw new ModbusError("Keine Verbindung", "connection");
    this.transaction = this.transaction + 1 & 65535;
    const tid = this.transaction;
    const length = pdu.length + 1;
    const frame = new Uint8Array([tid >> 8, tid & 255, 0, 0, length >> 8, length & 255, this.unit, ...pdu]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        this.close();
        reject(new ModbusError("Der Regler antwortet nicht (Zeit\xFCberschreitung)", "timeout"));
      }, this.timeoutMs);
      this.pending = {
        transaction: tid,
        timer,
        reject,
        resolve: (response) => {
          if (response[0] & 128) {
            reject(new ModbusError(`Regler meldet Modbus-Ausnahme ${response[1]}`, "exception", response[1]));
          } else {
            resolve(response);
          }
        }
      };
      socket.write(frame);
    });
  }
  onData(data) {
    const chunk = typeof data === "string" ? latin1Bytes(data) : data;
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;
    while (this.buffer.length >= 7) {
      const length = this.buffer[4] << 8 | this.buffer[5];
      if (this.buffer.length < 6 + length) return;
      const tid = this.buffer[0] << 8 | this.buffer[1];
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
  failPending(error) {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.reject(error);
  }
};
function latin1Bytes(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 255;
  return out;
}
var toSigned16 = (v) => v >= 32768 ? v - 65536 : v;

// src/modbus/modbusTransport.ts
var temperature = (address, writable) => ({
  address,
  scale: 0.1,
  writable
});
var raw = (address, writable) => ({ address, scale: 1, writable });
var HEAT_CIRCUIT_MODES = { min: 0, max: 3, allowed: [0, 1, 2, 3] };
var HOT_WATER_MODES = { min: 0, max: 3, allowed: [0, 1, 2, 3] };
var SYSTEM_MODES = { min: 0, max: 2, allowed: [0, 1, 2] };
function buildRegisterMap(circuitCount) {
  const map = /* @__PURE__ */ new Map();
  const HC = KebaVar.heatCircuit;
  for (let i = 0; i < circuitCount; i++) {
    const base = 50 * i;
    map.set(HC.setValue(i), temperature(base + 2));
    map.set(HC.normalSetTemperature(i), temperature(base + 4, { min: 10, max: 30 }));
    map.set(HC.reducedSetTemperature(i), temperature(base + 5, { min: 10, max: 30 }));
    map.set(HC.operatingMode(i), raw(base + 7, HEAT_CIRCUIT_MODES));
    map.set(HC.heatRequest(i), raw(base + 8));
  }
  const HW = KebaVar.hotWaterTank;
  map.set(HW.temperature(0), temperature(401));
  map.set(HW.setTemperature(0), temperature(402, { min: 30, max: 60 }));
  map.set(HW.operatingMode(0), raw(403, HOT_WATER_MODES));
  map.set(KebaVar.systemOperatingMode, raw(1500, SYSTEM_MODES));
  map.set(KebaVar.outdoorTemperature, temperature(1502));
  const HP = KebaVar.heatPump;
  map.set(HP.flowTemperature(0), temperature(705));
  map.set(HP.returnTemperature(0), temperature(710));
  map.set(HP.sourceInTemperature(0), temperature(708));
  map.set(HP.sourceOutTemperature(0), temperature(709));
  map.set(KebaVar.bufferTank.topTemperature(0), temperature(601));
  map.set(KebaVar.bufferTank.midTemperature(0), temperature(603));
  return map;
}
function groupAddresses(addresses, maxGap = 16, maxCount = MAX_READ) {
  const sorted = [...new Set(addresses)].sort((a, b) => a - b);
  const blocks = [];
  for (const address of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && address - (last.start + last.count - 1) <= maxGap && address - last.start < maxCount) {
      last.count = address - last.start + 1;
    } else {
      blocks.push({ start: address, count: 1 });
    }
  }
  return blocks;
}
function formatValue(value) {
  return String(Math.round(value * 100) / 100);
}
var ModbusTransport = class {
  constructor(client, layout) {
    __publicField(this, "client", client);
    __publicField(this, "map");
    __publicField(this, "statics");
    const circuits = layout.circuitNames.length;
    this.map = buildRegisterMap(circuits);
    this.statics = new Map([
      [KebaVar.numberOfHeatingCircuits, String(circuits)],
      [KebaVar.numberOfHotWaterTanks, "1"],
      [KebaVar.hotWaterTank.name(0), layout.hotWaterName ?? "Warmwasser"],
      // Kein Raumfühler/Feuchtefühler über Modbus bekannt → nicht anzeigen.
      ...layout.circuitNames.flatMap((name, i) => [
        [KebaVar.heatCircuit.name(i), name],
        [KebaVar.heatCircuit.hasRoomTemperature(i), "false"],
        [KebaVar.heatCircuit.hasRoomHumidity(i), "false"]
      ])
    ]);
  }
  async read(names, withAttributes = false) {
    const result = {};
    for (const name of names) {
      const value = this.statics.get(name);
      if (value !== void 0) result[name] = { name, value };
    }
    const wanted = names.filter((n) => this.map.has(n));
    const registers = /* @__PURE__ */ new Map();
    try {
      for (const block of groupAddresses(wanted.map((n) => this.map.get(n).address))) {
        const values = await this.client.readHolding(block.start, block.count);
        values.forEach((v, i) => registers.set(block.start + i, v));
      }
    } catch (error) {
      throw toKebaError(error);
    }
    for (const name of wanted) {
      const mapping = this.map.get(name);
      const rawValue = registers.get(mapping.address);
      if (rawValue === void 0) continue;
      result[name] = {
        name,
        value: formatValue(toSigned16(rawValue) * mapping.scale),
        attributes: withAttributes && mapping.writable && mapping.scale !== 1 ? { lowerLimit: String(mapping.writable.min), upperLimit: String(mapping.writable.max) } : void 0
      };
    }
    return result;
  }
  async write(values) {
    for (const { name, value } of values) {
      const mapping = this.map.get(name);
      if (!mapping?.writable) {
        throw new KebaError("server", "Diese Einstellung ist \xFCber Modbus noch nicht freigeschaltet.");
      }
      const number = Number(value);
      const { min, max, allowed } = mapping.writable;
      if (!Number.isFinite(number) || number < min || number > max || allowed && !allowed.includes(number)) {
        throw new KebaError("server", `Wert ${value} liegt au\xDFerhalb von ${mapping.writable.min}\u2013${mapping.writable.max}.`);
      }
      try {
        await this.client.writeSingle(mapping.address, Math.round(number / mapping.scale));
      } catch (error) {
        throw toKebaError(error);
      }
    }
  }
  /** Ob ein Wert (z. B. die Betriebsart) über diese Verbindung geändert werden kann. */
  canWrite(name) {
    return this.map.get(name)?.writable !== void 0;
  }
};
function toKebaError(error) {
  if (error instanceof KebaError) return error;
  if (error instanceof ModbusError && error.kind === "exception") {
    return new KebaError("server", `Der Regler lehnt die Anfrage ab (Modbus-Ausnahme ${error.exceptionCode}).`);
  }
  return new KebaError("network", "W\xE4rmepumpe nicht erreichbar. Bist du im WLAN zuhause (oder per VPN verbunden)?");
}

// src/modbus/nativeSocket.ts
import { NativeModules } from "react-native";
function isModbusAvailable() {
  return NativeModules.TcpSockets != null;
}
async function loadSocketFactory() {
  if (!isModbusAvailable()) return void 0;
  const { default: TcpSocket } = await import("react-native-tcp-socket");
  return (host, port, onConnect) => TcpSocket.createConnection({ host, port, connectTimeout: 4e3 }, onConnect);
}

// src/settings.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
var defaultSettings = {
  mode: "modbus",
  modbusAddress: "192.168.0.100",
  circuitNames: "Puffer FBH, Heizk\xF6rper",
  portalUsername: "",
  portalPassword: "",
  portalDevice: "WebHmi"
};
function circuitNameList(s) {
  const names = s.circuitNames.split(",").map((n) => n.trim()).filter(Boolean).slice(0, 8);
  return names.length > 0 ? names : ["Heizkreis 1"];
}
var hasPortalCredentials = (s) => s.portalUsername.trim() !== "" && s.portalPassword !== "";
function isConfigured(s) {
  return s.mode === "modbus" ? s.modbusAddress.trim() !== "" : hasPortalCredentials(s);
}
var KEY = "heizung.settings";
var PORTAL_PASSWORD_KEY = "heizung.portalPassword";
var LEGACY_PASSWORD_KEY = "heizung.password";
async function loadSettings() {
  try {
    const raw2 = await AsyncStorage.getItem(KEY);
    const stored = raw2 ? JSON.parse(raw2) : {};
    const portalPassword = await SecureStore.getItemAsync(PORTAL_PASSWORD_KEY) ?? "";
    const mode = stored.mode === "remote" ? "remote" : "modbus";
    return {
      mode,
      modbusAddress: stored.modbusAddress ?? defaultSettings.modbusAddress,
      circuitNames: stored.circuitNames ?? defaultSettings.circuitNames,
      portalUsername: stored.portalUsername ?? defaultSettings.portalUsername,
      portalDevice: stored.portalDevice ?? defaultSettings.portalDevice,
      portalPassword
    };
  } catch {
    return defaultSettings;
  }
}
async function saveSettings(settings) {
  const { portalPassword, ...rest } = settings;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(rest));
    if (portalPassword) await SecureStore.setItemAsync(PORTAL_PASSWORD_KEY, portalPassword);
    else await SecureStore.deleteItemAsync(PORTAL_PASSWORD_KEY);
    await SecureStore.deleteItemAsync(LEGACY_PASSWORD_KEY);
  } catch {
  }
}

// src/store.tsx
var HeatingContext = createContext(null);
function useHeating() {
  const value = useContext(HeatingContext);
  if (!value) throw new Error("useHeating au\xDFerhalb von <HeatingProvider>");
  return value;
}
var wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var AUTO_RECONNECT_INTERVAL_MS = 6e4;
function HeatingProvider({ children }) {
  const bridge = useRef(new WebViewBridge()).current;
  const client = useRef(null);
  const modbusClient = useRef(null);
  const refreshing = useRef(false);
  const settingsRef = useRef(null);
  const lastAutoConnect = useRef(0);
  const snapshotRef = useRef(void 0);
  const [phase, setPhase] = useState("notConnected");
  const [snapshot, setSnapshot] = useState();
  const [error, setError] = useState();
  const [progress, setProgress] = useState("");
  const [loginNotice, setLoginNotice] = useState();
  const [transientError, setTransientError] = useState();
  const [writing, setWriting] = useState(false);
  const [offline, setOffline] = useState(false);
  const [remoteStage, setRemoteStage] = useState("idle");
  const [remoteSession, setRemoteSession] = useState(0);
  const [portalScript, setPortalScript] = useState();
  const [diagnostics, setDiagnostics] = useState([]);
  const addDiagnostic = useCallback((line) => {
    const time = (/* @__PURE__ */ new Date()).toLocaleTimeString("de-DE");
    setDiagnostics((d) => [...d.slice(-7), `${time} ${line}`]);
  }, []);
  const fail = useCallback((message) => {
    setError(message);
    setPhase("failed");
  }, []);
  const startRemote = useCallback(
    (settings, notice) => {
      bridge.reset();
      client.current = null;
      setDiagnostics([]);
      setRemoteSession((n) => n + 1);
      if (hasPortalCredentials(settings) && !notice) {
        lastAutoConnect.current = Date.now();
        setPortalScript(
          buildPortalAutomationScript({
            username: settings.portalUsername.trim(),
            password: settings.portalPassword,
            device: settings.portalDevice.trim()
          })
        );
        setProgress(portalStepLabel(void 0));
        setPhase("loading");
        setRemoteStage("auto");
      } else {
        setPortalScript(void 0);
        setLoginNotice(notice);
        setRemoteStage("login");
      }
    },
    [bridge]
  );
  const handleError = useCallback(
    (e) => {
      if (e instanceof KebaError && e.kind === "sessionExpired") {
        const settings = settingsRef.current;
        if (settings?.mode === "remote" && hasPortalCredentials(settings) && Date.now() - lastAutoConnect.current > AUTO_RECONNECT_INTERVAL_MS) {
          startRemote(settings);
          if (snapshotRef.current) setPhase("ready");
          return;
        }
        setRemoteStage("idle");
        setPhase("sessionExpired");
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      if (snapshotRef.current) setTransientError(message);
      else fail(message);
    },
    [fail, startRemote]
  );
  const refresh = useCallback(async () => {
    if (!client.current || refreshing.current) return;
    refreshing.current = true;
    try {
      const next = await loadSnapshot(client.current);
      snapshotRef.current = next;
      setSnapshot(next);
      setOffline(false);
      setPhase("ready");
    } catch (e) {
      if (e instanceof KebaError && e.kind === "network" && snapshotRef.current) {
        setOffline(true);
        return;
      }
      handleError(e);
    } finally {
      refreshing.current = false;
    }
  }, [handleError]);
  const closeModbus = useCallback(() => {
    modbusClient.current?.close();
    modbusClient.current = null;
  }, []);
  const start = useCallback(
    async (next) => {
      client.current = next;
      setError(void 0);
      if (!snapshotRef.current) {
        setProgress("Lade Daten \u2026");
        setPhase("loading");
      }
      await refresh();
    },
    [refresh]
  );
  const connect = useCallback(
    async (settings) => {
      settingsRef.current = settings;
      snapshotRef.current = void 0;
      setSnapshot(void 0);
      setError(void 0);
      closeModbus();
      if (settings.mode === "remote") {
        startRemote(settings);
        return;
      }
      if (settings.mode === "modbus") {
        setRemoteStage("idle");
        bridge.reset();
        const host = settings.modbusAddress.trim().replace(/^[a-z]+:\/\//i, "").replace(/[:/].*$/, "");
        if (!host) {
          fail("Bitte die IP-Adresse der W\xE4rmepumpe eintragen (z. B. 192.168.0.100).");
          return;
        }
        const factory = isModbusAvailable() ? await loadSocketFactory() : void 0;
        if (!factory) {
          fail(
            "Modbus braucht die eigene App-Version \u2013 in Expo Go/Snack gibt es keine TCP-Verbindungen. Zum Testen in Snack in den Einstellungen \u201EFernzugriff\u201C w\xE4hlen."
          );
          return;
        }
        const mb = new ModbusTcpClient(factory, host, 502, 1);
        modbusClient.current = mb;
        await start(new ModbusTransport(mb, { circuitNames: circuitNameList(settings) }));
      }
    },
    [bridge, closeModbus, fail, start, startRemote]
  );
  const cancelRemoteLogin = useCallback(() => {
    setRemoteStage("idle");
    setLoginNotice(void 0);
    if (!snapshotRef.current) setPhase("notConnected");
  }, []);
  const onHmiReached = useCallback(() => {
    setRemoteStage("connected");
    setLoginNotice(void 0);
    setPortalScript(void 0);
    void start(new KebaClient(bridge.post));
  }, [bridge, start]);
  const onHmiLeft = useCallback(() => {
    bridge.reset("Die Sitzung ist abgelaufen.");
    client.current = null;
    handleError(new KebaError("sessionExpired", "Die Sitzung ist abgelaufen."));
  }, [bridge, handleError]);
  const revealPortal = useCallback((notice) => {
    setLoginNotice(notice);
    setRemoteStage((stage) => stage === "auto" ? "login" : stage);
  }, []);
  const onPortalMessage = useCallback(
    (message) => {
      if ("step" in message) {
        if (message.step === "alive") {
          if (message.info) addDiagnostic(`Seite: ${message.info}`);
          setProgress((p) => p === portalStepLabel(void 0) ? portalStepLabel("alive") : p);
        } else {
          addDiagnostic(`Schritt: ${message.step}`);
          setProgress(portalStepLabel(message.step));
        }
        return;
      }
      addDiagnostic(`Abbruch: ${message.error} ${message.detail ?? ""}`);
      if (message.error === "loginFailed") {
        revealPortal("Anmeldung fehlgeschlagen \u2013 bitte Benutzername und Passwort in den Einstellungen pr\xFCfen oder hier von Hand anmelden.");
      } else {
        revealPortal("Die automatische Anmeldung hat nicht geklappt. Bitte einmal von Hand \u201EWebHmi\u201C \u2192 \u201EWWW\u201C antippen.");
      }
    },
    [addDiagnostic, revealPortal]
  );
  const perform = useCallback(
    async (action) => {
      if (!client.current) return;
      setWriting(true);
      try {
        await action(client.current);
        await wait(700);
        await refresh();
      } catch (e) {
        handleError(e);
      } finally {
        setWriting(false);
      }
    },
    [handleError, refresh]
  );
  const disconnect = useCallback(() => {
    bridge.reset();
    closeModbus();
    client.current = null;
    settingsRef.current = null;
    snapshotRef.current = void 0;
    setSnapshot(void 0);
    setRemoteStage("idle");
    setPhase("notConnected");
  }, [bridge, closeModbus]);
  const canWrite = useCallback((name) => {
    const transport = client.current;
    return transport instanceof ModbusTransport ? transport.canWrite(name) : true;
  }, []);
  const clearTransientError = useCallback(() => setTransientError(void 0), []);
  const value = useMemo(
    () => ({
      phase,
      snapshot,
      error,
      progress,
      loginNotice,
      diagnostics,
      transientError,
      writing,
      offline,
      remoteStage,
      remoteSession,
      portalScript,
      bridge,
      canWrite,
      connect,
      cancelRemoteLogin,
      onHmiReached,
      onHmiLeft,
      onPortalMessage,
      revealPortal,
      addDiagnostic,
      refresh,
      perform,
      disconnect,
      clearTransientError
    }),
    [
      phase,
      snapshot,
      error,
      progress,
      loginNotice,
      diagnostics,
      transientError,
      writing,
      offline,
      remoteStage,
      remoteSession,
      portalScript,
      bridge,
      canWrite,
      connect,
      cancelRemoteLogin,
      onHmiReached,
      onHmiLeft,
      onPortalMessage,
      revealPortal,
      addDiagnostic,
      refresh,
      perform,
      disconnect,
      clearTransientError
    ]
  );
  return <HeatingContext.Provider value={value}>{children}</HeatingContext.Provider>;
}

// src/ui/components.tsx
import { useState as useState2 } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

// src/ui/haptics.ts
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
var enabled = Platform.OS === "ios" || Platform.OS === "android";
function safely(run) {
  if (!enabled) return;
  run().catch(() => void 0);
}
var haptic = {
  /** Pfeiltaste, Stepper. */
  tap: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Auswahl einer Betriebsart. */
  select: () => safely(() => Haptics.selectionAsync()),
  success: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))
};

// src/ui/Icon.tsx
import Ionicons from "@expo/vector-icons/Ionicons";
import { SymbolView } from "expo-symbols";
import { Platform as Platform2 } from "react-native";
var icons = {
  home: { sf: "house.fill", fallback: "home" },
  modes: { sf: "slider.horizontal.3", fallback: "options" },
  data: { sf: "chart.bar.xaxis", fallback: "stats-chart" },
  settings: { sf: "gearshape.fill", fallback: "settings" },
  power: { sf: "power", fallback: "power" },
  clock: { sf: "clock", fallback: "time-outline" },
  sun: { sf: "sun.max.fill", fallback: "sunny" },
  moon: { sf: "moon.fill", fallback: "moon" },
  drop: { sf: "drop.fill", fallback: "water" },
  flame: { sf: "flame.fill", fallback: "flame" },
  heat: { sf: "heat.waves", fallback: "flame-outline" },
  up: { sf: "chevron.up", fallback: "chevron-up" },
  minus: { sf: "minus", fallback: "remove" },
  plus: { sf: "plus", fallback: "add" },
  down: { sf: "chevron.down", fallback: "chevron-down" },
  forward: { sf: "chevron.right", fallback: "chevron-forward" },
  back: { sf: "chevron.left", fallback: "chevron-back" },
  check: { sf: "checkmark", fallback: "checkmark" },
  thermometer: { sf: "thermometer.medium", fallback: "thermometer" },
  wind: { sf: "wind", fallback: "leaf-outline" },
  wifiOff: { sf: "wifi.exclamationmark", fallback: "cloud-offline" }
};
function Icon({ icon, size = 22, color }) {
  if (Platform2.OS === "ios") {
    return <SymbolView
      name={icon.sf}
      size={size}
      tintColor={color}
      weight="medium"
      resizeMode="scaleAspectFit"
      fallback={<Ionicons name={icon.fallback} size={size} color={color} />}
    />;
  }
  return <Ionicons name={icon.fallback} size={size} color={color} />;
}

// src/ui/theme.ts
import { useColorScheme } from "react-native";
var ORANGE = "#FF9500";
var light = {
  background: "#F2F2F7",
  card: "#FFFFFF",
  text: "#000000",
  secondary: "rgba(60, 60, 67, 0.6)",
  tertiary: "rgba(60, 60, 67, 0.3)",
  separator: "rgba(60, 60, 67, 0.29)",
  fill: "rgba(120, 120, 128, 0.12)",
  pressed: "rgba(120, 120, 128, 0.2)",
  accent: ORANGE,
  accentText: "#FFFFFF",
  accentSoft: "rgba(255, 149, 0, 0.14)",
  water: "#007AFF",
  danger: "#FF3B30",
  tabBar: "rgba(255, 255, 255, 0.72)",
  tabBarBorder: "rgba(255, 255, 255, 0.6)",
  blurTint: "systemChromeMaterialLight"
};
var dark = {
  background: "#000000",
  card: "#1C1C1E",
  text: "#FFFFFF",
  secondary: "rgba(235, 235, 245, 0.6)",
  tertiary: "rgba(235, 235, 245, 0.3)",
  separator: "rgba(84, 84, 88, 0.6)",
  fill: "rgba(118, 118, 128, 0.24)",
  pressed: "rgba(118, 118, 128, 0.36)",
  accent: "#FF9F0A",
  accentText: "#000000",
  accentSoft: "rgba(255, 159, 10, 0.18)",
  water: "#0A84FF",
  danger: "#FF453A",
  tabBar: "rgba(30, 30, 30, 0.72)",
  tabBarBorder: "rgba(255, 255, 255, 0.08)",
  blurTint: "systemChromeMaterialDark"
};
function useTheme() {
  return useColorScheme() === "dark" ? dark : light;
}
function formatTemp(value, unit = "\xB0") {
  if (value === void 0) return "\u2013";
  return value.toFixed(1).replace(".", ",") + unit;
}
var type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700", letterSpacing: -0.4 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.26 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.43 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400", letterSpacing: -0.43 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: "400", letterSpacing: -0.23 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400", letterSpacing: -0.08 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0 },
  /** Große Temperaturen: leicht, eng gesetzt, Ziffern gleich breit. */
  display: { fontSize: 64, lineHeight: 70, fontWeight: "300", letterSpacing: -2, fontVariant: ["tabular-nums"] },
  displaySmall: { fontSize: 34, lineHeight: 40, fontWeight: "400", letterSpacing: -0.8, fontVariant: ["tabular-nums"] }
};

// src/ui/components.tsx
var pressedStyle = { transform: [{ scale: 0.98 }], opacity: 0.85 };
function Card({ children, onPress, style }) {
  const theme = useTheme();
  const base = [styles.card, { backgroundColor: theme.card }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && pressedStyle]}>
      {children}
    </Pressable>;
}
function LargeTitle({ children }) {
  const theme = useTheme();
  return <Text style={[type.largeTitle, styles.largeTitle, { color: theme.text }]} accessibilityRole="header">
      {children}
    </Text>;
}
function SectionTitle({ children, icon }) {
  const theme = useTheme();
  return <View style={styles.sectionTitle}>
      {icon && <Icon icon={icon} size={15} color={theme.secondary} />}
      <Text style={[type.footnote, styles.sectionText, { color: theme.secondary }]}>{children.toUpperCase()}</Text>
    </View>;
}
function Row({ label, value, icon, last }) {
  const theme = useTheme();
  return <View style={[styles.row, !last && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      {icon && <View style={styles.rowIcon}>
          <Icon icon={icon} size={17} color={theme.secondary} />
        </View>}
      <Text style={[type.body, styles.flex, { color: theme.text }]}>{label}</Text>
      <Text style={[type.body, styles.tabular, { color: theme.secondary }]}>{value}</Text>
    </View>;
}
function Button({
  title,
  onPress,
  kind = "primary",
  disabled,
  style
}) {
  const theme = useTheme();
  const background = kind === "primary" ? theme.accent : theme.fill;
  const color = kind === "primary" ? theme.accentText : kind === "danger" ? theme.danger : theme.text;
  return <Pressable
    accessibilityRole="button"
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.button,
      { backgroundColor: background, opacity: disabled ? 0.4 : 1 },
      pressed && pressedStyle,
      style
    ]}
  >
      <Text style={[type.headline, { color }]}>{title}</Text>
    </Pressable>;
}
function ModeTiles({
  options,
  selected,
  onSelect,
  disabled
}) {
  const theme = useTheme();
  return <View style={styles.tiles} accessibilityRole="radiogroup">
      {options.map((option) => {
    const active = option.value === selected;
    const color = active ? theme.accentText : theme.text;
    return <Pressable
      key={option.value}
      accessibilityRole="radio"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={option.label}
      disabled={disabled}
      onPress={() => {
        if (active) return;
        haptic.select();
        onSelect(option.value);
      }}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: active ? theme.accent : theme.card, opacity: disabled && !active ? 0.5 : 1 },
        pressed && !active && pressedStyle
      ]}
    >
            <Icon icon={option.icon} size={24} color={active ? theme.accentText : theme.accent} />
            <Text style={[type.caption, styles.tileLabel, { color }]} numberOfLines={2}>
              {option.label}
            </Text>
          </Pressable>;
  })}
    </View>;
}
function SetpointEditor({
  title,
  setpoint: setpoint2,
  step,
  unit = "\xB0",
  disabled,
  last,
  onCommit
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState2();
  const value = draft ?? setpoint2.value;
  const min = setpoint2.range?.min ?? setpoint2.value - 20;
  const max = setpoint2.range?.max ?? setpoint2.value + 20;
  const change = (delta) => {
    const next = Math.round(Math.min(max, Math.max(min, value + delta)) * 100) / 100;
    setDraft(next === setpoint2.value ? void 0 : next);
  };
  return <View style={[styles.editor, !last && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.editorRow}>
        <Text style={[type.body, styles.flex, { color: theme.text }]}>{title}</Text>
        <StepButton icon={icons.minus} label="Niedriger" onPress={() => change(-step)} disabled={disabled || value <= min} />
        <Text style={[type.headline, styles.editorValue, { color: draft === void 0 ? theme.text : theme.accent }]}>
          {formatTemp(value, unit)}
        </Text>
        <StepButton icon={icons.plus} label="Höher" onPress={() => change(step)} disabled={disabled || value >= max} />
      </View>
      {draft !== void 0 && <View style={styles.editorActions}>
          <Button title="Verwerfen" kind="secondary" onPress={() => setDraft(void 0)} style={styles.flex} />
          <Button
    title="Übernehmen"
    disabled={disabled}
    onPress={async () => {
      await onCommit(draft);
      haptic.success();
      setDraft(void 0);
    }}
    style={styles.flex}
  />
        </View>}
    </View>;
}
function StepButton({
  icon,
  label,
  onPress,
  disabled,
  large
}) {
  const theme = useTheme();
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={() => {
      haptic.tap();
      onPress();
    }}
    disabled={disabled}
    hitSlop={6}
    style={({ pressed }) => [
      large ? styles.stepLarge : styles.step,
      { backgroundColor: theme.fill, opacity: disabled ? 0.35 : 1 },
      pressed && { backgroundColor: theme.pressed, transform: [{ scale: 0.94 }] }
    ]}
  >
      <Icon icon={icon} size={large ? 22 : 16} color={theme.text} />
    </Pressable>;
}
function StatusView({
  title,
  message,
  icon,
  loading,
  children
}) {
  const theme = useTheme();
  return <View style={styles.status}>
      {loading ? <ActivityIndicator size="large" color={theme.accent} style={styles.statusIcon} /> : icon && <View style={styles.statusIcon}>
            <Icon icon={icon} size={44} color={theme.tertiary} />
          </View>}
      <Text style={[type.title2, styles.center, { color: theme.text }]}>{title}</Text>
      {message && <Text style={[type.subhead, styles.center, styles.statusMessage, { color: theme.secondary }]}>{message}</Text>}
      <View style={styles.statusActions}>{children}</View>
    </View>;
}
var styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: "center" },
  tabular: { fontVariant: ["tabular-nums"] },
  card: { borderRadius: 22, padding: 18, borderCurve: "continuous" },
  largeTitle: { marginTop: 8, marginBottom: 12 },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24, marginBottom: 8, marginLeft: 18 },
  sectionText: { letterSpacing: 0.3 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 48, paddingVertical: 11 },
  rowIcon: { width: 28 },
  button: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center", borderCurve: "continuous" },
  tiles: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    minHeight: 84,
    borderRadius: 18,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 12
  },
  tileLabel: { textAlign: "center" },
  editor: { paddingVertical: 12 },
  editorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  editorValue: { minWidth: 70, textAlign: "center", fontVariant: ["tabular-nums"] },
  editorActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  stepLarge: { width: 56, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  status: { alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingTop: 96, paddingBottom: 32 },
  statusIcon: { marginBottom: 16 },
  statusMessage: { marginTop: 8 },
  statusActions: { marginTop: 28, gap: 12, alignSelf: "stretch" }
});

// src/ui/Screen.tsx
import { useState as useState4 } from "react";
import { Pressable as Pressable3, RefreshControl, ScrollView, StyleSheet as StyleSheet3, Text as Text3, View as View3 } from "react-native";
import { useSafeAreaInsets as useSafeAreaInsets2 } from "react-native-safe-area-context";

// src/ui/TabBar.tsx
import { BlurView } from "expo-blur";
import { useEffect, useRef as useRef2, useState as useState3 } from "react";
import { AccessibilityInfo, Animated, Pressable as Pressable2, StyleSheet as StyleSheet2, Text as Text2, View as View2 } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
var TAB_BAR_HEIGHT = 64;
var useTabBarInset = () => TAB_BAR_HEIGHT + Math.max(useSafeAreaInsets().bottom, 12) + 16;
var FLAGS = {
  reduceMotion: { query: "isReduceMotionEnabled", event: "reduceMotionChanged" },
  reduceTransparency: { query: "isReduceTransparencyEnabled", event: "reduceTransparencyChanged" }
};
function useAccessibilityFlag(flag) {
  const [value, setValue] = useState3(false);
  useEffect(() => {
    const { query, event } = FLAGS[flag];
    const read = AccessibilityInfo[query];
    read?.call(AccessibilityInfo).then(setValue, () => void 0);
    const sub = AccessibilityInfo.addEventListener(event, setValue);
    return () => sub?.remove();
  }, [flag]);
  return value;
}
function TabBar({
  tabs,
  active,
  onChange
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useAccessibilityFlag("reduceMotion");
  const reduceTransparency = useAccessibilityFlag("reduceTransparency");
  const [width, setWidth] = useState3(0);
  const index = Math.max(0, tabs.findIndex((t) => t.key === active));
  const position = useRef2(new Animated.Value(index)).current;
  useEffect(() => {
    if (reduceMotion) {
      position.setValue(index);
      return;
    }
    Animated.spring(position, { toValue: index, useNativeDriver: true, damping: 26, stiffness: 300, mass: 1 }).start();
  }, [index, position, reduceMotion]);
  const inner = width - 12;
  const itemWidth = tabs.length > 0 ? inner / tabs.length : 0;
  return <View2
    pointerEvents="box-none"
    style={[styles2.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}
  >
      <View2
    onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    style={[styles2.bar, { borderColor: theme.tabBarBorder }]}
    accessibilityRole="tablist"
  >
        {reduceTransparency ? <View2 style={[StyleSheet2.absoluteFill, { backgroundColor: theme.card }]} /> : <BlurView tint={theme.blurTint} intensity={80} style={StyleSheet2.absoluteFill}>
            <View2 style={[StyleSheet2.absoluteFill, { backgroundColor: theme.tabBar }]} />
          </BlurView>}
        {width > 0 && <Animated.View
    style={[
      styles2.indicator,
      {
        width: itemWidth,
        backgroundColor: theme.fill,
        transform: [{ translateX: Animated.multiply(position, itemWidth) }]
      }
    ]}
  />}
        {tabs.map((tab) => {
    const selected = tab.key === active;
    const color = selected ? theme.accent : theme.text;
    return <Pressable2
      key={tab.key}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={tab.label}
      onPress={() => onChange(tab.key)}
      style={({ pressed }) => [styles2.item, pressed && { opacity: 0.6 }]}
    >
              <Icon icon={tab.icon} size={22} color={color} />
              <Text2 style={[styles2.label, { color }]} numberOfLines={1}>
                {tab.label}
              </Text2>
            </Pressable2>;
  })}
      </View2>
    </View2>;
}
var styles2 = StyleSheet2.create({
  wrapper: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  bar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    overflow: "hidden",
    borderWidth: StyleSheet2.hairlineWidth,
    // Tiefe: größere Fläche, weicher Schatten
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12
  },
  indicator: { position: "absolute", left: 6, top: 6, bottom: 6, borderRadius: (TAB_BAR_HEIGHT - 12) / 2 },
  item: { flex: 1, height: "100%", alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontSize: 11, lineHeight: 13, fontWeight: "600", letterSpacing: 0.07 }
});

// src/ui/Screen.tsx
function Screen({
  title,
  children,
  onRefresh,
  onBack
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets2();
  const bottom = useTabBarInset();
  const [refreshing, setRefreshing] = useState4(false);
  return <View3 style={[styles3.root, { backgroundColor: theme.background }]}>
      {onBack && <View3 style={[styles3.navBar, { paddingTop: insets.top + 4, backgroundColor: theme.background }]}>
          <Pressable3
    onPress={onBack}
    hitSlop={12}
    accessibilityRole="button"
    accessibilityLabel="Zurück"
    style={({ pressed }) => [styles3.back, pressed && { opacity: 0.5 }]}
  >
            <Icon icon={icons.back} size={20} color={theme.accent} />
            <Text3 style={[type.body, { color: theme.accent }]}>Zurück</Text3>
          </Pressable3>
          <Text3 style={[type.headline, styles3.navTitle, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text3>
          <View3 style={styles3.back} />
        </View3>}
      <ScrollView
    contentContainerStyle={[
      styles3.content,
      { paddingTop: onBack ? 8 : insets.top + 8, paddingBottom: bottom }
    ]}
    keyboardShouldPersistTaps="handled"
    scrollIndicatorInsets={{ bottom }}
    refreshControl={onRefresh ? <RefreshControl
      refreshing={refreshing}
      tintColor={theme.accent}
      onRefresh={async () => {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
      }}
    /> : void 0}
  >
        {!onBack && <LargeTitle>{title}</LargeTitle>}
        {children}
      </ScrollView>
    </View3>;
}
var styles3 = StyleSheet3.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  navBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 8 },
  back: { flexDirection: "row", alignItems: "center", gap: 2, width: 96 },
  navTitle: { flex: 1, textAlign: "center" }
});

// src/screens/DataScreen.tsx
function DataScreen() {
  const { snapshot, refresh } = useHeating();
  const theme = useTheme();
  if (!snapshot) return null;
  const hp = snapshot.heatPump;
  const sections = [
    {
      title: "W\xE4rmepumpe",
      icon: icons.heat,
      rows: [
        { label: "Vorlauf", value: hp?.flowTemperature },
        { label: "R\xFCcklauf", value: hp?.returnTemperature },
        { label: "Luft rein", value: hp?.sourceInTemperature },
        { label: "Luft raus", value: hp?.sourceOutTemperature }
      ]
    },
    {
      title: "Puffer",
      icon: icons.thermometer,
      rows: [
        { label: "Oben", value: hp?.bufferTopTemperature },
        { label: "Mitte", value: hp?.bufferMidTemperature }
      ]
    },
    {
      title: "Au\xDFen",
      icon: icons.wind,
      rows: [{ label: "Au\xDFentemperatur", value: snapshot.outdoorTemperature }]
    },
    ...snapshot.heatCircuits.map((c) => ({
      title: c.name,
      icon: icons.sun,
      rows: [
        { label: "Aktueller Sollwert", value: c.currentSetTemperature },
        { label: "Komfort", value: c.normalSetTemperature?.value },
        { label: "Absenkung", value: c.reducedSetTemperature?.value },
        { label: "Raum", value: c.roomTemperature },
        { label: "Vorlauf-Soll", value: c.flowSetTemperature }
      ]
    })),
    ...snapshot.hotWaterTanks.map((t) => ({
      title: t.name,
      icon: icons.drop,
      rows: [
        { label: "Ist", value: t.temperature },
        { label: "Soll", value: t.setTemperature?.value }
      ]
    }))
  ];
  return <Screen title="Daten" onRefresh={refresh}>
      {sections.map((section) => {
    const rows = section.rows.filter((r) => r.value !== void 0);
    if (rows.length === 0) return null;
    return <SectionBlock key={section.title} title={section.title} icon={section.icon}>
            {rows.map((r, i) => <Row key={r.label} label={r.label} value={formatTemp(r.value)} last={i === rows.length - 1} />)}
          </SectionBlock>;
  })}
      <Text4 style={[type.footnote, styles4.footer, { color: theme.secondary }]}>
        Stand {snapshot.fetchedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · zum
        Aktualisieren nach unten ziehen
      </Text4>
    </Screen>;
}
function SectionBlock({
  title,
  icon,
  children
}) {
  return <>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <Card style={styles4.list}>{children}</Card>
    </>;
}
var styles4 = StyleSheet4.create({
  list: { paddingVertical: 2 },
  footer: { textAlign: "center", marginTop: 20 }
});

// src/screens/DetailScreens.tsx
import { StyleSheet as StyleSheet5, Text as Text5 } from "react-native";
function HeatCircuitScreen({ index, onBack }) {
  const { snapshot, perform, writing } = useHeating();
  const theme = useTheme();
  const circuit = snapshot?.heatCircuits.find((c) => c.index === index);
  if (!circuit) return null;
  const editors = [
    circuit.normalSetTemperature && {
      key: "normal",
      title: "Komfort (Sonne)",
      setpoint: circuit.normalSetTemperature,
      unit: "\xB0",
      commit: (v) => perform((c) => commands.setNormalTemperature(c, index, v))
    },
    circuit.reducedSetTemperature && {
      key: "reduced",
      title: "Absenkung (Mond)",
      setpoint: circuit.reducedSetTemperature,
      unit: "\xB0",
      commit: (v) => perform((c) => commands.setReducedTemperature(c, index, v))
    },
    circuit.offset && {
      key: "offset",
      title: "Korrektur",
      setpoint: circuit.offset,
      unit: " K",
      commit: (v) => perform((c) => commands.setOffset(c, index, v))
    }
  ].filter((e) => Boolean(e));
  return <Screen title={circuit.name} onBack={onBack}>
      <SectionTitle>Temperaturen</SectionTitle>
      <Card style={styles5.list}>
        {editors.map((e, i) => <SetpointEditor
    key={e.key}
    title={e.title}
    setpoint={e.setpoint}
    step={0.5}
    unit={e.unit}
    disabled={writing}
    last={i === editors.length - 1}
    onCommit={e.commit}
  />)}
      </Card>
      <Text5 style={[type.footnote, styles5.note, { color: theme.secondary }]}>
        Komfort gilt bei Sonne und in den Komfortzeiten der Automatik, Absenkung bei Mond und nachts. Die
        Betriebsart stellst du unter „Heizarten“ um.
      </Text5>
    </Screen>;
}
function HotWaterScreen({ index, onBack }) {
  const { snapshot, perform, writing } = useHeating();
  const theme = useTheme();
  const tank = snapshot?.hotWaterTanks.find((t) => t.index === index);
  if (!tank) return null;
  return <Screen title={tank.name} onBack={onBack}>
      {tank.setTemperature && <>
          <SectionTitle>Temperatur</SectionTitle>
          <Card style={styles5.list}>
            <SetpointEditor
    title="Solltemperatur"
    setpoint={tank.setTemperature}
    step={1}
    disabled={writing}
    last
    onCommit={(v) => perform((c) => commands.setHotWaterTemperature(c, index, v))}
  />
          </Card>
        </>}
      <Text5 style={[type.footnote, styles5.note, { color: theme.secondary }]}>
        Die Betriebsart (z. B. einmal aufheizen) stellst du unter „Heizarten“ um.
      </Text5>
    </Screen>;
}
var styles5 = StyleSheet5.create({
  list: { paddingVertical: 2 },
  note: { marginTop: 8, marginHorizontal: 18 }
});

// src/screens/HomeScreen.tsx
import { useEffect as useEffect2 } from "react";
import { StyleSheet as StyleSheet6, Text as Text6, View as View4 } from "react-native";

// src/screens/modeOptions.ts
var systemModeTiles = [
  { value: 0, label: "Standby", icon: icons.power },
  { value: 1, label: "Warmwasser", icon: icons.drop },
  { value: 2, label: "Automatik heizen", icon: icons.heat }
];
var heatCircuitModeTiles = [
  { value: 0, label: "Aus", icon: icons.power },
  { value: 1, label: "Automatik", icon: icons.clock },
  { value: 2, label: "Komfort", icon: icons.sun },
  { value: 3, label: "Absenkung", icon: icons.moon }
];
var hotWaterModeTiles = [
  { value: 0, label: "Aus", icon: icons.power },
  { value: 1, label: "Automatik", icon: icons.clock },
  { value: 2, label: "Ein", icon: icons.drop },
  { value: 3, label: "Aufheizen", icon: icons.flame }
];
function tileLabel(tiles, value) {
  if (value === void 0) return "\u2013";
  return tiles.find((t) => t.value === value)?.label ?? `Modus ${value}`;
}
function tileIcon(tiles, value) {
  return tiles.find((t) => t.value === value)?.icon;
}

// src/screens/HomeScreen.tsx
function HomeScreen({ navigate }) {
  const { snapshot, refresh, writing, offline } = useHeating();
  const theme = useTheme();
  useEffect2(() => {
    const timer = setInterval(() => void refresh(), 3e4);
    return () => clearInterval(timer);
  }, [refresh]);
  if (!snapshot) return null;
  return <Screen title="Heizung" onRefresh={refresh}>
      <View4 style={styles6.stack}>
        <OverviewCard />
        {snapshot.heatCircuits.map((circuit) => <HeatCircuitCard key={circuit.index} circuit={circuit} onPress={() => navigate({ name: "circuit", index: circuit.index })} />)}
        {snapshot.hotWaterTanks.map((tank) => <HotWaterCard key={tank.index} tank={tank} onPress={() => navigate({ name: "hotWater", index: tank.index })} />)}
        <Text6 style={[type.footnote, styles6.footer, { color: offline ? theme.danger : theme.secondary }]}>
          {writing ? "Wird gespeichert \u2026" : `${offline ? "Keine Verbindung \u2013 letzter Stand" : "Aktualisiert"} ${snapshot.fetchedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
        </Text6>
      </View4>
    </Screen>;
}
function OverviewCard() {
  const { snapshot } = useHeating();
  const theme = useTheme();
  if (!snapshot) return null;
  const systemIcon = tileIcon(systemModeTiles, snapshot.systemOperatingMode);
  return <Card>
      <View4 style={styles6.overview}>
        <Metric label="Außen" value={formatTemp(snapshot.outdoorTemperature)} icon={icons.thermometer} />
        {snapshot.heatPump?.bufferTopTemperature !== void 0 && <Metric label="Puffer" value={formatTemp(snapshot.heatPump.bufferTopTemperature)} icon={icons.heat} />}
      </View4>
      {snapshot.systemOperatingMode !== void 0 && <View4 style={[styles6.chip, { backgroundColor: theme.accentSoft }]}>
          {systemIcon && <Icon icon={systemIcon} size={14} color={theme.accent} />}
          <Text6 style={[type.footnote, styles6.chipText, { color: theme.accent }]}>
            {tileLabel(systemModeTiles, snapshot.systemOperatingMode)}
          </Text6>
        </View4>}
    </Card>;
}
function Metric({ label, value, icon }) {
  const theme = useTheme();
  return <View4 style={styles6.metric}>
      <View4 style={styles6.metricLabel}>
        <Icon icon={icon} size={14} color={theme.secondary} />
        <Text6 style={[type.footnote, { color: theme.secondary }]}>{label}</Text6>
      </View4>
      <Text6 style={[type.displaySmall, { color: theme.text }]}>{value}</Text6>
    </View4>;
}
function ModeChip({ label, icon }) {
  const theme = useTheme();
  return <View4 style={[styles6.chip, styles6.chipInline, { backgroundColor: theme.fill }]}>
      {icon && <Icon icon={icon} size={13} color={theme.secondary} />}
      <Text6 style={[type.caption, { color: theme.secondary }]}>{label}</Text6>
    </View4>;
}
function HeatCircuitCard({ circuit, onPress }) {
  const { perform, writing } = useHeating();
  const theme = useTheme();
  const offset = circuit.offset;
  const target = offset ?? circuit.normalSetTemperature;
  const step = (delta) => {
    if (!target) return;
    let next = target.value + delta;
    if (target.range) next = Math.min(target.range.max, Math.max(target.range.min, next));
    if (next === target.value) return;
    void perform(
      (c) => offset ? commands.setOffset(c, circuit.index, next) : commands.setNormalTemperature(c, circuit.index, next)
    );
  };
  return <Card onPress={onPress}>
      <View4 style={styles6.cardHeader}>
        <Text6 style={[type.headline, styles6.flexShrink, { color: theme.text }]} numberOfLines={1}>
          {circuit.name}
        </Text6>
        {circuit.heatRequest && <Icon icon={icons.flame} size={15} color={theme.accent} />}
        <View4 style={styles6.flex} />
        <ModeChip
    label={tileLabel(heatCircuitModeTiles, circuit.operatingMode)}
    icon={tileIcon(heatCircuitModeTiles, circuit.operatingMode)}
  />
        <Icon icon={icons.forward} size={13} color={theme.tertiary} />
      </View4>
      <View4 style={styles6.circuitBody}>
        <View4 style={styles6.flex}>
          <Text6 style={[type.display, { color: theme.accent }]}>{formatTemp(circuit.currentSetTemperature)}</Text6>
          <Text6 style={[type.footnote, { color: theme.secondary }]}>
            {[
    circuit.normalSetTemperature && `Komfort ${formatTemp(circuit.normalSetTemperature.value)}`,
    circuit.reducedSetTemperature && `Absenkung ${formatTemp(circuit.reducedSetTemperature.value)}`
  ].filter(Boolean).join("  \xB7  ")}
          </Text6>
        </View4>
        {target && <View4 style={styles6.steps}>
            <StepButton large icon={icons.up} label="Wärmer" onPress={() => step(0.5)} disabled={writing} />
            <StepButton large icon={icons.down} label="Kühler" onPress={() => step(-0.5)} disabled={writing} />
          </View4>}
      </View4>
    </Card>;
}
function HotWaterCard({ tank, onPress }) {
  const theme = useTheme();
  return <Card onPress={onPress}>
      <View4 style={styles6.cardHeader}>
        <Icon icon={icons.drop} size={16} color={theme.water} />
        <Text6 style={[type.headline, styles6.flexShrink, { color: theme.text }]} numberOfLines={1}>
          {tank.name}
        </Text6>
        {tank.heatRequest && <Icon icon={icons.flame} size={15} color={theme.accent} />}
        <View4 style={styles6.flex} />
        <ModeChip label={tileLabel(hotWaterModeTiles, tank.operatingMode)} icon={tileIcon(hotWaterModeTiles, tank.operatingMode)} />
        <Icon icon={icons.forward} size={13} color={theme.tertiary} />
      </View4>
      <View4 style={styles6.waterBody}>
        <Text6 style={[type.display, { color: theme.text }]}>{formatTemp(tank.temperature)}</Text6>
        {tank.setTemperature && <Text6 style={[type.footnote, { color: theme.secondary }]}>Soll {formatTemp(tank.setTemperature.value)}</Text6>}
      </View4>
    </Card>;
}
var styles6 = StyleSheet6.create({
  stack: { gap: 12 },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  overview: { flexDirection: "row" },
  metric: { flex: 1, gap: 2 },
  metricLabel: { flexDirection: "row", alignItems: "center", gap: 5 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100
  },
  chipText: { fontWeight: "600" },
  chipInline: { marginTop: 0, paddingHorizontal: 8, paddingVertical: 3 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  circuitBody: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  steps: { gap: 8 },
  waterBody: { marginTop: 6 },
  footer: { textAlign: "center", marginTop: 4 }
});

// src/screens/ModesScreen.tsx
import { StyleSheet as StyleSheet7, Text as Text7 } from "react-native";
var LOCKED = "Kann \xFCber diese Verbindung nicht umgestellt werden \u2013 bitte am Display.";
function ModesScreen() {
  const { snapshot, perform, writing, canWrite, refresh } = useHeating();
  const theme = useTheme();
  if (!snapshot) return null;
  const systemWritable = canWrite(KebaVar.systemOperatingMode);
  return <Screen title="Heizarten" onRefresh={refresh}>
      {snapshot.systemOperatingMode !== void 0 && <>
          <SectionTitle icon={icons.heat}>Anlage</SectionTitle>
          <ModeTiles
    options={systemModeTiles}
    selected={snapshot.systemOperatingMode}
    disabled={writing || !systemWritable}
    onSelect={(mode) => perform((c) => commands.setSystemMode(c, mode))}
  />
          <Text7 style={[type.footnote, styles7.note, { color: theme.secondary }]}>
            {systemWritable ? "Warmwasser = Sommerbetrieb ohne Heizung. Standby = alles aus (Frostschutz)." : LOCKED}
          </Text7>
        </>}

      {snapshot.heatCircuits.map((circuit) => {
    const writable = canWrite(KebaVar.heatCircuit.operatingMode(circuit.index));
    return <ModeSection key={`hc-${circuit.index}`} title={circuit.name} note={writable ? void 0 : LOCKED}>
            <ModeTiles
      options={heatCircuitModeTiles}
      selected={circuit.operatingMode}
      disabled={writing || !writable}
      onSelect={(mode) => perform((c) => commands.setHeatCircuitMode(c, circuit.index, mode))}
    />
          </ModeSection>;
  })}

      {snapshot.hotWaterTanks.map((tank) => {
    const writable = canWrite(KebaVar.hotWaterTank.operatingMode(tank.index));
    return <ModeSection
      key={`hw-${tank.index}`}
      title={tank.name}
      note={writable ? "Aufheizen = einmalig auf die Solltemperatur bringen." : LOCKED}
    >
            <ModeTiles
      options={hotWaterModeTiles}
      selected={tank.operatingMode}
      disabled={writing || !writable}
      onSelect={(mode) => perform((c) => commands.setHotWaterMode(c, tank.index, mode))}
    />
          </ModeSection>;
  })}
    </Screen>;
}
function ModeSection({ title, note, children }) {
  const theme = useTheme();
  return <>
      <SectionTitle>{title}</SectionTitle>
      {children}
      {note && <Text7 style={[type.footnote, styles7.note, { color: theme.secondary }]}>{note}</Text7>}
    </>;
}
var styles7 = StyleSheet7.create({
  note: { marginTop: 8, marginHorizontal: 18 }
});

// src/screens/RemoteHost.tsx
import { useEffect as useEffect3, useRef as useRef3 } from "react";
import { StyleSheet as StyleSheet8, Text as Text8, View as View5 } from "react-native";
import { useSafeAreaInsets as useSafeAreaInsets3 } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
var KebaWebView = WebView;
function RemoteHost() {
  const {
    remoteStage,
    remoteSession,
    portalScript,
    loginNotice,
    bridge,
    onHmiReached,
    onHmiLeft,
    onPortalMessage,
    cancelRemoteLogin,
    revealPortal,
    addDiagnostic,
    diagnostics
  } = useHeating();
  const webView = useRef3(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets3();
  const visible = remoteStage === "login";
  useEffect3(() => {
    bridge.attach(remoteStage === "connected" ? webView.current : null);
  }, [bridge, remoteStage]);
  useEffect3(() => {
    if (remoteStage !== "auto") return;
    const timer = setTimeout(() => {
      addDiagnostic("Zeitgrenze erreicht (60 s)");
      revealPortal("Die automatische Anmeldung h\xE4ngt. Bitte von Hand anmelden und \u201EWebHmi\u201C \u2192 \u201EWWW\u201C antippen.");
    }, 6e4);
    return () => clearTimeout(timer);
  }, [remoteStage, remoteSession, revealPortal, addDiagnostic]);
  useEffect3(() => {
    if (remoteStage !== "auto" || !portalScript) return;
    const timer = setInterval(() => webView.current?.injectJavaScript(portalScript), 3e3);
    return () => clearInterval(timer);
  }, [remoteStage, remoteSession, portalScript]);
  const reachedSession = useRef3(-1);
  const hmiReached = (url) => {
    if (remoteStage !== "auto" && remoteStage !== "login") return;
    if (reachedSession.current === remoteSession) return;
    reachedSession.current = remoteSession;
    addDiagnostic(`HMI erreicht: ${url}`);
    bridge.attach(webView.current);
    onHmiReached();
  };
  useEffect3(() => {
    if (remoteStage === "login") webView.current?.injectJavaScript(STOP_PORTAL_AUTOMATION_SCRIPT);
  }, [remoteStage]);
  if (remoteStage === "idle") return null;
  return <View5
    style={[StyleSheet8.absoluteFill, visible ? { backgroundColor: theme.background } : styles8.hidden]}
    pointerEvents={visible ? "auto" : "none"}
  >
      {visible && <View5 style={[styles8.header, { paddingTop: insets.top + 8, backgroundColor: theme.card }]}>
          <View5 style={styles8.headerRow}>
            <Text8 style={[styles8.title, { color: theme.text }]}>KEBA Fernzugriff</Text8>
            <View5 style={styles8.headerButtons}>
              <Button title="Neu laden" kind="secondary" onPress={() => webView.current?.reload()} />
              <Button title="Abbrechen" kind="secondary" onPress={cancelRemoteLogin} />
            </View5>
          </View5>
          <Text8 style={[styles8.hint, { color: theme.secondary }]}>
            {loginNotice ?? "Tipp: Trage deine Zugangsdaten in den Einstellungen ein, dann meldet sich die App k\xFCnftig selbst an. Jetzt: anmelden, Anlage aufklappen, \u201EWebHmi\u201C und dann \u201EWWW\u201C antippen."}
          </Text8>
          {loginNotice !== void 0 && diagnostics.slice(-5).map((line, i) => <Text8 key={i} style={[styles8.diagnostic, { color: theme.secondary }]} numberOfLines={2}>
                {line}
              </Text8>)}
        </View5>}
      <KebaWebView
    key={remoteSession}
    ref={webView}
    source={{ uri: REMOTE_PORTAL_URL }}
    style={styles8.flex}
    injectedJavaScript={portalScript}
    sharedCookiesEnabled
    javaScriptEnabled
    domStorageEnabled
    javaScriptCanOpenWindowsAutomatically
    setSupportMultipleWindows={false}
    onMessage={(event) => {
      const data = event.nativeEvent.data;
      if (bridge.handleMessage(data)) return;
      const portal = parsePortalMessage(data);
      if (!portal) return;
      if ("step" in portal && portal.step === "hmi") hmiReached(portal.info ?? "");
      else onPortalMessage(portal);
    }}
    onLoadStart={(event) => addDiagnostic(`L\xE4dt: ${event.nativeEvent.url}`)}
    onError={(event) => addDiagnostic(`Ladefehler: ${event.nativeEvent.description} (${event.nativeEvent.url})`)}
    onHttpError={(event) => addDiagnostic(`HTTP ${event.nativeEvent.statusCode}: ${event.nativeEvent.url}`)}
    onLoadEnd={(event) => {
      const url = event.nativeEvent.url;
      addDiagnostic(`Geladen: ${url}`);
      const isHmi = hmiBaseUrl(url) !== void 0;
      if (remoteStage === "auto" && !isHmi && portalScript) {
        webView.current?.injectJavaScript(portalScript);
      }
      if (isHmi) {
        hmiReached(url);
      } else if (remoteStage === "connected" && !isHmi) {
        onHmiLeft();
      }
    }}
  />
    </View5>;
}
var styles8 = StyleSheet8.create({
  flex: { flex: 1 },
  // Volle Größe (damit das Portal normal layoutet), aber unsichtbar und ohne Berührungen.
  hidden: { opacity: 0.01, zIndex: -1 },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerButtons: { flexDirection: "row", gap: 8 },
  title: { fontSize: 20, fontWeight: "700" },
  hint: { fontSize: 14, marginTop: 6 },
  diagnostic: { fontSize: 11, marginTop: 4 }
});

// src/screens/SettingsScreen.tsx
import { useState as useState5 } from "react";
import { Pressable as Pressable4, StyleSheet as StyleSheet9, Text as Text9, TextInput, View as View6 } from "react-native";
function SettingsScreen({
  settings,
  onChange,
  onDone
}) {
  const { connect, disconnect, phase } = useHeating();
  const theme = useTheme();
  const [draft, setDraft] = useState5(settings);
  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const saveAndConnect = async () => {
    onChange(draft);
    await saveSettings(draft);
    onDone();
    await connect(draft);
  };
  const canConnect = draft.mode === "remote" || draft.modbusAddress.trim() !== "";
  return <Screen title="Einstellungen">
      <SectionTitle>Verbindung</SectionTitle>
      <View6 style={[styles9.segment, { backgroundColor: theme.fill }]} accessibilityRole="tablist">
        {["modbus", "remote"].map((mode) => <Pressable4
    key={mode}
    accessibilityRole="tab"
    accessibilityState={{ selected: draft.mode === mode }}
    onPress={() => {
      if (draft.mode !== mode) haptic.select();
      update({ mode });
    }}
    style={[styles9.segmentItem, draft.mode === mode && [styles9.segmentActive, { backgroundColor: theme.card }]]}
  >
            <Text9 style={[type.subhead, styles9.segmentText, { color: theme.text }]}>
              {MODE_LABELS[mode]}
            </Text9>
          </Pressable4>)}
      </View6>

      {draft.mode === "modbus" ? <>
          <SectionTitle>Wärmepumpe im Heimnetz (Modbus)</SectionTitle>
          <Card style={styles9.form}>
            <Field
    value={draft.modbusAddress}
    onChangeText={(modbusAddress) => update({ modbusAddress })}
    placeholder="IP-Adresse, z. B. 192.168.0.100"
    keyboardType="numbers-and-punctuation"
  />
            <Field
    value={draft.circuitNames}
    onChangeText={(circuitNames) => update({ circuitNames })}
    placeholder="Heizkreise, z. B. Puffer FBH, Heizkörper"
    last
  />
          </Card>
          <Text9 style={[styles9.footnote, { color: theme.secondary }]}>
            Direkt mit der Wärmepumpe – ohne Website, ohne Passwort. Die IP-Adresse steht am Display unter
            Netzwerk → LAN. Die Namen der Heizkreise (kommagetrennt, in der Reihenfolge am Display) legen fest,
            wie viele Heizkreise angezeigt werden. Funktioniert im WLAN zuhause oder per VPN.
          </Text9>
          {!isModbusAvailable() && <Text9 style={[styles9.footnote, { color: theme.danger }]}>
              In Expo Go/Snack gibt es keine direkten Netzwerkverbindungen. Modbus funktioniert erst in der
              eigenen App-Version (EAS Build). Zum Testen in Snack „Fernzugriff“ wählen.
            </Text9>}
        </> : <>
          <SectionTitle>Zugang remote.keba.com</SectionTitle>
          <Card style={styles9.form}>
            <Field
    value={draft.portalUsername}
    onChangeText={(portalUsername) => update({ portalUsername })}
    placeholder="Benutzername"
    textContentType="username"
    autoComplete="username"
  />
            <Field
    value={draft.portalPassword}
    onChangeText={(portalPassword) => update({ portalPassword })}
    placeholder="Passwort"
    secureTextEntry
    textContentType="password"
    autoComplete="password"
  />
            <Field
    value={draft.portalDevice}
    onChangeText={(portalDevice) => update({ portalDevice })}
    placeholder="Geräteeintrag (Standard: WebHmi)"
    last
  />
          </Card>
          <Text9 style={[styles9.footnote, { color: theme.secondary }]}>
            Dieselben Daten wie auf remote.keba.com/app. Die App meldet sich damit unsichtbar selbst an,
            öffnet „WebHmi“ und steuert die Heizung direkt – du siehst die Portal-Seite nicht mehr.
            Das Passwort liegt verschlüsselt im iOS-Schlüsselbund.
          </Text9>
        </>}

      <Button
    title={draft.mode === "remote" && !hasPortalCredentials(draft) ? "Ohne Speichern im Portal anmelden" : "Speichern & verbinden"}
    style={styles9.action}
    disabled={!canConnect}
    onPress={saveAndConnect}
  />

      {phase !== "notConnected" && <Button title="Verbindung trennen" kind="danger" style={styles9.action} onPress={disconnect} />}
    </Screen>;
}
var MODE_LABELS = {
  modbus: "Modbus",
  remote: "KEBA Fernzugriff"
};
function Field({ last, ...props }) {
  const theme = useTheme();
  return <TextInput
    placeholderTextColor={theme.secondary}
    autoCapitalize="none"
    autoCorrect={false}
    {...props}
    style={[
      styles9.input,
      { color: theme.text, borderBottomColor: theme.separator, borderBottomWidth: last ? 0 : StyleSheet9.hairlineWidth }
    ]}
  />;
}
var styles9 = StyleSheet9.create({
  segment: { flexDirection: "row", borderRadius: 10, padding: 3 },
  segmentActive: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  segmentItem: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  segmentText: { fontSize: 15, fontWeight: "600" },
  footnote: { fontSize: 13, marginTop: 8, marginHorizontal: 4 },
  form: { paddingVertical: 0 },
  input: { fontSize: 17, paddingVertical: 14 },
  action: { marginTop: 20 }
});

// App.tsx
var TABS = [
  { key: "home", label: "Start", icon: icons.home },
  { key: "modes", label: "Heizarten", icon: icons.modes },
  { key: "data", label: "Daten", icon: icons.data },
  { key: "settings", label: "Einstellungen", icon: icons.settings }
];
var TITLES = {
  home: "Heizung",
  modes: "Heizarten",
  data: "Daten",
  settings: "Einstellungen"
};
function App() {
  return <SafeAreaProvider>
      <HeatingProvider>
        <Main />
      </HeatingProvider>
    </SafeAreaProvider>;
}
function Main() {
  const heating = useHeating();
  const theme = useTheme();
  const [settings, setSettings] = useState6(defaultSettings);
  const [tab, setTab] = useState6("home");
  const [detail, setDetail] = useState6(null);
  useEffect4(() => {
    void loadSettings().then((loaded) => {
      setSettings(loaded);
      if (isConfigured(loaded)) void heating.connect(loaded);
    });
  }, []);
  useEffect4(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void heating.refresh();
    });
    return () => sub.remove();
  }, [heating.refresh]);
  useEffect4(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (heating.remoteStage === "login") {
        heating.cancelRemoteLogin();
        return true;
      }
      if (detail) {
        setDetail(null);
        return true;
      }
      if (tab !== "home") {
        setTab("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [detail, tab, heating.remoteStage, heating.cancelRemoteLogin]);
  useEffect4(() => {
    if (heating.transientError) {
      haptic.error();
      Alert.alert("Fehler", heating.transientError, [{ text: "OK", onPress: heating.clearTransientError }]);
    }
  }, [heating.transientError, heating.clearTransientError]);
  useEffect4(() => {
    if (heating.phase !== "ready") setDetail(null);
  }, [heating.phase]);
  const connect = () => {
    if (isConfigured(settings)) void heating.connect(settings);
    else setTab("settings");
  };
  const selectTab = (next) => {
    if (next === tab && next === "home") setDetail(null);
    setTab(next);
  };
  let content;
  if (tab === "settings") {
    content = <SettingsScreen settings={settings} onChange={setSettings} onDone={() => setTab("home")} />;
  } else if (heating.phase !== "ready") {
    content = <Screen title={TITLES[tab]}>
        <ConnectionState connect={connect} openSettings={() => setTab("settings")} />
      </Screen>;
  } else if (tab === "modes") {
    content = <ModesScreen />;
  } else if (tab === "data") {
    content = <DataScreen />;
  } else if (detail?.name === "circuit") {
    content = <HeatCircuitScreen index={detail.index} onBack={() => setDetail(null)} />;
  } else if (detail?.name === "hotWater") {
    content = <HotWaterScreen index={detail.index} onBack={() => setDetail(null)} />;
  } else {
    content = <HomeScreen navigate={setDetail} />;
  }
  return <View7 style={[styles10.root, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <View7 style={styles10.root}>{content}</View7>
      <TabBar tabs={TABS} active={tab} onChange={selectTab} />
      <RemoteHost />
    </View7>;
}
function ConnectionState({ connect, openSettings }) {
  const { phase, error, progress, remoteStage, revealPortal, diagnostics } = useHeating();
  switch (phase) {
    case "loading":
      return <StatusView title={progress || "Lade Daten \u2026"} loading>
          {remoteStage === "auto" && <Button
        title="Anmeldeseite anzeigen"
        kind="secondary"
        onPress={() => revealPortal("Du kannst hier zuschauen oder von Hand weitermachen (\u201EWebHmi\u201C \u2192 \u201EWWW\u201C).")}
      />}
          <Diagnostics lines={diagnostics} />
        </StatusView>;
    case "failed":
      return <StatusView title="Keine Verbindung" message={error} icon={icons.wifiOff}>
          <Button title="Erneut versuchen" onPress={connect} />
          <Button title="Einstellungen" kind="secondary" onPress={openSettings} />
        </StatusView>;
    case "sessionExpired":
      return <StatusView title="Sitzung abgelaufen" message="Der Fernzugriff wurde geschlossen." icon={icons.wifiOff}>
          <Button title="Neu verbinden" onPress={connect} />
        </StatusView>;
    default:
      return <StatusView
        title="Nicht verbunden"
        message="Richte einmal die Verbindung ein. Danach verbindet sich die App bei jedem Start von selbst."
        icon={icons.heat}
      >
          <Button title="Einrichten" onPress={openSettings} />
        </StatusView>;
  }
}
function Diagnostics({ lines }) {
  const theme = useTheme();
  if (lines.length === 0) return null;
  return <View7 style={styles10.diagnostics}>
      {lines.slice(-4).map((line, i) => <Text10 key={i} style={[styles10.diagnosticLine, { color: theme.secondary }]} numberOfLines={3}>
          {line}
        </Text10>)}
    </View7>;
}
var styles10 = StyleSheet10.create({
  root: { flex: 1 },
  diagnostics: { marginTop: 12, gap: 4 },
  diagnosticLine: { fontSize: 11 }
});
export {
  App as default
};
