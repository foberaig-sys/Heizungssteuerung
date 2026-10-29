// Erzeugt snack/App.js: die komplette App in EINER Datei zum Reinkopieren in https://snack.expo.dev.
// Aufruf: npm run snack
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const external = [
  'react',
  'react-native',
  'react-native-webview',
  'react-native-safe-area-context',
  '@react-native-async-storage/async-storage',
  'expo-secure-store',
  'expo-status-bar',
  'react-native-tcp-socket',
  'expo-symbols',
  'expo-blur',
  'expo-haptics',
  '@expo/vector-icons/Ionicons',
];

const result = await build({
  entryPoints: ['App.tsx'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  target: 'es2020',
  jsx: 'preserve',
  external,
  legalComments: 'none',
});

const deps = JSON.parse(readFileSync('package.json', 'utf8')).dependencies;
const versions = external
  .filter((name) => !['react', 'react-native'].includes(name))
  .map((name) => name.replace(/\/Ionicons$/, ''))
  .map((name) => `//   ${name}@${deps[name]}`)
  .join('\n');

const header = `// Heizung – M-TEC/KEBA Wärmepumpe
// AUTOMATISCH ERZEUGT aus App.tsx und src/ (npm run snack). Nicht von Hand ändern.
//
// In Snack (snack.expo.dev): diesen Inhalt komplett in App.js einfügen. Snack fragt nach den
// fehlenden Paketen – einfach "Add dependency" bestätigen:
${versions}
`;

writeFileSync('snack/App.js', header + '\n' + result.outputFiles[0].text);
console.log('snack/App.js geschrieben');
