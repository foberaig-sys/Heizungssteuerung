export type TabKey = 'home' | 'modes' | 'data' | 'settings';

/** Unterseiten der Startseite (Temperaturen einstellen). */
export type Route = { name: 'circuit'; index: number } | { name: 'hotWater'; index: number };
