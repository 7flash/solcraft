export const APP = {
  language: 'en',
  title: 'World of SolCrafts',
  description: 'A Solana MMORPG with a sound economy and a fully player-shaped world.',
} as const;

export const META = {
  charset: 'utf-8',
  viewportName: 'viewport',
  viewportContent: 'width=device-width, initial-scale=1',
  descriptionName: 'description',
} as const;

export const DOM = {
  shell: 'game-shell',
  canvas: 'game-canvas',
  hudRoot: 'hud-root',
  overlayRoot: 'overlay-root',
} as const;

export const CLASS = {
  app: 'app',
  scene: 'scene',
  canvas: 'canvas',
  hud: 'hud',
  panel: 'panel',
  panelHeader: 'panel-header',
  eyebrow: 'eyebrow',
  title: 'title',
  muted: 'muted',
  resourceGrid: 'resource-grid',
  resource: 'resource',
  resourceName: 'resource-name',
  resourceValue: 'resource-value',
  palette: 'palette',
  buildingButton: 'building-button',
  buildingButtonActive: 'building-button active',
  buildingButtonDisabled: 'building-button disabled',
  buildingMeta: 'building-meta',
  buildingName: 'building-name',
  buildingCost: 'building-cost',
  actionRow: 'action-row',
  primaryButton: 'primary-button',
  dangerButton: 'danger-button',
  ghostButton: 'ghost-button',
  selectedPanel: 'selected-panel',
  stats: 'stats',
  statRow: 'stat-row',
  hotkeys: 'hotkeys',
  notice: 'notice',
} as const;

export const STORAGE = {
  saveKey: 'solcraft.tradjs.v1.save',
} as const;

export const EVENTS = {
  pointerMove: 'pointermove',
  click: 'click',
  keydown: 'keydown',
  resize: 'resize',
} as const;

export const TEXT = {
  headerEyebrow: 'TradJS + Three.js MVP',
  appTitle: 'World of SolCrafts',
  statusReady: 'Claim territory, build control, earn gold, and withdraw through $CRAFTS.',
  resourcesTitle: 'Resources',
  buildingsTitle: 'Buildings',
  selectedTitle: 'Selected building',
  noSelection: 'Click an existing building to inspect it.',
  levelLabel: 'Level',
  productionLabel: 'Production',
  footprintLabel: 'Footprint',
  bonusLabel: 'Adjacency bonus',
  saveButton: 'Save',
  loadButton: 'Load',
  resetButton: 'Reset',
  upgradeButton: 'Upgrade',
  demolishButton: 'Demolish',
  rotateHint: 'R rotates footprint',
  selectHint: '1–7 selects a building',
  placeHint: 'Click empty tile to place',
  inspectHint: 'Click building to inspect',
  cannotAfford: 'Need more resources',
  readyToPlace: 'Ready to place',
  persisted: 'Saved locally',
  loaded: 'Loaded saved city',
  reset: 'City reset',
  nothingSaved: 'No saved city yet',
  upgradeBlocked: 'Not enough resources to upgrade',
  demolished: 'Building demolished',
  upgraded: 'Building upgraded',
  selected: 'Building selected',
  freeCost: 'Free',
  noProduction: '—',
  separator: ' · ',
  perSecond: '/s',
} as const;

export const RESOURCES = {
  wood: 'Wood',
  stone: 'Stone',
  food: 'Food',
  energy: 'Energy',
  gold: 'Gold',
} as const;

export const BUILDING_COPY = {
  house: {
    label: 'House',
    description: 'Population core that feeds the market economy.',
  },
  farm: {
    label: 'Farm',
    description: 'Produces food and gains more value near water tiles.',
  },
  mine: {
    label: 'Mine',
    description: 'Extracts stone and supports forge-style production later.',
  },
  lumber: {
    label: 'Lumber Mill',
    description: 'Turns nearby forest access into steady wood income.',
  },
  market: {
    label: 'Market',
    description: 'Converts city activity into gold when placed near houses.',
  },
  tower: {
    label: 'Tower',
    description: 'Defensive structure for future raids and guild wars.',
  },
  shrine: {
    label: 'Shrine',
    description: 'Generates energy and becomes a rare landmark later.',
  },
} as const;

export const SHORTCUTS = {
  house: '1',
  farm: '2',
  mine: '3',
  lumber: '4',
  market: '5',
  tower: '6',
  shrine: '7',
} as const;