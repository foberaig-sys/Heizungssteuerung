import { useLocalSearchParams } from 'expo-router';

import { HotWaterScreen } from '../../../screens/DetailScreens';

export default function HotWaterRoute() {
  const { index } = useLocalSearchParams<{ index: string }>();
  return <HotWaterScreen index={Number(index)} />;
}
