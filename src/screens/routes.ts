export type Route =
  | { name: 'dashboard' }
  | { name: 'circuit'; index: number }
  | { name: 'hotWater'; index: number }
  | { name: 'settings' };
