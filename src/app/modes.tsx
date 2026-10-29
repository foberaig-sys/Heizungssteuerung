import { ConnectedScreen } from '../screens/ConnectionState';
import { ModesScreen } from '../screens/ModesScreen';

export default function ModesRoute() {
  return (
    <ConnectedScreen title="Heizarten">
      <ModesScreen />
    </ConnectedScreen>
  );
}
