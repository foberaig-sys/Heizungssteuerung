// TCP-Sockets gibt es nur in der eigenen App-Version (react-native-tcp-socket), nicht in Expo Go/Snack.
// Die Bibliothek stürzt schon beim Laden ab, wenn ihr nativer Teil fehlt – deshalb erst prüfen,
// dann per dynamischem Import nachladen.
import { NativeModules } from 'react-native';

import type { SocketFactory } from './modbusClient';

export function isModbusAvailable(): boolean {
  return NativeModules.TcpSockets != null;
}

export async function loadSocketFactory(): Promise<SocketFactory | undefined> {
  if (!isModbusAvailable()) return undefined;
  const { default: TcpSocket } = await import('react-native-tcp-socket');
  return (host, port, onConnect) => TcpSocket.createConnection({ host, port, connectTimeout: 4000 }, onConnect);
}
