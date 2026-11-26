import { create } from 'zustand';
import type { ArrowStyle, Doc, Echelon, FillStyle, Layer, LineStyle, MapObject, Side, Standard, Tool } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10);

export function defaultLayers(): Layer[] {
  return [
    { id: 'l-graphics', name: 'Графика', visible: true, locked: false, opacity: 1 },
    { id: 'l-enemy', name: 'Противник', visible: true, locked: false, opacity: 1 },
    { id: 'l-own', name: 'Свои войска', visible: true, locked: false, opacity: 1 },
    { id: 'l-labels', name: 'Подписи', visible: true, locked: false, opacity: 1 },
  ];
}

export function emptyDoc(): Doc {
  return { version: 1, standard: 'ru', map: null, metersPerPx: null, layers: defaultLayers(), objects: [], title: 'Новая карта' };
}

export interface Defaults {
  symbol: string;
  side: Side;
  echelon: Echelon;
  planned: boolean;
  hq: boolean;
  unitSize: number;
  arrowStyle: ArrowStyle;
  lineStyle: LineStyle;
  areaFill: FillStyle;
}

interface View {
  zoom: number;
  x: number; // screen offset of world origin
  y: number;
}

interface State {
  doc: Doc;
  past: Doc[];
  future: Doc[];
  filePath: string | null;
  dirty: boolean;
  tool: Tool;
  selection: string[];
  activeLayerId: string;
  /** Layer chosen automatically by side for units (own -> own layer, enemy -> enemy layer). */
  autoLayer: boolean;
  defaults: Defaults;
  view: View;
  cursor: { x: number; y: number } | null;
  toast: string | null;

  setTool: (t: Tool) => void;
  setDefaults: (d: Partial<Defaults>) => void;
  setView: (v: Partial<View>) => void;
  setCursor: (c: { x: number; y: number } | null) => void;
  setSelection: (ids: string[]) => void;
  setActiveLayer: (id: string) => void;
  setAutoLayer: (v: boolean) => void;
  showToast: (t: string) => void;

  /** Record undo snapshot then apply mutation. */
  change: (fn: (d: Doc) => Doc) => void;
  /** Apply mutation without new history entry (for live drags after `checkpoint`). */
  patch: (fn: (d: Doc) => Doc) => void;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;

  loadDoc: (d: Doc, filePath: string | null) => void;
  markSaved: (filePath: string) => void;

  addObject: (o: MapObject) => void;
  updateObjects: (ids: string[], fn: (o: MapObject) => MapObject, record?: boolean) => void;
  deleteSelection: () => void;
  setStandard: (s: Standard) => void;
}

const HISTORY_LIMIT = 150;

export const useStore = create<State>((set, get) => ({
  doc: emptyDoc(),
  past: [],
  future: [],
  filePath: null,
  dirty: false,
  tool: 'select',
  selection: [],
  activeLayerId: 'l-graphics',
  autoLayer: true,
  defaults: {
    symbol: 'msr',
    side: 'own',
    echelon: 'company',
    planned: false,
    hq: false,
    unitSize: 72,
    arrowStyle: 'main',
    lineStyle: 'front',
    areaFill: 'hatch',
  },
  view: { zoom: 1, x: 0, y: 0 },
  cursor: null,
  toast: null,

  setTool: (tool) => set({ tool }),
  setDefaults: (d) => set({ defaults: { ...get().defaults, ...d } }),
  setView: (v) => set({ view: { ...get().view, ...v } }),
  setCursor: (cursor) => set({ cursor }),
  setSelection: (selection) => set({ selection }),
  setActiveLayer: (activeLayerId) => set({ activeLayerId }),
  setAutoLayer: (autoLayer) => set({ autoLayer }),
  showToast: (toast) => {
    set({ toast });
    setTimeout(() => {
      if (get().toast === toast) set({ toast: null });
    }, 2600);
  },

  change: (fn) => {
    const { doc, past } = get();
    set({ past: [...past.slice(-HISTORY_LIMIT), doc], future: [], doc: fn(doc), dirty: true });
  },
  patch: (fn) => set({ doc: fn(get().doc), dirty: true }),
  checkpoint: () => {
    const { doc, past } = get();
    set({ past: [...past.slice(-HISTORY_LIMIT), doc], future: [] });
  },
  undo: () => {
    const { past, doc, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({ past: past.slice(0, -1), future: [doc, ...future], doc: prev, dirty: true, selection: [] });
  },
  redo: () => {
    const { past, doc, future } = get();
    if (!future.length) return;
    set({ past: [...past, doc], future: future.slice(1), doc: future[0], dirty: true, selection: [] });
  },

  loadDoc: (doc, filePath) =>
    set({ doc, filePath, past: [], future: [], dirty: false, selection: [], activeLayerId: doc.layers[0]?.id ?? 'l-graphics' }),
  markSaved: (filePath) => set({ filePath, dirty: false }),

  addObject: (o) => {
    get().change((d) => ({ ...d, objects: [...d.objects, o] }));
    set({ selection: [o.id] });
  },
  updateObjects: (ids, fn, record = true) => {
    const apply = (d: Doc): Doc => ({ ...d, objects: d.objects.map((o) => (ids.includes(o.id) ? fn(o) : o)) });
    if (record) get().change(apply);
    else get().patch(apply);
  },
  deleteSelection: () => {
    const sel = get().selection;
    if (!sel.length) return;
    get().change((d) => ({ ...d, objects: d.objects.filter((o) => !sel.includes(o.id)) }));
    set({ selection: [] });
  },
  setStandard: (standard) => get().change((d) => ({ ...d, standard })),
}));

/**
 * Size factor for new objects. Sizes are stored in map pixels, so on a large
 * photo (e.g. 4000 px) default-sized signs, arrows and lines would look tiny.
 */
export function docScale(doc: Doc = useStore.getState().doc): number {
  if (!doc.map) return 1;
  const k = Math.max(doc.map.width, doc.map.height) / 1200;
  return Math.min(12, Math.max(1, Math.round(k * 4) / 4));
}

/** Layer for a new object: units/graphics go to the side layer when auto mode is on. */
export function layerFor(kind: MapObject['kind'], side: Side): string {
  const { autoLayer, activeLayerId, doc } = useStore.getState();
  const exists = (id: string) => doc.layers.some((l) => l.id === id && !l.locked);
  if (autoLayer) {
    if (kind === 'text' && exists('l-labels')) return 'l-labels';
    if (kind === 'unit') {
      if (side === 'own' && exists('l-own')) return 'l-own';
      if (side === 'enemy' && exists('l-enemy')) return 'l-enemy';
    }
    if ((kind === 'arrow' || kind === 'line' || kind === 'area') && exists('l-graphics')) return 'l-graphics';
  }
  const active = doc.layers.find((l) => l.id === activeLayerId && !l.locked);
  return active?.id ?? doc.layers.find((l) => !l.locked)?.id ?? doc.layers[0].id;
}
