import { useLocalSearchParams } from 'expo-router';

import { HeatCircuitScreen } from '../../../screens/DetailScreens';

export default function CircuitRoute() {
  const { index } = useLocalSearchParams<{ index: string }>();
  return <HeatCircuitScreen index={Number(index)} />;
}
