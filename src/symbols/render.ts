import ms from 'milsymbol';
import type { Echelon, Side, Standard } from '../types';
import { SYMBOL_BY_ID, type SymbolDef } from './catalog';

export const SIDE_NAMES: Record<Side, string> = {
  own: 'Свои',
  enemy: 'Противник',
  neutral: 'Нейтральные',
  unknown: 'Неизвестно',
};

/** Russian maps: own forces red, enemy blue. NATO: friend blue, hostile red. */
export const SIDE_COLORS: Record<Standard, Record<Side, string>> = {
  ru: { own: '#d3242b', enemy: '#1d5bc4', neutral: '#1f8a3b', unknown: '#c48a00' },
  nato: { own: '#2c6fd1', enemy: '#d3242b', neutral: '#1f8a3b', unknown: '#c48a00' },
};

export function sideColor(standard: Standard, side: Side, override?: string): string {
  return override || SIDE_COLORS[standard][side];
}

export const ECHELONS: { id: Echelon; ru: string; mark: string; nato: string }[] = [
  { id: 'none', ru: '—', mark: '', nato: '-' },
  { id: 'team', ru: 'Расчёт / экипаж', mark: 'Ø', nato: 'A' },
  { id: 'squad', ru: 'Отделение', mark: '•', nato: 'B' },
  { id: 'section', ru: 'Секция', mark: '••', nato: 'C' },
  { id: 'platoon', ru: 'Взвод', mark: '•••', nato: 'D' },
  { id: 'company', ru: 'Рота / батарея', mark: '|', nato: 'E' },
  { id: 'battalion', ru: 'Батальон / дивизион', mark: '||', nato: 'F' },
  { id: 'regiment', ru: 'Полк', mark: '|||', nato: 'G' },
  { id: 'brigade', ru: 'Бригада', mark: 'X', nato: 'H' },
  { id: 'division', ru: 'Дивизия', mark: 'XX', nato: 'I' },
  { id: 'corps', ru: 'Корпус', mark: 'XXX', nato: 'J' },
  { id: 'army', ru: 'Армия', mark: 'XXXX', nato: 'K' },
];
const ECH = Object.fromEntries(ECHELONS.map((e) => [e.id, e]));

export interface SymbolOpts {
  standard: Standard;
  side: Side;
  echelon: Echelon;
  planned: boolean;
  hq: boolean;
  size: number;
  color?: string;
}

export interface RenderedSymbol {
  svg: string;
  /** size of the SVG in px */
  w: number;
  h: number;
  /** anchor point (object position) inside the SVG, px */
  ax: number;
  ay: number;
  /** half-extent of the glyph body from the anchor, used for labels and hit boxes */
  bodyW: number;
  bodyH: number;
}

const cache = new Map<string, RenderedSymbol>();

export function renderSymbol(symbolId: string, o: SymbolOpts): RenderedSymbol {
  const key = `${symbolId}|${o.standard}|${o.side}|${o.echelon}|${o.planned}|${o.hq}|${Math.round(o.size)}|${o.color ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = SYMBOL_BY_ID[symbolId] ?? SYMBOL_BY_ID.inf;
  const r = o.standard === 'nato' && def.nato ? renderNato(def, o) : renderRu(def, o);
  if (cache.size > 2000) cache.clear();
  cache.set(key, r);
  return r;
}

export function svgDataUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ------------------------------------------------------------------ NATO */

const NATO_IDENT: Record<Side, string> = { own: 'F', enemy: 'H', neutral: 'N', unknown: 'U' };

function renderNato(def: SymbolDef, o: SymbolOpts): RenderedSymbol {
  const fn = def.nato!;
  const ech = def.equipment ? '-' : ECH[o.echelon].nato;
  const mod = (o.hq || def.id === 'kp') && !def.equipment ? 'A' : '-';
  const sidc = `S${NATO_IDENT[o.side]}G${o.planned ? 'A' : 'P'}${fn}${mod}${ech}---`;
  const msSize = o.size / 1.5;
  const opts: Record<string, unknown> = { size: msSize, outlineWidth: 2, outlineColor: 'rgba(255,255,255,0.85)' };
  if (o.color) {
    opts.fillColor = o.color;
  }
  const sym = new ms.Symbol(sidc, opts);
  const svg = sym.asSVG();
  const size = sym.getSize();
  const anchor = sym.getAnchor();
  const oct = sym.getOctagonAnchor ? sym.getOctagonAnchor() : anchor;
  const bodyW = msSize * 0.8;
  const bodyH = msSize * 0.55;
  void oct;
  return { svg, w: size.width, h: size.height, ax: anchor.x, ay: anchor.y, bodyW, bodyH };
}

/* ------------------------------------------------------------- Russian */

/** Glyph drawn in a local box roughly [-50..50] x [-30..30], stroke colour `c`. */
type Glyph = (c: string) => string;

const sw = 'stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
const line = (c: string, d: string, extra = '') => `<path d="${d}" fill="none" stroke="${c}" ${sw} ${extra}/>`;
const fillP = (c: string, d: string) => `<path d="${d}" fill="${c}" stroke="${c}" ${sw}/>`;
const text = (c: string, t: string, x = 0, y = 0, s = 26) =>
  `<text x="${x}" y="${y}" fill="${c}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${s}" text-anchor="middle" dominant-baseline="central">${t}</text>`;

const arcPos = 'M-46,22 C-46,-34 46,-34 46,22';
const RU: Record<string, Glyph> = {
  // позиция мотострелкового подразделения: полуовал + БМП внутри
  msr: (c) =>
    line(c, arcPos) +
    line(c, 'M-46,22 l0,8 M46,22 l0,8') +
    line(c, 'M-18,14 L18,14 L24,4 L-24,4 Z') +
    line(c, 'M0,4 L0,-8 L16,-8'),
  inf: (c) => line(c, arcPos) + line(c, 'M-46,22 l0,8 M46,22 l0,8') + line(c, 'M-20,-2 L20,-2 M-20,12 L20,12'),
  // танк — ромб с пушкой
  tank: (c) => line(c, 'M-40,0 L0,-22 L40,0 L0,22 Z') + line(c, 'M0,0 L0,-34'),
  bmp: (c) => line(c, 'M-40,14 L40,14 L46,-2 L-46,-2 Z') + line(c, 'M-8,-2 L-8,-16 L12,-16') + line(c, 'M12,-16 L34,-24'),
  btr: (c) =>
    line(c, 'M-44,8 L44,8 L38,-12 L-38,-12 Z') +
    [-28, 0, 28].map((x) => `<circle cx="${x}" cy="20" r="7" fill="none" stroke="${c}" stroke-width="4"/>`).join(''),
  vdv: (c) =>
    line(c, arcPos) +
    line(c, 'M-46,22 l0,8 M46,22 l0,8') +
    line(c, 'M-18,-4 C-18,-22 18,-22 18,-4 Z M-18,-4 L0,16 L18,-4 M0,-4 L0,16'),
  recon: (c) =>
    `<ellipse cx="0" cy="0" rx="40" ry="24" fill="none" stroke="${c}" stroke-width="4" stroke-dasharray="10 7"/>` + text(c, 'Р'),
  sniper: (c) =>
    `<circle cx="0" cy="0" r="22" fill="none" stroke="${c}" stroke-width="4"/>` + line(c, 'M-32,0 L-10,0 M10,0 L32,0 M0,-32 L0,-10 M0,10 L0,32'),
  // орудие буксируемое
  gun: (c) =>
    line(c, 'M-30,18 L30,18') +
    line(c, 'M0,18 L0,-28') +
    line(c, 'M-8,-14 L0,-28 L8,-14') +
    `<circle cx="-22" cy="18" r="6" fill="${c}"/><circle cx="22" cy="18" r="6" fill="${c}"/>`,
  sau: (c) => line(c, 'M-34,14 L0,0 L34,14 L0,28 Z') + line(c, 'M0,14 L0,-30') + line(c, 'M-8,-16 L0,-30 L8,-16'),
  mortar: (c) =>
    `<circle cx="0" cy="16" r="10" fill="none" stroke="${c}" stroke-width="4"/>` + line(c, 'M0,6 L0,-30') + line(c, 'M-9,-17 L0,-30 L9,-17'),
  mlrs: (c) =>
    line(c, 'M-40,24 L40,24 L40,8 L-40,8 Z') +
    [-22, 0, 22].map((x) => line(c, `M${x},8 L${x},-28 M${x - 7},-17 L${x},-28 L${x + 7},-17`)).join(''),
  atgm: (c) => line(c, 'M-26,22 L0,-24 L26,22 Z') + line(c, 'M0,-24 L0,-36 M-8,-28 L0,-38 L8,-28'),
  sam: (c) => line(c, 'M-36,22 C-36,-18 36,-18 36,22 Z') + line(c, 'M0,10 L0,-36 M-9,-24 L0,-36 L9,-24'),
  aaa: (c) => line(c, 'M-36,22 C-36,-18 36,-18 36,22 Z') + line(c, 'M-10,10 L-10,-30 M10,10 L10,-30'),
  manpads: (c) => line(c, 'M-22,22 C-22,-2 22,-2 22,22') + line(c, 'M0,22 L0,-30 M-8,-19 L0,-30 L8,-19'),
  engineer: (c) => line(c, 'M-40,20 L-40,-14 L40,-14 L40,20 M-14,-14 L-14,8 M14,-14 L14,8'),
  signal: (c) => line(c, 'M-36,-16 L-4,12 L6,-12 L36,16') + line(c, 'M24,16 L36,16 L36,4'),
  ew: (c) =>
    `<circle cx="0" cy="0" r="28" fill="none" stroke="${c}" stroke-width="4"/>` + line(c, 'M-20,6 L-8,-10 L2,10 L12,-10 L20,4'),
  medical: (c) =>
    `<circle cx="0" cy="0" r="26" fill="none" stroke="${c}" stroke-width="4"/>` + fillP(c, 'M-5,-17 L5,-17 L5,-5 L17,-5 L17,5 L5,5 L5,17 L-5,17 L-5,5 L-17,5 L-17,-5 L-5,-5 Z'),
  supply: (c) => line(c, 'M-34,24 L-34,-6 L0,-28 L34,-6 L34,24 Z') + text(c, 'С', 0, 6, 24),
  fuel: (c) => line(c, 'M0,-30 C14,-8 24,4 24,12 C24,26 -24,26 -24,12 C-24,4 -14,-8 0,-30 Z'),
  repair: (c) =>
    line(c, 'M-30,-22 L30,22 M30,-22 L-30,22') + `<circle cx="-30" cy="-22" r="7" fill="none" stroke="${c}" stroke-width="4"/>`,
  transport: (c) =>
    line(c, 'M-42,10 L-42,-16 L14,-16 L14,10 M14,-6 L32,-6 L42,4 L42,10 L-42,10') +
    `<circle cx="-26" cy="18" r="7" fill="none" stroke="${c}" stroke-width="4"/><circle cx="28" cy="18" r="7" fill="none" stroke="${c}" stroke-width="4"/>`,
  mp: (c) => line(c, 'M-26,-26 L26,-26 L26,26 L-26,26 Z M-26,-26 L26,26 M26,-26 L-26,26'),
  // КП — флажок на древке
  kp: (c) => line(c, 'M-20,32 L-20,-30') + fillP(c, 'M-20,-30 L28,-30 L28,-4 L-20,-4 Z'),
  np: (c) => line(c, 'M-26,20 L0,-26 L26,20 Z') + `<circle cx="0" cy="4" r="5" fill="${c}"/>`,
  heli: (c) =>
    `<ellipse cx="-4" cy="6" rx="22" ry="12" fill="none" stroke="${c}" stroke-width="4"/>` +
    line(c, 'M-40,-14 L40,-14 M0,-14 L0,-6 M18,6 L44,6 M44,-2 L44,14'),
  plane: (c) => line(c, 'M0,-34 L0,30 M-40,4 L0,-10 L40,4 M-16,28 L0,22 L16,28'),
  uav: (c) => line(c, 'M-40,-8 L0,-20 L40,-8 L0,22 Z') + line(c, 'M0,-20 L0,22'),
  mg: (c) => line(c, 'M0,28 L0,-30 M-10,-16 L0,-30 L10,-16 M-12,20 L12,20'),
  hmg: (c) => line(c, 'M0,28 L0,-30 M-10,-16 L0,-30 L10,-16 M-12,20 L12,20 M-12,10 L12,10'),
  agl: (c) => line(c, 'M0,28 L0,-30 M-10,-16 L0,-30 L10,-16') + `<circle cx="0" cy="12" r="9" fill="none" stroke="${c}" stroke-width="4"/>`,
  atgl: (c) => line(c, 'M0,28 L0,-30 M-10,-16 L0,-30 L10,-16 M-14,26 L0,12 L14,26'),
  strong: (c) =>
    line(c, 'M-46,22 C-46,-34 46,-34 46,22') +
    [-38, -22, 0, 22, 38].map((x, i) => {
      const y = [8, -10, -16, -10, 8][i];
      return line(c, `M${x},${y} l${x / 10},${-6}`);
    }).join(''),
  mine: (c) => `<circle cx="0" cy="0" r="16" fill="${c}"/>` + line(c, 'M0,-16 L0,-26'),
  strike: (c) =>
    fillP(c, 'M0,-32 L8,-10 L30,-16 L14,2 L30,20 L6,14 L0,34 L-6,14 L-30,20 L-14,2 L-30,-16 L-8,-10 Z'),
  target: (c) =>
    `<circle cx="0" cy="0" r="22" fill="none" stroke="${c}" stroke-width="4"/><circle cx="0" cy="0" r="4" fill="${c}"/>` +
    line(c, 'M-32,0 L-24,0 M24,0 L32,0 M0,-32 L0,-24 M0,24 L0,32'),
  bridge: (c) => line(c, 'M-40,-14 L-30,-6 L30,-6 L40,-14 M-40,14 L-30,6 L30,6 L40,14'),
};

function renderRu(def: SymbolDef, o: SymbolOpts): RenderedSymbol {
  const c = sideColor(o.standard, o.side, o.color);
  const glyph = (RU[def.id] ?? RU.inf)(c);
  const mark = def.equipment ? '' : ECH[o.echelon].mark;
  const dash = o.planned ? 'stroke-dasharray="9 7"' : '';
  // local units: glyph box [-50,50]x[-40,40]; echelon text above, HQ staff below
  const minX = -52;
  const maxX = 52;
  const minY = mark ? -66 : -42;
  const maxY = o.hq ? 80 : 40;
  const vbW = maxX - minX;
  const vbH = maxY - minY;
  const scale = o.size / 100;
  const w = vbW * scale;
  const h = vbH * scale;
  const halo = `<g stroke="rgba(255,255,255,0.85)" stroke-width="10" fill="none" opacity="0.9">${glyph.replace(/stroke="[^"]+"/g, 'stroke="rgba(255,255,255,0.85)"').replace(/stroke-width="4"/g, 'stroke-width="10"').replace(/fill="(?!none)[^"]+"/g, 'fill="rgba(255,255,255,0.85)"')}</g>`;
  const echelon = mark
    ? `<text x="0" y="-52" fill="${c}" stroke="rgba(255,255,255,0.85)" stroke-width="5" paint-order="stroke" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${mark.includes('•') ? 30 : 22}" text-anchor="middle" dominant-baseline="central" letter-spacing="${mark.includes('•') ? 2 : 0}">${mark}</text>`
    : '';
  const staff = o.hq ? line(c, 'M0,40 L0,78') : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX} ${minY} ${vbW} ${vbH}">` +
    `${halo}<g ${dash}>${glyph}${staff}</g>${echelon}</svg>`;
  const ax = (0 - minX) * scale;
  const ay = ((o.hq ? 78 : 0) - minY) * scale;
  return { svg, w, h, ax, ay, bodyW: 50 * scale, bodyH: 34 * scale };
}
