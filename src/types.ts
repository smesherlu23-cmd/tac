export type Side = 'own' | 'enemy' | 'neutral' | 'unknown';
export type Standard = 'ru' | 'nato';
export type Echelon =
  | 'none'
  | 'team'
  | 'squad'
  | 'section'
  | 'platoon'
  | 'company'
  | 'battalion'
  | 'regiment'
  | 'brigade'
  | 'division'
  | 'corps'
  | 'army';

export interface Pt {
  x: number;
  y: number;
}

interface Base {
  id: string;
  layerId: string;
  side: Side;
  /** Explicit color; when empty the side color of the current standard is used. */
  color?: string;
}

export interface UnitObj extends Base {
  kind: 'unit';
  symbol: string; // catalog id
  x: number;
  y: number;
  size: number; // px at zoom 1
  rotation: number;
  echelon: Echelon;
  planned: boolean;
  hq: boolean;
  label: string; // designation, e.g. "1 мсб"
  note: string; // additional text below
}

export type ArrowStyle = 'main' | 'support' | 'counter' | 'withdraw' | 'fire';
export interface ArrowObj extends Base {
  kind: 'arrow';
  style: ArrowStyle;
  points: Pt[];
  width: number;
  label: string;
}

export type LineStyle = 'solid' | 'dashed' | 'front' | 'trench' | 'wire' | 'mines' | 'boundary' | 'antitank';
export interface LineObj extends Base {
  kind: 'line';
  style: LineStyle;
  points: Pt[];
  width: number;
  smooth: boolean;
  label: string;
}

export type FillStyle = 'none' | 'solid' | 'hatch' | 'cross';
export interface AreaObj extends Base {
  kind: 'area';
  points: Pt[];
  width: number;
  fill: FillStyle;
  fillOpacity: number;
  dashed: boolean;
  smooth: boolean;
  label: string;
}

export interface TextObj extends Base {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  rotation: number;
  bold: boolean;
  halo: boolean;
}

export type MapObject = UnitObj | ArrowObj | LineObj | AreaObj | TextObj;

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export interface BaseMap {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
  opacity: number;
  grayscale: boolean;
}

export interface Doc {
  version: 1;
  standard: Standard;
  map: BaseMap | null;
  /** metres per map pixel; null when not calibrated */
  metersPerPx: number | null;
  layers: Layer[];
  objects: MapObject[];
  title: string;
}

export type Tool = 'select' | 'pan' | 'unit' | 'arrow' | 'line' | 'area' | 'text' | 'measure' | 'calibrate';
