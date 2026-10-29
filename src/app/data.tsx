import { ConnectedScreen } from '../screens/ConnectionState';
import { DataScreen } from '../screens/DataScreen';

export default function DataRoute() {
  return (
    <ConnectedScreen title="Daten">
      <DataScreen />
    </ConnectedScreen>
  );
}
