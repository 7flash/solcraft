import { BUILDING_COPY, SHORTCUTS } from './content';

export const RESOURCE_KEYS = ['wood', 'stone', 'food', 'energy', 'gold'] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export const BUILDING_KEYS = [
  'house',
  'farm',
  'mine',
  'lumber',
  'market',
  'tower',
  'shrine',
] as const;

export type BuildingType = (typeof BUILDING_KEYS)[number];

export type ResourceBag = Partial<Record<ResourceKey, number>>;

export type BuildingDefinition = {
  type: BuildingType;
  label: string;
  description: string;
  hotkey: string;
  size: readonly [number, number];
  height: number;
  color: number;
  roofColor: number;
  cost: ResourceBag;
  upgradeBaseCost: ResourceBag;
  produces: ResourceBag;
  bonusFrom: Partial<Record<BuildingType, number>>;
};

export const STARTING_RESOURCES: Record<ResourceKey, number> = {
  wood: 110,
  stone: 82,
  food: 18,
  energy: 25,
  gold: 20,
};

export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  house: {
    type: 'house',
    label: BUILDING_COPY.house.label,
    description: BUILDING_COPY.house.description,
    hotkey: SHORTCUTS.house,
    size: [1, 1],
    height: 1.2,
    color: 0x4fa3ff,
    roofColor: 0x233a66,
    cost: { wood: 8, stone: 3 },
    upgradeBaseCost: { wood: 8, stone: 5, food: 2 },
    produces: { gold: 0.06 },
    bonusFrom: { market: 0.2, shrine: 0.12 },
  },
  farm: {
    type: 'farm',
    label: BUILDING_COPY.farm.label,
    description: BUILDING_COPY.farm.description,
    hotkey: SHORTCUTS.farm,
    size: [2, 2],
    height: 0.35,
    color: 0x6bd46b,
    roofColor: 0x23452d,
    cost: { wood: 12, stone: 5 },
    upgradeBaseCost: { wood: 10, stone: 5, energy: 1 },
    produces: { food: 0.38 },
    bonusFrom: { shrine: 0.18 },
  },
  mine: {
    type: 'mine',
    label: BUILDING_COPY.mine.label,
    description: BUILDING_COPY.mine.description,
    hotkey: SHORTCUTS.mine,
    size: [2, 2],
    height: 1.35,
    color: 0x8b8b95,
    roofColor: 0x30313d,
    cost: { wood: 10, stone: 8, energy: 2 },
    upgradeBaseCost: { wood: 12, stone: 10, energy: 3 },
    produces: { stone: 0.24 },
    bonusFrom: { lumber: 0.1, shrine: 0.1 },
  },
  lumber: {
    type: 'lumber',
    label: BUILDING_COPY.lumber.label,
    description: BUILDING_COPY.lumber.description,
    hotkey: SHORTCUTS.lumber,
    size: [2, 1],
    height: 1,
    color: 0xb8783c,
    roofColor: 0x4f2e19,
    cost: { wood: 16, stone: 5 },
    upgradeBaseCost: { wood: 12, stone: 7 },
    produces: { wood: 0.27 },
    bonusFrom: { farm: 0.08 },
  },
  market: {
    type: 'market',
    label: BUILDING_COPY.market.label,
    description: BUILDING_COPY.market.description,
    hotkey: SHORTCUTS.market,
    size: [2, 2],
    height: 1.1,
    color: 0xffc857,
    roofColor: 0x6a451b,
    cost: { wood: 22, stone: 15, food: 6 },
    upgradeBaseCost: { wood: 16, stone: 14, food: 8, gold: 5 },
    produces: { gold: 0.28 },
    bonusFrom: { house: 0.16, shrine: 0.08 },
  },
  tower: {
    type: 'tower',
    label: BUILDING_COPY.tower.label,
    description: BUILDING_COPY.tower.description,
    hotkey: SHORTCUTS.tower,
    size: [1, 1],
    height: 2.4,
    color: 0xff5c7a,
    roofColor: 0x5a172a,
    cost: { wood: 12, stone: 22, energy: 4 },
    upgradeBaseCost: { wood: 12, stone: 18, energy: 5 },
    produces: {},
    bonusFrom: { shrine: 0.15 },
  },
  shrine: {
    type: 'shrine',
    label: BUILDING_COPY.shrine.label,
    description: BUILDING_COPY.shrine.description,
    hotkey: SHORTCUTS.shrine,
    size: [1, 2],
    height: 1.6,
    color: 0x9a7cff,
    roofColor: 0x342a66,
    cost: { wood: 18, stone: 20, gold: 8 },
    upgradeBaseCost: { stone: 16, energy: 4, gold: 10 },
    produces: { energy: 0.12 },
    bonusFrom: { house: 0.08, market: 0.08 },
  },
};
