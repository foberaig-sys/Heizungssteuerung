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

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// App.tsx
import { StatusBar } from "expo-status-bar";
import { useEffect as useEffect3, useState as useState5 } from "react";
import { Alert, AppState, BackHandler, Pressable as Pressable4, StyleSheet as StyleSheet6, Text as Text6, View as View5 } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets as useSafeAreaInsets2 } from "react-native-safe-area-context";

// src/screens/DetailScreens.tsx
import { ScrollView, StyleSheet as StyleSheet2, Text as Text2 } from "react-native";

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
var SystemModes = [
  { value: -1, label: "Inbetriebnahme" },
  { value: 0, label: "Standby" },
  { value: 1, label: "Nur Warmwasser" },
  { value: 2, label: "Automatik heizen" },
  { value: 3, label: "K\xFChlen" },
  { value: 4, label: "Automatik Heizen/K\xFChlen" }
];
var selectableSystemModes = [0, 1, 2];
var HeatCircuitModes = [
  { value: 0, label: "Aus" },
  { value: 1, label: "Automatik (Zeitprogramm)" },
  { value: 2, label: "Dauernd Komfort" },
  { value: 3, label: "Dauernd Absenkung" },
  { value: 4, label: "Urlaub" },
  { value: 5, label: "Party" },
  { value: 8, label: "Extern" },
  { value: 9, label: "Raumregelung" }
];
var selectableHeatCircuitModes = [0, 1, 2, 3];
var HotWaterModes = [
  { value: 0, label: "Aus" },
  { value: 1, label: "Automatik (Zeitprogramm)" },
  { value: 2, label: "Dauernd Ein" },
  { value: 3, label: "Aufheizen" }
];
var selectableHotWaterModes = [0, 1, 2, 3];
function modeLabel(modes, value) {
  if (value === void 0) return "\u2013";
  return modes.find((m) => m.value === value)?.label ?? `Modus ${value}`;
}

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

// src/store.tsx
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

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

// src/ui/theme.ts
import { useColorScheme } from "react-native";
var ORANGE = "#FF9E00";
var light = {
  background: "#F2F2F7",
  card: "#FFFFFF",
  text: "#1C1C1E",
  secondary: "#6E6E73",
  separator: "#D1D1D6",
  accent: ORANGE,
  accentText: "#FFFFFF",
  water: "#0A84FF",
  danger: "#FF3B30",
  pressed: "#E5E5EA"
};
var dark = {
  background: "#000000",
  card: "#1C1C1E",
  text: "#F2F2F7",
  secondary: "#98989F",
  separator: "#38383A",
  accent: ORANGE,
  accentText: "#000000",
  water: "#64D2FF",
  danger: "#FF453A",
  pressed: "#2C2C2E"
};
function useTheme() {
  return useColorScheme() === "dark" ? dark : light;
}
function formatTemp(value, unit = "\xB0") {
  if (value === void 0) return "\u2013";
  return value.toFixed(1).replace(".", ",") + unit;
}
function formatSigned(value, unit = " K") {
  const text = Math.abs(value).toFixed(1).replace(".", ",");
  return (value > 0 ? "+" : value < 0 ? "\u2212" : "\xB1") + text + unit;
}

// src/ui/components.tsx
function Card({ children, onPress, style }) {
  const theme = useTheme();
  const content = (pressed) => [
    styles.card,
    { backgroundColor: pressed && onPress ? theme.pressed : theme.card },
    style
  ];
  if (!onPress) return <View style={content(false)}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => content(pressed)}>
      {children}
    </Pressable>;
}
function SectionTitle({ children }) {
  const theme = useTheme();
  return <Text style={[styles.sectionTitle, { color: theme.secondary }]}>{children.toUpperCase()}</Text>;
}
function Row({ label, value, last }) {
  const theme = useTheme();
  return <View style={[styles.row, !last && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.secondary }]}>{value}</Text>
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
  const background = kind === "primary" ? theme.accent : theme.pressed;
  const color = kind === "primary" ? theme.accentText : kind === "danger" ? theme.danger : theme.text;
  return <Pressable
    accessibilityRole="button"
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.button,
      { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      style
    ]}
  >
      <Text style={[styles.buttonText, { color }]}>{title}</Text>
    </Pressable>;
}
function OptionList({
  options,
  selected,
  onSelect,
  disabled
}) {
  const theme = useTheme();
  return <Card style={styles.listCard}>
      {options.map((option, i) => <Pressable
    key={option.value}
    accessibilityRole="radio"
    accessibilityState={{ selected: option.value === selected, disabled }}
    disabled={disabled}
    onPress={() => option.value !== selected && onSelect(option.value)}
    style={({ pressed }) => [
      styles.row,
      styles.listRow,
      pressed && { backgroundColor: theme.pressed },
      i < options.length - 1 && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }
    ]}
  >
          <Text style={[styles.rowLabel, { color: disabled ? theme.secondary : theme.text }]}>{option.label}</Text>
          {option.value === selected && <Text style={[styles.check, { color: theme.accent }]}>✓</Text>}
        </Pressable>)}
    </Card>;
}
function SetpointEditor({
  title,
  setpoint: setpoint2,
  step,
  unit = "\xB0",
  disabled,
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
  return <View style={styles.editor}>
      <View style={styles.editorRow}>
        <Text style={[styles.rowLabel, { color: theme.text, flex: 1 }]}>{title}</Text>
        <StepButton label="−" onPress={() => change(-step)} disabled={disabled || value <= min} />
        <Text style={[styles.editorValue, { color: draft === void 0 ? theme.text : theme.accent }]}>
          {formatTemp(value, unit)}
        </Text>
        <StepButton label="+" onPress={() => change(step)} disabled={disabled || value >= max} />
      </View>
      {draft !== void 0 && <View style={styles.editorActions}>
          <Button title="Verwerfen" kind="secondary" onPress={() => setDraft(void 0)} style={styles.flex} />
          <Button
    title="Übernehmen"
    disabled={disabled}
    onPress={async () => {
      await onCommit(draft);
      setDraft(void 0);
    }}
    style={styles.flex}
  />
        </View>}
    </View>;
}
function StepButton({
  label,
  onPress,
  disabled,
  large
}) {
  const theme = useTheme();
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label === "+" || label === "\u25B2" ? "H\xF6her" : "Niedriger"}
    onPress={onPress}
    disabled={disabled}
    hitSlop={6}
    style={({ pressed }) => [
      large ? styles.stepLarge : styles.step,
      { backgroundColor: pressed ? theme.separator : theme.pressed, opacity: disabled ? 0.35 : 1 }
    ]}
  >
      <Text style={[large ? styles.stepLargeText : styles.stepText, { color: theme.text }]}>{label}</Text>
    </Pressable>;
}
function StatusView({
  title,
  message,
  loading,
  children
}) {
  const theme = useTheme();
  return <View style={styles.status}>
      {loading && <ActivityIndicator size="large" color={theme.accent} style={{ marginBottom: 16 }} />}
      <Text style={[styles.statusTitle, { color: theme.text }]}>{title}</Text>
      {message && <Text style={[styles.statusMessage, { color: theme.secondary }]}>{message}</Text>}
      <View style={styles.statusActions}>{children}</View>
    </View>;
}
var styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16 },
  listCard: { padding: 0, overflow: "hidden" },
  sectionTitle: { fontSize: 13, marginTop: 20, marginBottom: 6, marginLeft: 16 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  listRow: { paddingHorizontal: 16, minHeight: 48 },
  rowLabel: { fontSize: 17 },
  rowValue: { fontSize: 17, fontVariant: ["tabular-nums"] },
  check: { fontSize: 18, fontWeight: "600" },
  button: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: "center" },
  buttonText: { fontSize: 17, fontWeight: "600" },
  editor: { paddingVertical: 10 },
  editorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  editorValue: { fontSize: 20, fontWeight: "600", minWidth: 72, textAlign: "center", fontVariant: ["tabular-nums"] },
  editorActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  flex: { flex: 1 },
  step: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 22, fontWeight: "500" },
  stepLarge: { width: 60, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepLargeText: { fontSize: 22, fontWeight: "600" },
  status: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  statusTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  statusMessage: { fontSize: 16, textAlign: "center", marginTop: 8 },
  statusActions: { marginTop: 24, gap: 12, alignSelf: "stretch" }
});

// src/screens/DetailScreens.tsx
var MODE_LOCKED_NOTE = "Die Betriebsart wird \xFCber Modbus angezeigt, das Umstellen ist hier noch nicht freigeschaltet (bitte am Display).";
function HeatCircuitScreen({ index }) {
  const { snapshot, perform, writing, canWrite } = useHeating();
  const modeWritable = canWrite(KebaVar.heatCircuit.operatingMode(index));
  const theme = useTheme();
  const circuit = snapshot?.heatCircuits.find((c) => c.index === index);
  if (!circuit) return null;
  const modes = HeatCircuitModes.filter(
    (m) => selectableHeatCircuitModes.includes(m.value) || m.value === circuit.operatingMode
  );
  return <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles2.content}>
      <SectionTitle>Status</SectionTitle>
      <Card style={styles2.listCard}>
        <Row label="Aktueller Sollwert" value={formatTemp(circuit.currentSetTemperature)} />
        {circuit.roomTemperature !== void 0 && <Row label="Raumtemperatur" value={formatTemp(circuit.roomTemperature)} />}
        {circuit.roomHumidity !== void 0 && <Row label="Luftfeuchte" value={`${Math.round(circuit.roomHumidity)} %`} />}
        {circuit.flowSetTemperature !== void 0 && <Row label="Vorlauf-Soll" value={formatTemp(circuit.flowSetTemperature)} />}
        <Row label="Heizanforderung" value={circuit.heatRequest ? "Ja" : "Nein"} last />
      </Card>

      <SectionTitle>Betriebsart</SectionTitle>
      <OptionList
    options={modes}
    selected={circuit.operatingMode}
    disabled={writing || !modeWritable}
    onSelect={(mode) => perform((c) => commands.setHeatCircuitMode(c, index, mode))}
  />
      {!modeWritable && <Text2 style={[styles2.footnote, { color: theme.secondary }]}>{MODE_LOCKED_NOTE}</Text2>}

      <SectionTitle>Temperaturen</SectionTitle>
      <Card style={styles2.listCard}>
        {circuit.normalSetTemperature && <SetpointEditor
    title="Komfort (Tag)"
    setpoint={circuit.normalSetTemperature}
    step={0.5}
    disabled={writing}
    onCommit={(v) => perform((c) => commands.setNormalTemperature(c, index, v))}
  />}
        {circuit.reducedSetTemperature && <SetpointEditor
    title="Absenkung (Nacht)"
    setpoint={circuit.reducedSetTemperature}
    step={0.5}
    disabled={writing}
    onCommit={(v) => perform((c) => commands.setReducedTemperature(c, index, v))}
  />}
        {circuit.offset && <SetpointEditor
    title="Korrektur"
    setpoint={circuit.offset}
    step={0.5}
    unit=" K"
    disabled={writing}
    onCommit={(v) => perform((c) => commands.setOffset(c, index, v))}
  />}
      </Card>
      <Text2 style={[styles2.footnote, { color: theme.secondary }]}>
        Die Korrektur entspricht den Pfeiltasten auf dem Startbildschirm der Heizung. Aktuell:{" "}
        {modeLabel(HeatCircuitModes, circuit.operatingMode)}.
      </Text2>
    </ScrollView>;
}
function HotWaterScreen({ index }) {
  const { snapshot, perform, writing, canWrite } = useHeating();
  const modeWritable = canWrite(KebaVar.hotWaterTank.operatingMode(index));
  const theme = useTheme();
  const tank = snapshot?.hotWaterTanks.find((t) => t.index === index);
  if (!tank) return null;
  return <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles2.content}>
      <SectionTitle>Status</SectionTitle>
      <Card style={styles2.listCard}>
        <Row label="Temperatur oben" value={formatTemp(tank.temperature)} />
        <Row label="Wird geheizt" value={tank.heatRequest ? "Ja" : "Nein"} last />
      </Card>

      <SectionTitle>Betriebsart</SectionTitle>
      <OptionList
    options={HotWaterModes.filter((m) => selectableHotWaterModes.includes(m.value))}
    selected={tank.operatingMode}
    disabled={writing || !modeWritable}
    onSelect={(mode) => perform((c) => commands.setHotWaterMode(c, index, mode))}
  />
      {!modeWritable && <Text2 style={[styles2.footnote, { color: theme.secondary }]}>{MODE_LOCKED_NOTE}</Text2>}

      {tank.setTemperature && <>
          <SectionTitle>Temperatur</SectionTitle>
          <Card style={styles2.listCard}>
            <SetpointEditor
    title="Solltemperatur"
    setpoint={tank.setTemperature}
    step={1}
    disabled={writing}
    onCommit={(v) => perform((c) => commands.setHotWaterTemperature(c, index, v))}
  />
          </Card>
        </>}
    </ScrollView>;
}
var styles2 = StyleSheet2.create({
  content: { padding: 16, paddingBottom: 40 },
  listCard: { paddingVertical: 4 },
  footnote: { fontSize: 13, marginTop: 8, marginHorizontal: 16 }
});

// src/screens/Dashboard.tsx
import { useEffect, useState as useState3 } from "react";
import { Modal, Pressable as Pressable2, RefreshControl, ScrollView as ScrollView2, StyleSheet as StyleSheet3, Text as Text3, View as View2 } from "react-native";
function Dashboard({ navigate }) {
  const { snapshot, refresh, writing, offline } = useHeating();
  const theme = useTheme();
  const [pulling, setPulling] = useState3(false);
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 3e4);
    return () => clearInterval(timer);
  }, [refresh]);
  if (!snapshot) return null;
  return <ScrollView2
    style={{ backgroundColor: theme.background }}
    contentContainerStyle={styles3.content}
    refreshControl={<RefreshControl
      refreshing={pulling}
      tintColor={theme.accent}
      onRefresh={async () => {
        setPulling(true);
        await refresh();
        setPulling(false);
      }}
    />}
  >
      <SystemCard />
      {snapshot.heatCircuits.map((circuit) => <HeatCircuitCard key={circuit.index} circuit={circuit} onPress={() => navigate({ name: "circuit", index: circuit.index })} />)}
      {snapshot.hotWaterTanks.map((tank) => <HotWaterCard key={tank.index} tank={tank} onPress={() => navigate({ name: "hotWater", index: tank.index })} />)}
      {snapshot.heatPump && <HeatPumpCard heatPump={snapshot.heatPump} />}
      <Text3 style={[styles3.footer, { color: theme.secondary }]}>
        {writing ? "Wird gespeichert \u2026" : `${offline ? "Keine Verbindung \u2013 letzter Stand" : "Stand"}: ${snapshot.fetchedAt.toLocaleTimeString("de-DE")}`}
      </Text3>
    </ScrollView2>;
}
function SystemCard() {
  const { snapshot, perform, writing, canWrite } = useHeating();
  const modeWritable = canWrite(KebaVar.systemOperatingMode);
  const theme = useTheme();
  const [picking, setPicking] = useState3(false);
  if (!snapshot) return null;
  return <Card style={styles3.systemCard}>
      <View2>
        <Text3 style={[styles3.caption, { color: theme.secondary }]}>Außen</Text3>
        <Text3 style={[styles3.mediumTemp, { color: theme.text }]}>{formatTemp(snapshot.outdoorTemperature)}</Text3>
      </View2>
      {
    /* Über Modbus ist die Anlagen-Betriebsart (noch) nicht bekannt → Auswahl ausblenden. */
  }
      {snapshot.systemOperatingMode !== void 0 && <Pressable2
    onPress={() => setPicking(true)}
    disabled={writing || !modeWritable}
    style={styles3.systemMode}
    hitSlop={8}
  >
          <Text3 style={[styles3.caption, { color: theme.secondary }]}>Anlage</Text3>
          <Text3 style={[styles3.systemModeText, { color: theme.accent }]}>
            {modeLabel(SystemModes, snapshot.systemOperatingMode)} ▾
          </Text3>
        </Pressable2>}

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable2 style={styles3.backdrop} onPress={() => setPicking(false)}>
          <View2 style={styles3.sheet}>
            <Text3 style={[styles3.sheetTitle, { color: "#fff" }]}>Betriebsart der Anlage</Text3>
            <OptionList
    options={SystemModes.filter((m) => selectableSystemModes.includes(m.value))}
    selected={snapshot.systemOperatingMode}
    onSelect={(mode) => {
      setPicking(false);
      void perform((c) => commands.setSystemMode(c, mode));
    }}
  />
          </View2>
        </Pressable2>
      </Modal>
    </Card>;
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
      <View2 style={styles3.cardHeader}>
        <Text3 style={[styles3.cardTitle, { color: theme.text }]}>
          {circuit.name}
          {circuit.heatRequest ? "  \u{1F525}" : ""}
        </Text3>
        <Text3 style={[styles3.caption, { color: theme.secondary }]}>
          {modeLabel(HeatCircuitModes, circuit.operatingMode)} ›
        </Text3>
      </View2>
      <View2 style={styles3.circuitBody}>
        <View2 style={{ flex: 1 }}>
          <Text3 style={[styles3.bigTemp, { color: theme.accent }]}>{formatTemp(circuit.currentSetTemperature)}</Text3>
          {offset && offset.value !== 0 && <Text3 style={[styles3.caption, { color: theme.secondary }]}>Korrektur {formatSigned(offset.value)}</Text3>}
          {circuit.roomTemperature !== void 0 && <Text3 style={[styles3.subline, { color: theme.secondary }]}>Raum {formatTemp(circuit.roomTemperature)}</Text3>}
        </View2>
        {target && <View2 style={styles3.steps}>
            <StepButton large label="▲" onPress={() => step(0.5)} disabled={writing} />
            <StepButton large label="▼" onPress={() => step(-0.5)} disabled={writing} />
          </View2>}
      </View2>
    </Card>;
}
function HeatPumpCard({ heatPump }) {
  const theme = useTheme();
  const rows = [
    ["Vorlauf", heatPump.flowTemperature],
    ["R\xFCcklauf", heatPump.returnTemperature],
    ["Puffer oben", heatPump.bufferTopTemperature],
    ["Puffer Mitte", heatPump.bufferMidTemperature],
    ["Luft rein", heatPump.sourceInTemperature],
    ["Luft raus", heatPump.sourceOutTemperature]
  ];
  return <Card>
      <Text3 style={[styles3.cardTitle, { color: theme.text, marginBottom: 8 }]}>Wärmepumpe</Text3>
      <View2 style={styles3.grid}>
        {rows.filter(([, value]) => value !== void 0).map(([label, value]) => <View2 key={label} style={styles3.gridItem}>
              <Text3 style={[styles3.caption, { color: theme.secondary }]}>{label}</Text3>
              <Text3 style={[styles3.gridValue, { color: theme.text }]}>{formatTemp(value)}</Text3>
            </View2>)}
      </View2>
    </Card>;
}
function HotWaterCard({ tank, onPress }) {
  const theme = useTheme();
  return <Card onPress={onPress} style={styles3.waterCard}>
      <Text3 style={[styles3.drop, { color: theme.water }]}>💧</Text3>
      <View2 style={{ flex: 1 }}>
        <Text3 style={[styles3.cardTitle, { color: theme.text }]}>
          {tank.name}
          {tank.heatRequest ? "  \u{1F525}" : ""}
        </Text3>
        <Text3 style={[styles3.caption, { color: theme.secondary }]}>
          Soll {formatTemp(tank.setTemperature?.value)} · {modeLabel(HotWaterModes, tank.operatingMode)}
        </Text3>
      </View2>
      <Text3 style={[styles3.mediumTemp, { color: theme.text }]}>{formatTemp(tank.temperature)}</Text3>
    </Card>;
}
var styles3 = StyleSheet3.create({
  content: { padding: 16, gap: 14 },
  systemCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  systemMode: { alignItems: "flex-end", flexShrink: 1, marginLeft: 12 },
  systemModeText: { fontSize: 17, fontWeight: "600", textAlign: "right" },
  caption: { fontSize: 14 },
  subline: { fontSize: 16, marginTop: 2 },
  mediumTemp: { fontSize: 32, fontWeight: "600", fontVariant: ["tabular-nums"] },
  bigTemp: { fontSize: 64, fontWeight: "500", fontVariant: ["tabular-nums"], letterSpacing: -1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: "600", flexShrink: 1 },
  circuitBody: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  steps: { gap: 10 },
  waterCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  drop: { fontSize: 28 },
  footer: { textAlign: "center", fontSize: 13, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  gridItem: { width: "50%" },
  gridValue: { fontSize: 20, fontWeight: "600", fontVariant: ["tabular-nums"] },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
  sheet: { gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: "600", textAlign: "center" }
});

// src/screens/RemoteHost.tsx
import { useEffect as useEffect2, useRef as useRef2 } from "react";
import { StyleSheet as StyleSheet4, Text as Text4, View as View3 } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const webView = useRef2(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const visible = remoteStage === "login";
  useEffect2(() => {
    bridge.attach(remoteStage === "connected" ? webView.current : null);
  }, [bridge, remoteStage]);
  useEffect2(() => {
    if (remoteStage !== "auto") return;
    const timer = setTimeout(() => {
      addDiagnostic("Zeitgrenze erreicht (60 s)");
      revealPortal("Die automatische Anmeldung h\xE4ngt. Bitte von Hand anmelden und \u201EWebHmi\u201C \u2192 \u201EWWW\u201C antippen.");
    }, 6e4);
    return () => clearTimeout(timer);
  }, [remoteStage, remoteSession, revealPortal, addDiagnostic]);
  useEffect2(() => {
    if (remoteStage !== "auto" || !portalScript) return;
    const timer = setInterval(() => webView.current?.injectJavaScript(portalScript), 3e3);
    return () => clearInterval(timer);
  }, [remoteStage, remoteSession, portalScript]);
  const reachedSession = useRef2(-1);
  const hmiReached = (url) => {
    if (remoteStage !== "auto" && remoteStage !== "login") return;
    if (reachedSession.current === remoteSession) return;
    reachedSession.current = remoteSession;
    addDiagnostic(`HMI erreicht: ${url}`);
    bridge.attach(webView.current);
    onHmiReached();
  };
  useEffect2(() => {
    if (remoteStage === "login") webView.current?.injectJavaScript(STOP_PORTAL_AUTOMATION_SCRIPT);
  }, [remoteStage]);
  if (remoteStage === "idle") return null;
  return <View3
    style={[StyleSheet4.absoluteFill, visible ? { backgroundColor: theme.background } : styles4.hidden]}
    pointerEvents={visible ? "auto" : "none"}
  >
      {visible && <View3 style={[styles4.header, { paddingTop: insets.top + 8, backgroundColor: theme.card }]}>
          <View3 style={styles4.headerRow}>
            <Text4 style={[styles4.title, { color: theme.text }]}>KEBA Fernzugriff</Text4>
            <View3 style={styles4.headerButtons}>
              <Button title="Neu laden" kind="secondary" onPress={() => webView.current?.reload()} />
              <Button title="Abbrechen" kind="secondary" onPress={cancelRemoteLogin} />
            </View3>
          </View3>
          <Text4 style={[styles4.hint, { color: theme.secondary }]}>
            {loginNotice ?? "Tipp: Trage deine Zugangsdaten in den Einstellungen ein, dann meldet sich die App k\xFCnftig selbst an. Jetzt: anmelden, Anlage aufklappen, \u201EWebHmi\u201C und dann \u201EWWW\u201C antippen."}
          </Text4>
          {loginNotice !== void 0 && diagnostics.slice(-5).map((line, i) => <Text4 key={i} style={[styles4.diagnostic, { color: theme.secondary }]} numberOfLines={2}>
                {line}
              </Text4>)}
        </View3>}
      <KebaWebView
    key={remoteSession}
    ref={webView}
    source={{ uri: REMOTE_PORTAL_URL }}
    style={styles4.flex}
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
    </View3>;
}
var styles4 = StyleSheet4.create({
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
import { useState as useState4 } from "react";
import { Pressable as Pressable3, ScrollView as ScrollView3, StyleSheet as StyleSheet5, Text as Text5, TextInput, View as View4 } from "react-native";
function SettingsScreen({
  settings,
  onChange,
  onDone
}) {
  const { connect, disconnect, phase } = useHeating();
  const theme = useTheme();
  const [draft, setDraft] = useState4(settings);
  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const saveAndConnect = async () => {
    onChange(draft);
    await saveSettings(draft);
    onDone();
    await connect(draft);
  };
  const canConnect = draft.mode === "remote" || draft.modbusAddress.trim() !== "";
  return <ScrollView3
    style={{ backgroundColor: theme.background }}
    contentContainerStyle={styles5.content}
    keyboardShouldPersistTaps="handled"
  >
      <SectionTitle>Verbindung</SectionTitle>
      <View4 style={[styles5.segment, { backgroundColor: theme.pressed }]}>
        {["modbus", "remote"].map((mode) => <Pressable3
    key={mode}
    onPress={() => update({ mode })}
    style={[styles5.segmentItem, draft.mode === mode && { backgroundColor: theme.card }]}
  >
            <Text5 style={[styles5.segmentText, { color: theme.text }]}>
              {MODE_LABELS[mode]}
            </Text5>
          </Pressable3>)}
      </View4>

      {draft.mode === "modbus" ? <>
          <SectionTitle>Wärmepumpe im Heimnetz (Modbus)</SectionTitle>
          <Card style={styles5.form}>
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
          <Text5 style={[styles5.footnote, { color: theme.secondary }]}>
            Direkt mit der Wärmepumpe – ohne Website, ohne Passwort. Die IP-Adresse steht am Display unter
            Netzwerk → LAN. Die Namen der Heizkreise (kommagetrennt, in der Reihenfolge am Display) legen fest,
            wie viele Heizkreise angezeigt werden. Funktioniert im WLAN zuhause oder per VPN.
          </Text5>
          {!isModbusAvailable() && <Text5 style={[styles5.footnote, { color: theme.danger }]}>
              In Expo Go/Snack gibt es keine direkten Netzwerkverbindungen. Modbus funktioniert erst in der
              eigenen App-Version (EAS Build). Zum Testen in Snack „Fernzugriff“ wählen.
            </Text5>}
        </> : <>
          <SectionTitle>Zugang remote.keba.com</SectionTitle>
          <Card style={styles5.form}>
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
          <Text5 style={[styles5.footnote, { color: theme.secondary }]}>
            Dieselben Daten wie auf remote.keba.com/app. Die App meldet sich damit unsichtbar selbst an,
            öffnet „WebHmi“ und steuert die Heizung direkt – du siehst die Portal-Seite nicht mehr.
            Das Passwort liegt verschlüsselt im iOS-Schlüsselbund.
          </Text5>
        </>}

      <Button
    title={draft.mode === "remote" && !hasPortalCredentials(draft) ? "Ohne Speichern im Portal anmelden" : "Speichern & verbinden"}
    style={styles5.action}
    disabled={!canConnect}
    onPress={saveAndConnect}
  />

      {phase !== "notConnected" && <Button title="Verbindung trennen" kind="danger" style={styles5.action} onPress={disconnect} />}
    </ScrollView3>;
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
      styles5.input,
      { color: theme.text, borderBottomColor: theme.separator, borderBottomWidth: last ? 0 : StyleSheet5.hairlineWidth }
    ]}
  />;
}
var styles5 = StyleSheet5.create({
  content: { padding: 16, paddingBottom: 40 },
  segment: { flexDirection: "row", borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  segmentText: { fontSize: 15, fontWeight: "600" },
  footnote: { fontSize: 13, marginTop: 8, marginHorizontal: 4 },
  form: { paddingVertical: 0 },
  input: { fontSize: 17, paddingVertical: 14 },
  action: { marginTop: 20 }
});

// App.tsx
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
  const insets = useSafeAreaInsets2();
  const [settings, setSettings] = useState5(defaultSettings);
  const [stack, setStack] = useState5([{ name: "dashboard" }]);
  const route = stack[stack.length - 1];
  const navigate = (next) => setStack((s) => [...s, next]);
  const back = () => setStack((s) => s.length > 1 ? s.slice(0, -1) : s);
  useEffect3(() => {
    void loadSettings().then((loaded) => {
      setSettings(loaded);
      if (isConfigured(loaded)) void heating.connect(loaded);
    });
  }, []);
  useEffect3(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void heating.refresh();
    });
    return () => sub.remove();
  }, [heating.refresh]);
  useEffect3(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (heating.remoteStage === "login") {
        heating.cancelRemoteLogin();
        return true;
      }
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, heating.remoteStage, heating.cancelRemoteLogin]);
  useEffect3(() => {
    if (heating.transientError) {
      Alert.alert("Fehler", heating.transientError, [{ text: "OK", onPress: heating.clearTransientError }]);
    }
  }, [heating.transientError, heating.clearTransientError]);
  useEffect3(() => {
    if (heating.phase !== "ready" && route.name !== "settings" && stack.length > 1) {
      setStack([{ name: "dashboard" }]);
    }
  }, [heating.phase, route.name, stack.length]);
  const connect = () => {
    if (isConfigured(settings)) void heating.connect(settings);
    else navigate({ name: "settings" });
  };
  const title = (() => {
    switch (route.name) {
      case "dashboard":
        return "Heizung";
      case "settings":
        return "Einstellungen";
      case "circuit":
        return heating.snapshot?.heatCircuits.find((c) => c.index === route.index)?.name ?? "Heizkreis";
      case "hotWater":
        return heating.snapshot?.hotWaterTanks.find((t) => t.index === route.index)?.name ?? "Warmwasser";
    }
  })();
  return <View5 style={[styles6.root, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <View5 style={[styles6.header, { paddingTop: insets.top + 6, backgroundColor: theme.background }]}>
        <View5 style={styles6.headerSide}>
          {stack.length > 1 && <Pressable4 onPress={back} hitSlop={12}>
              <Text6 style={[styles6.headerButton, { color: theme.accent }]}>‹ Zurück</Text6>
            </Pressable4>}
        </View5>
        <Text6 style={[styles6.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text6>
        <View5 style={[styles6.headerSide, styles6.headerRight]}>
          {route.name === "dashboard" && <Pressable4 onPress={() => navigate({ name: "settings" })} hitSlop={12} accessibilityLabel="Einstellungen">
              <Text6 style={[styles6.headerButton, { color: theme.accent }]}>⚙︎</Text6>
            </Pressable4>}
        </View5>
      </View5>

      <View5 style={[styles6.body, { paddingBottom: insets.bottom }]}>
        {route.name === "settings" ? <SettingsScreen settings={settings} onChange={setSettings} onDone={back} /> : route.name === "circuit" ? <HeatCircuitScreen index={route.index} /> : route.name === "hotWater" ? <HotWaterScreen index={route.index} /> : <Home connect={connect} navigate={navigate} />}
      </View5>

      <RemoteHost />
    </View5>;
}
function Home({ connect, navigate }) {
  const { phase, error, progress, remoteStage, revealPortal, diagnostics } = useHeating();
  switch (phase) {
    case "ready":
      return <Dashboard navigate={navigate} />;
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
      return <StatusView title="Keine Verbindung" message={error}>
          <Button title="Erneut versuchen" onPress={connect} />
          <Button title="Einstellungen" kind="secondary" onPress={() => navigate({ name: "settings" })} />
        </StatusView>;
    case "sessionExpired":
      return <StatusView title="Sitzung abgelaufen" message="Der Fernzugriff wurde geschlossen.">
          <Button title="Neu verbinden" onPress={connect} />
        </StatusView>;
    case "notConnected":
      return <StatusView
        title="Nicht verbunden"
        message="Richte einmal die Verbindung ein. Danach verbindet sich die App bei jedem Start von selbst."
      >
          <Button title="Einrichten" onPress={() => navigate({ name: "settings" })} />
        </StatusView>;
  }
}
function Diagnostics({ lines }) {
  const theme = useTheme();
  if (lines.length === 0) return null;
  return <View5 style={styles6.diagnostics}>
      {lines.slice(-4).map((line, i) => <Text6 key={i} style={[styles6.diagnosticLine, { color: theme.secondary }]} numberOfLines={3}>
          {line}
        </Text6>)}
    </View5>;
}
var styles6 = StyleSheet6.create({
  root: { flex: 1 },
  diagnostics: { marginTop: 12, gap: 4 },
  diagnosticLine: { fontSize: 11 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10 },
  headerSide: { width: 90 },
  headerRight: { alignItems: "flex-end" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "600" },
  headerButton: { fontSize: 17 },
  body: { flex: 1 }
});
export {
  App as default
};
