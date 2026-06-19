export type ClientAuth = { id: number; secret: string; name?: string };
export type ClientAction = { type: string; [key: string]: unknown };
export type ClientSnapshot = {
  rev?: number;
  me?: any;
  world?: {
    rev?: number;
    ax?: number;
    az?: number;
    tiles?: any[];
    buildings?: any[];
    doodads?: any[];
    loot?: any[];
    players?: any[];
    map?: any;
  };
  players?: any[];
  events?: any[];
  chat?: any[];
};

export type ClientWorldState = {
  rev: number;
  anchor: { x: number; z: number };
  me: any | null;
  tiles: Map<string, any>;
  buildings: Map<number, any>;
  doodads: Map<string, any>;
  loot: Map<string, any>;
  players: Map<number, any>;
  events: any[];
  chat: any[];
};
