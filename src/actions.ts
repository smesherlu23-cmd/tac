import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyDoc, useStore } from './store';
import type { Doc, MapObject } from './types';
import { MapContent } from './components/MapSvg';

export const clipboard: { items: MapObject[] } = { items: [] };

interface TacticApi {
  openProject(): Promise<{ filePath: string; json: string } | null>;
  saveProject(json: string, filePath: string | null): Promise<string | null>;
  openImage(): Promise<{ name: string; dataUrl: string } | null>;
  saveExport(data: string, ext: string, encoding: 'utf8' | 'base64'): Promise<string | null>;
  exportPdf(svg: string, width: number, height: number): Promise<string | null>;
  onMenu(cb: (cmd: string) => void): () => void;
  setTitle(title: string): void;
}

export const api: TacticApi | undefined = (window as unknown as { tactic?: TacticApi }).tactic;

const toast = (t: string) => useStore.getState().showToast(t);

/* --------------------------------------------------------------- view */

export function contentBounds(doc: Doc): { x: number; y: number; w: number; h: number } | null {
  if (doc.map) return { x: 0, y: 0, w: doc.map.width, h: doc.map.height };
  const els = document.querySelectorAll('svg.canvas [data-id]');
  if (!els.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  els.forEach((el) => {
    const b = (el as SVGGraphicsElement).getBBox();
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.width);
    y2 = Math.max(y2, b.y + b.height);
  });
  const pad = 40;
  return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 };
}

export function fitView(vw: number, vh: number) {
  const b = contentBounds(useStore.getState().doc);
  if (!b) {
    useStore.getState().setView({ zoom: 1, x: vw / 2, y: vh / 2 });
    return;
  }
  const zoom = Math.min((vw - 60) / b.w, (vh - 60) / b.h, 4);
  useStore.getState().setView({ zoom, x: (vw - b.w * zoom) / 2 - b.x * zoom, y: (vh - b.h * zoom) / 2 - b.y * zoom });
}

export const requestFit = () => window.dispatchEvent(new Event('tactic:fit'));

/* --------------------------------------------------------------- files */

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

const readAsDataUrl = (f: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

function download(name: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

function confirmDiscard(): boolean {
  if (!useStore.getState().dirty) return true;
  return window.confirm('Есть несохранённые изменения. Продолжить без сохранения?');
}

export function newDoc() {
  if (!confirmDiscard()) return;
  useStore.getState().loadDoc(emptyDoc(), null);
  requestFit();
}

export async function setMapFromDataUrl(dataUrl: string, name: string) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  useStore.getState().change((d) => ({
    ...d,
    map: { dataUrl, name, width: img.naturalWidth, height: img.naturalHeight, opacity: 1, grayscale: false },
    title: d.title === 'Новая карта' ? name.replace(/\.[^.]+$/, '') : d.title,
  }));
  requestFit();
  toast(`Карта загружена: ${img.naturalWidth}×${img.naturalHeight}`);
}

export async function openMap() {
  if (api) {
    const r = await api.openImage();
    if (r) await setMapFromDataUrl(r.dataUrl, r.name);
    return;
  }
  const f = await pickFile('image/*');
  if (f) await setMapFromDataUrl(await readAsDataUrl(f), f.name);
}

export async function openMapFile(f: File) {
  await setMapFromDataUrl(await readAsDataUrl(f), f.name);
}

function parseDoc(json: string): Doc {
  const d = JSON.parse(json) as Doc;
  if (!d || d.version !== 1 || !Array.isArray(d.objects) || !Array.isArray(d.layers)) throw new Error('Неверный формат файла');
  return d;
}

export async function openProject() {
  if (!confirmDiscard()) return;
  try {
    if (api) {
      const r = await api.openProject();
      if (!r) return;
      useStore.getState().loadDoc(parseDoc(r.json), r.filePath);
    } else {
      const f = await pickFile('.tmap,application/json');
      if (!f) return;
      useStore.getState().loadDoc(parseDoc(await f.text()), null);
    }
    requestFit();
  } catch (e) {
    toast(`Не удалось открыть: ${(e as Error).message}`);
  }
}

export async function openProjectFile(f: File) {
  if (!confirmDiscard()) return;
  try {
    useStore.getState().loadDoc(parseDoc(await f.text()), null);
    requestFit();
  } catch (e) {
    toast(`Не удалось открыть: ${(e as Error).message}`);
  }
}

export async function saveProject(saveAs = false) {
  const st = useStore.getState();
  const json = JSON.stringify(st.doc);
  if (api) {
    const p = await api.saveProject(json, saveAs ? null : st.filePath);
    if (p) {
      st.markSaved(p);
      toast('Сохранено');
    }
  } else {
    download(`${st.doc.title || 'карта'}.tmap`, URL.createObjectURL(new Blob([json], { type: 'application/json' })));
    st.markSaved('');
  }
}

/* --------------------------------------------------------------- export */

export function buildExportSvg(): { svg: string; w: number; h: number } | null {
  const doc = useStore.getState().doc;
  const b = contentBounds(doc);
  if (!b) return null;
  const inner = renderToStaticMarkup(createElement(MapContent, { doc }));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.round(b.w)}" height="${Math.round(b.h)}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}">` +
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#ffffff"/>${inner}</svg>`;
  return { svg, w: Math.round(b.w), h: Math.round(b.h) };
}

async function svgToPngDataUrl(svg: string, w: number, h: number, scale: number): Promise<string> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const maxSide = 16000;
    const k = Math.min(scale, maxSide / w, maxSide / h);
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportPng(scale = 2) {
  const r = buildExportSvg();
  if (!r) return toast('Нечего экспортировать');
  toast('Экспорт PNG…');
  const png = await svgToPngDataUrl(r.svg, r.w, r.h, scale);
  const name = useStore.getState().doc.title || 'карта';
  if (api) {
    const p = await api.saveExport(png.split(',')[1], 'png', 'base64');
    if (p) toast('PNG сохранён');
  } else download(`${name}.png`, png);
}

export async function exportSvg() {
  const r = buildExportSvg();
  if (!r) return toast('Нечего экспортировать');
  const name = useStore.getState().doc.title || 'карта';
  if (api) {
    const p = await api.saveExport(r.svg, 'svg', 'utf8');
    if (p) toast('SVG сохранён');
  } else download(`${name}.svg`, URL.createObjectURL(new Blob([r.svg], { type: 'image/svg+xml' })));
}

export async function exportPdf() {
  const r = buildExportSvg();
  if (!r) return toast('Нечего экспортировать');
  if (api) {
    toast('Экспорт PDF…');
    const p = await api.exportPdf(r.svg, r.w, r.h);
    if (p) toast('PDF сохранён');
  } else {
    toast('PDF доступен в настольной версии');
  }
}
