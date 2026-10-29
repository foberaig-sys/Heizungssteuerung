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
function parseAttributes(raw) {
  if (typeof raw !== "object" || raw === null) return void 0;
  const a = raw;
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
  switch (v?.value.toLowerCase()) {
    case "true":
    case "1":
      return true;
    case "false":
    case "0":
      return false;
    default:
      return void 0;
  }
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
function directPost(baseUrl, auth, timeoutMs = 15e3) {
  const base = baseUrl.replace(/\/+$/, "");
  return async (path, body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      "Content-Type": "application/json; charset=UTF-8",
      Accept: "*/*"
    };
    if (auth?.username) {
      headers.Authorization = `Basic ${base64(`${auth.username}:${auth.password}`)}`;
    }
    try {
      const response = await fetch(base + path, { method: "POST", headers, body, signal: controller.signal });
      return { status: response.status, contentType: response.headers.get("content-type"), body: await response.text() };
    } catch (error) {
      const aborted = error?.name === "AbortError";
      throw new KebaError("network", aborted ? "Der Regler antwortet nicht (Zeit\xFCberschreitung)." : "Regler nicht erreichbar. Bist du im richtigen WLAN?");
    } finally {
      clearTimeout(timer);
    }
  };
}
function base64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary);
}
function normalizeLocalAddress(address) {
  let text = address.trim();
  if (!text) return void 0;
  if (!text.includes("://")) text = `http://${text}`;
  const match = /^(https?):\/\/([^/\s]+)/i.exec(text);
  return match ? `${match[1].toLowerCase()}://${match[2]}` : void 0;
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
var SystemModes = [
  { value: -1, label: "Inbetriebnahme" },
  { value: 0, label: "Aus (Standby)" },
  { value: 1, label: "Nur Warmwasser" },
  { value: 2, label: "Heizen + Warmwasser" },
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
  { value: 3, label: "Einmal aufheizen" }
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
  return {
    outdoorTemperature: toNumber(v[KebaVar.outdoorTemperature]),
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

// src/store.tsx
var HeatingContext = createContext(null);
function useHeating() {
  const value = useContext(HeatingContext);
  if (!value) throw new Error("useHeating au\xDFerhalb von <HeatingProvider>");
  return value;
}
var wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function HeatingProvider({ children }) {
  const bridge = useRef(new WebViewBridge()).current;
  const client = useRef(null);
  const refreshing = useRef(false);
  const [phase, setPhase] = useState("notConnected");
  const [snapshot, setSnapshot] = useState();
  const [error, setError] = useState();
  const [transientError, setTransientError] = useState();
  const [writing, setWriting] = useState(false);
  const [remoteStage, setRemoteStage] = useState("idle");
  const [remoteSession, setRemoteSession] = useState(0);
  const snapshotRef = useRef(void 0);
  const handleError = useCallback((e) => {
    const kebaError = e instanceof KebaError ? e : void 0;
    if (kebaError?.kind === "sessionExpired") {
      setPhase("sessionExpired");
      return;
    }
    const message = e instanceof Error ? e.message : String(e);
    if (snapshotRef.current) {
      setTransientError(message);
    } else {
      setError(message);
      setPhase("failed");
    }
  }, []);
  const refresh = useCallback(async () => {
    if (!client.current || refreshing.current) return;
    refreshing.current = true;
    try {
      const next = await loadSnapshot(client.current);
      snapshotRef.current = next;
      setSnapshot(next);
      setPhase("ready");
    } catch (e) {
      handleError(e);
    } finally {
      refreshing.current = false;
    }
  }, [handleError]);
  const start = useCallback(
    async (next) => {
      client.current = next;
      snapshotRef.current = void 0;
      setSnapshot(void 0);
      setError(void 0);
      setPhase("loading");
      await refresh();
    },
    [refresh]
  );
  const connectLocal = useCallback(
    async (settings) => {
      const url = normalizeLocalAddress(settings.localAddress);
      if (!url) {
        setError("Bitte die IP-Adresse des Reglers eintragen.");
        setPhase("failed");
        return;
      }
      setRemoteStage("idle");
      bridge.reset();
      const auth = settings.username ? { username: settings.username, password: settings.password } : void 0;
      await start(new KebaClient(directPost(url, auth)));
    },
    [bridge, start]
  );
  const startRemoteLogin = useCallback(() => {
    bridge.reset();
    client.current = null;
    setRemoteSession((n) => n + 1);
    setRemoteStage("login");
  }, [bridge]);
  const cancelRemoteLogin = useCallback(() => {
    setRemoteStage((stage) => stage === "login" ? "idle" : stage);
  }, []);
  const onHmiReached = useCallback(() => {
    setRemoteStage("connected");
    void start(new KebaClient(bridge.post));
  }, [bridge, start]);
  const onHmiLeft = useCallback(() => {
    bridge.reset("Die Sitzung ist abgelaufen.");
    client.current = null;
    setRemoteStage("idle");
    setPhase("sessionExpired");
  }, [bridge]);
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
    client.current = null;
    snapshotRef.current = void 0;
    setSnapshot(void 0);
    setRemoteStage("idle");
    setPhase("notConnected");
  }, [bridge]);
  const value = useMemo(
    () => ({
      phase,
      snapshot,
      error,
      transientError,
      writing,
      remoteStage,
      remoteSession,
      bridge,
      connectLocal,
      startRemoteLogin,
      cancelRemoteLogin,
      onHmiReached,
      onHmiLeft,
      refresh,
      perform,
      disconnect,
      clearTransientError: () => setTransientError(void 0)
    }),
    [
      phase,
      snapshot,
      error,
      transientError,
      writing,
      remoteStage,
      remoteSession,
      bridge,
      connectLocal,
      startRemoteLogin,
      cancelRemoteLogin,
      onHmiReached,
      onHmiLeft,
      refresh,
      perform,
      disconnect
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
function HeatCircuitScreen({ index }) {
  const { snapshot, perform, writing } = useHeating();
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
    disabled={writing}
    onSelect={(mode) => perform((c) => commands.setHeatCircuitMode(c, index, mode))}
  />

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
  const { snapshot, perform, writing } = useHeating();
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
    disabled={writing}
    onSelect={(mode) => perform((c) => commands.setHotWaterMode(c, index, mode))}
  />

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
  const { snapshot, refresh, writing } = useHeating();
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
      <Text3 style={[styles3.footer, { color: theme.secondary }]}>
        {writing ? "Wird gespeichert \u2026" : `Stand: ${snapshot.fetchedAt.toLocaleTimeString("de-DE")}`}
      </Text3>
    </ScrollView2>;
}
function SystemCard() {
  const { snapshot, perform, writing } = useHeating();
  const theme = useTheme();
  const [picking, setPicking] = useState3(false);
  if (!snapshot) return null;
  return <Card style={styles3.systemCard}>
      <View2>
        <Text3 style={[styles3.caption, { color: theme.secondary }]}>Außen</Text3>
        <Text3 style={[styles3.mediumTemp, { color: theme.text }]}>{formatTemp(snapshot.outdoorTemperature)}</Text3>
      </View2>
      <Pressable2 onPress={() => setPicking(true)} disabled={writing} style={styles3.systemMode} hitSlop={8}>
        <Text3 style={[styles3.caption, { color: theme.secondary }]}>Anlage</Text3>
        <Text3 style={[styles3.systemModeText, { color: theme.accent }]}>
          {modeLabel(SystemModes, snapshot.systemOperatingMode)} ▾
        </Text3>
      </Pressable2>

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
  const step = (delta) => {
    if (!offset) return;
    let next = offset.value + delta;
    if (offset.range) next = Math.min(offset.range.max, Math.max(offset.range.min, next));
    if (next === offset.value) return;
    void perform((c) => commands.setOffset(c, circuit.index, next));
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
        {offset && <View2 style={styles3.steps}>
            <StepButton large label="▲" onPress={() => step(0.5)} disabled={writing} />
            <StepButton large label="▼" onPress={() => step(-0.5)} disabled={writing} />
          </View2>}
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
  const { remoteStage, remoteSession, bridge, onHmiReached, onHmiLeft, cancelRemoteLogin } = useHeating();
  const webView = useRef2(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const visible = remoteStage === "login";
  useEffect2(() => {
    bridge.attach(remoteStage === "connected" ? webView.current : null);
  }, [bridge, remoteStage]);
  if (remoteStage === "idle") return null;
  return <View3
    style={visible ? [StyleSheet4.absoluteFill, { backgroundColor: theme.background }] : styles4.hidden}
    pointerEvents={visible ? "auto" : "none"}
  >
      {visible && <View3 style={[styles4.header, { paddingTop: insets.top + 8, backgroundColor: theme.card }]}>
          <View3 style={styles4.headerRow}>
            <Text4 style={[styles4.title, { color: theme.text }]}>KEBA Fernzugriff</Text4>
            <Button title="Abbrechen" kind="secondary" onPress={cancelRemoteLogin} />
          </View3>
          <Text4 style={[styles4.hint, { color: theme.secondary }]}>
            Anmelden, Anlage aufklappen, „WebHmi“ und dann „WWW“ antippen.
          </Text4>
        </View3>}
      <KebaWebView
    key={remoteSession}
    ref={webView}
    source={{ uri: REMOTE_PORTAL_URL }}
    style={styles4.flex}
    sharedCookiesEnabled
    javaScriptEnabled
    domStorageEnabled
    onMessage={(event) => bridge.handleMessage(event.nativeEvent.data)}
    onLoadEnd={(event) => {
      const isHmi = hmiBaseUrl(event.nativeEvent.url) !== void 0;
      if (remoteStage === "login" && isHmi) {
        bridge.attach(webView.current);
        onHmiReached();
      } else if (remoteStage === "connected" && !isHmi) {
        onHmiLeft();
      }
    }}
  />
    </View3>;
}
var styles4 = StyleSheet4.create({
  flex: { flex: 1 },
  // Nicht 0×0 und nicht außerhalb des Bildschirms, damit iOS die Seite nicht anhält.
  hidden: { position: "absolute", left: 0, bottom: 0, width: 2, height: 2, opacity: 0.01 },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, fontWeight: "700" },
  hint: { fontSize: 14, marginTop: 6 }
});

// src/screens/SettingsScreen.tsx
import { useState as useState4 } from "react";
import { Pressable as Pressable3, ScrollView as ScrollView3, StyleSheet as StyleSheet5, Text as Text5, TextInput, View as View4 } from "react-native";

// src/settings.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
var defaultSettings = { mode: "remote", localAddress: "", username: "", password: "" };
var KEY = "heizung.settings";
var PASSWORD_KEY = "heizung.password";
async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const stored = raw ? JSON.parse(raw) : {};
    const password = await SecureStore.getItemAsync(PASSWORD_KEY) ?? "";
    return { ...defaultSettings, ...stored, password };
  } catch {
    return defaultSettings;
  }
}
async function saveSettings(settings) {
  const { password, ...rest } = settings;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(rest));
    if (password) {
      await SecureStore.setItemAsync(PASSWORD_KEY, password);
    } else {
      await SecureStore.deleteItemAsync(PASSWORD_KEY);
    }
  } catch {
  }
}

// src/screens/SettingsScreen.tsx
function SettingsScreen({
  settings,
  onChange,
  onDone
}) {
  const { connectLocal, startRemoteLogin, disconnect, phase } = useHeating();
  const theme = useTheme();
  const [draft, setDraft] = useState4(settings);
  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const persist = async () => {
    onChange(draft);
    await saveSettings(draft);
  };
  const inputStyle = [styles5.input, { color: theme.text, borderBottomColor: theme.separator }];
  return <ScrollView3
    style={{ backgroundColor: theme.background }}
    contentContainerStyle={styles5.content}
    keyboardShouldPersistTaps="handled"
  >
      <SectionTitle>Verbindung</SectionTitle>
      <View4 style={[styles5.segment, { backgroundColor: theme.pressed }]}>
        {["remote", "local"].map((mode) => <Pressable3
    key={mode}
    onPress={() => update({ mode })}
    style={[styles5.segmentItem, draft.mode === mode && { backgroundColor: theme.card }]}
  >
            <Text5 style={[styles5.segmentText, { color: theme.text }]}>
              {mode === "remote" ? "KEBA Fernzugriff" : "Heimnetz / VPN"}
            </Text5>
          </Pressable3>)}
      </View4>
      <Text5 style={[styles5.footnote, { color: theme.secondary }]}>
        {draft.mode === "remote" ? "Nutzt deinen Zugang zu remote.keba.com. Du meldest dich in der App im Portal an, danach steuert die App die Heizung direkt. Die Sitzung l\xE4uft nach einiger Zeit ab." : "Direkt mit dem Regler \u2013 schneller und ohne Hersteller-Portal. Funktioniert im WLAN zuhause oder unterwegs \xFCber ein eigenes VPN (z. B. FRITZ!Box, WireGuard, Tailscale)."}
      </Text5>

      {draft.mode === "local" ? <>
          <SectionTitle>Regler im Heimnetz</SectionTitle>
          <Card style={styles5.form}>
            <TextInput
    style={inputStyle}
    value={draft.localAddress}
    onChangeText={(localAddress) => update({ localAddress })}
    placeholder="IP-Adresse, z. B. 192.168.1.50"
    placeholderTextColor={theme.secondary}
    autoCapitalize="none"
    autoCorrect={false}
    keyboardType="url"
  />
            <TextInput
    style={inputStyle}
    value={draft.username}
    onChangeText={(username) => update({ username })}
    placeholder="Benutzer (falls nötig)"
    placeholderTextColor={theme.secondary}
    autoCapitalize="none"
    autoCorrect={false}
  />
            <TextInput
    style={[...inputStyle, { borderBottomWidth: 0 }]}
    value={draft.password}
    onChangeText={(password) => update({ password })}
    placeholder="Passwort (falls nötig)"
    placeholderTextColor={theme.secondary}
    secureTextEntry
  />
          </Card>
          <Button
    title="Verbinden"
    style={styles5.action}
    disabled={!normalizeLocalAddress(draft.localAddress)}
    onPress={async () => {
      await persist();
      onDone();
      await connectLocal(draft);
    }}
  />
        </> : <Button
    title="Bei remote.keba.com anmelden"
    style={styles5.action}
    onPress={async () => {
      await persist();
      onDone();
      startRemoteLogin();
    }}
  />}

      {phase !== "notConnected" && <Button title="Verbindung trennen" kind="danger" style={styles5.action} onPress={disconnect} />}
    </ScrollView3>;
}
var styles5 = StyleSheet5.create({
  content: { padding: 16, paddingBottom: 40 },
  segment: { flexDirection: "row", borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  segmentText: { fontSize: 15, fontWeight: "600" },
  footnote: { fontSize: 13, marginTop: 8, marginHorizontal: 4 },
  form: { paddingVertical: 0 },
  input: { fontSize: 17, paddingVertical: 14, borderBottomWidth: StyleSheet5.hairlineWidth },
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
      if (loaded.mode === "local" && loaded.localAddress) void heating.connectLocal(loaded);
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
    if (settings.mode === "remote") heating.startRemoteLogin();
    else if (settings.localAddress) void heating.connectLocal(settings);
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
        {route.name === "settings" ? <SettingsScreen settings={settings} onChange={setSettings} onDone={back} /> : route.name === "circuit" ? <HeatCircuitScreen index={route.index} /> : route.name === "hotWater" ? <HotWaterScreen index={route.index} /> : <Home connect={connect} navigate={navigate} remote={settings.mode === "remote"} />}
      </View5>

      <RemoteHost />
    </View5>;
}
function Home({ connect, navigate, remote }) {
  const { phase, error, refresh } = useHeating();
  const connectTitle = remote ? "\xDCber KEBA Fernzugriff verbinden" : "Verbinden";
  switch (phase) {
    case "ready":
      return <Dashboard navigate={navigate} />;
    case "loading":
      return <StatusView title="Lade Daten …" loading />;
    case "failed":
      return <StatusView title="Keine Verbindung" message={error}>
          <Button title="Erneut versuchen" onPress={() => void refresh()} />
          <Button title="Einstellungen" kind="secondary" onPress={() => navigate({ name: "settings" })} />
        </StatusView>;
    case "sessionExpired":
      return <StatusView title="Sitzung abgelaufen" message="Der Fernzugriff wurde geschlossen. Bitte neu verbinden.">
          <Button title={connectTitle} onPress={connect} />
        </StatusView>;
    case "notConnected":
      return <StatusView
        title="Nicht verbunden"
        message="Verbinde die App mit deiner Wärmepumpe – über den KEBA Fernzugriff oder direkt im Heimnetz."
      >
          <Button title={connectTitle} onPress={connect} />
          <Button title="Einstellungen" kind="secondary" onPress={() => navigate({ name: "settings" })} />
        </StatusView>;
  }
}
var styles6 = StyleSheet6.create({
  root: { flex: 1 },
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
