import { ConnectedScreen } from '../../screens/ConnectionState';
import { HomeScreen } from '../../screens/HomeScreen';

export default function HomeRoute() {
  return (
    <ConnectedScreen title="Heizung">
      <HomeScreen />
    </ConnectedScreen>
  );
}
