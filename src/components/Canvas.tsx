import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { docScale, layerFor, uid, useStore } from '../store';
import type { AreaObj, ArrowObj, LineObj, MapObject, Pt, TextObj, Tool, UnitObj } from '../types';
import { MapContent, objColor } from './MapSvg';
import { dedupePoints, dist, formatDistance, smoothPath, toPathD } from '../graphics/geometry';
import { clipboard, fitView } from '../actions';

type Drag =
  | { mode: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { mode: 'move'; start: Pt; orig: MapObject[]; moved: boolean }
  | { mode: 'vertex'; id: string; index: number; moved: boolean }
  | { mode: 'resize'; id: string; center: Pt; startDist: number; orig: number; moved: boolean }
  | { mode: 'rotate'; id: string; center: Pt; moved: boolean }
  | { mode: 'band'; start: Pt; cur: Pt }
  | { mode: 'measure'; start: Pt; cur: Pt };

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const POINT_TOOLS = ['arrow', 'line', 'area', 'calibrate'] as const;

function translate(o: MapObject, dx: number, dy: number): MapObject {
  switch (o.kind) {
    case 'unit':
    case 'text':
      return { ...o, x: o.x + dx, y: o.y + dy };
    default:
      return { ...o, points: o.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
}

export default function Canvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const doc = useStore((s) => s.doc);
  const view = useStore((s) => s.view);
  const tool = useStore((s) => s.tool);
  const selection = useStore((s) => s.selection);
  const defaults = useStore((s) => s.defaults);

  const drag = useRef<Drag | null>(null);
  const [dragState, setDragState] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [hover, setHover] = useState<Pt | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [spaceDown, setSpaceDown] = useState(false);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [calib, setCalib] = useState<{ a: Pt; b: Pt; value: string } | null>(null);
  const [measureResult, setMeasureResult] = useState<{ a: Pt; b: Pt } | null>(null);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Pt => {
      const r = svgRef.current!.getBoundingClientRect();
      return { x: (clientX - r.left - view.x) / view.zoom, y: (clientY - r.top - view.y) / view.zoom };
    },
    [view],
  );

  // reset draft when tool changes
  useEffect(() => {
    setDraft([]);
    setMeasureResult(null);
  }, [tool]);

  // measure selection boxes after each render
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const res: Box[] = [];
    for (const id of selection) {
      const el = svg.querySelector(`[data-id="${id}"]`) as SVGGraphicsElement | null;
      if (!el) continue;
      const b = el.getBBox();
      res.push({ id, x: b.x, y: b.y, w: b.width, h: b.height });
    }
    setBoxes((prev) => (JSON.stringify(prev) === JSON.stringify(res) ? prev : res));
  });

  // initial fit when map loaded
  const mapKey = doc.map?.dataUrl.length ?? 0;
  useEffect(() => {
    if (wrapRef.current) fitView(wrapRef.current.clientWidth, wrapRef.current.clientHeight);
  }, [mapKey]);

  useEffect(() => {
    const onFit = () => wrapRef.current && fitView(wrapRef.current.clientWidth, wrapRef.current.clientHeight);
    window.addEventListener('tactic:fit', onFit);
    return () => window.removeEventListener('tactic:fit', onFit);
  }, []);

  /**
   * Turn the drafted points into an object. After that the editor switches to
   * the select tool (unless `keep`, e.g. Shift held) so the new object can be
   * adjusted right away instead of starting another one by accident.
   */
  const finishDraft = useCallback(
    (raw: Pt[], keep = false, forTool: Tool = tool) => {
      const st = useStore.getState();
      const d = st.defaults;
      const k = docScale(st.doc);
      // drop the duplicate points a double click leaves at the end
      const pts = dedupePoints(raw, 3 / st.view.zoom, forTool === 'area');
      let made = false;
      if (forTool === 'arrow' && pts.length >= 2) {
        const wide = d.arrowStyle === 'main' || d.arrowStyle === 'counter';
        const o: ArrowObj = { id: uid(), kind: 'arrow', layerId: layerFor('arrow', d.side), side: d.side, style: d.arrowStyle, points: pts, width: (wide ? 36 : 22) * k, label: '' };
        st.addObject(o);
        made = true;
      } else if (forTool === 'line' && pts.length >= 2) {
        const o: LineObj = { id: uid(), kind: 'line', layerId: layerFor('line', d.side), side: d.side, style: d.lineStyle, points: pts, width: 3 * k, smooth: true, label: '' };
        st.addObject(o);
        made = true;
      } else if (forTool === 'area' && pts.length >= 3) {
        const o: AreaObj = { id: uid(), kind: 'area', layerId: layerFor('area', d.side), side: d.side, points: pts, width: 3 * k, fill: d.areaFill, fillOpacity: d.areaFill === 'solid' ? 0.2 : 0.7, dashed: false, smooth: true, label: '' };
        st.addObject(o);
        made = true;
      } else if (raw.length && forTool !== 'calibrate') {
        st.showToast(forTool === 'area' ? 'Для района нужно минимум 3 точки' : 'Нужно минимум 2 точки');
      }
      setDraft([]);
      if (made && !keep && st.tool === forTool) st.setTool('select');
    },
    [tool],
  );

  // switching tools in the middle of drawing keeps the drawn object instead of losing it
  const draftRef = useRef<Pt[]>(draft);
  draftRef.current = draft;
  const finishRef = useRef(finishDraft);
  finishRef.current = finishDraft;
  useEffect(
    () => () => {
      if (draftRef.current.length) finishRef.current(draftRef.current, true, tool);
    },
    [tool],
  );

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const st = useStore.getState();
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.code === 'Space') {
        setSpaceDown(true);
        e.preventDefault();
        return;
      }
      if (draft.length) {
        if (e.key === 'Enter') return finishDraft(draft, e.shiftKey);
        if (e.key === 'Escape') return setDraft([]);
        if (e.key === 'Backspace') return setDraft(draft.slice(0, -1));
      }
      if (ctrl && e.code === 'KeyZ') {
        e.preventDefault();
        return e.shiftKey ? st.redo() : st.undo();
      }
      if (ctrl && e.code === 'KeyY') {
        e.preventDefault();
        return st.redo();
      }
      if (ctrl && e.code === 'KeyA') {
        e.preventDefault();
        const unlocked = new Set(st.doc.layers.filter((l) => !l.locked && l.visible).map((l) => l.id));
        return st.setSelection(st.doc.objects.filter((o) => unlocked.has(o.layerId)).map((o) => o.id));
      }
      if (ctrl && e.code === 'KeyC') {
        clipboard.items = st.doc.objects.filter((o) => st.selection.includes(o.id));
        return;
      }
      if (ctrl && (e.code === 'KeyV' || e.code === 'KeyD')) {
        e.preventDefault();
        const src = e.code === 'KeyD' ? st.doc.objects.filter((o) => st.selection.includes(o.id)) : clipboard.items;
        if (!src.length) return;
        const copies = src.map((o) => ({ ...translate(o, 20, 20), id: uid() }) as MapObject);
        if (e.code === 'KeyV') clipboard.items = copies;
        st.change((d) => ({ ...d, objects: [...d.objects, ...copies] }));
        st.setSelection(copies.map((c) => c.id));
        return;
      }
      if (ctrl) return;
      if (e.key === 'Delete' || e.key === 'Backspace') return st.deleteSelection();
      if (e.key === 'Escape') {
        st.setSelection([]);
        st.setTool('select');
        return;
      }
      if (e.key.startsWith('Arrow') && st.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        st.updateObjects(st.selection, (o) => translate(o, dx, dy));
        return;
      }
      const map: Record<string, typeof st.tool> = { KeyV: 'select', KeyH: 'pan', KeyU: 'unit', KeyA: 'arrow', KeyL: 'line', KeyR: 'area', KeyT: 'text', KeyM: 'measure' };
      if (map[e.code]) st.setTool(map[e.code]);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
    };
  }, [draft, finishDraft]);

  // wheel zoom (non-passive)
  useEffect(() => {
    const svg = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useStore.getState();
      const v = st.view;
      const r = svg.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      if (e.ctrlKey || !e.shiftKey) {
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        const zoom = Math.min(20, Math.max(0.05, v.zoom * factor));
        const k = zoom / v.zoom;
        st.setView({ zoom, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k });
      } else {
        st.setView({ x: v.x - e.deltaY, y: v.y - e.deltaX });
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const startDrag = (d: Drag, e: React.PointerEvent) => {
    drag.current = d;
    setDragState(d);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const placeUnit = (p: Pt, symbol?: string, keep = false) => {
    const st = useStore.getState();
    const d = st.defaults;
    const k = docScale(st.doc);
    const o: UnitObj = {
      id: uid(),
      kind: 'unit',
      layerId: layerFor('unit', d.side),
      side: d.side,
      symbol: symbol ?? d.symbol,
      x: p.x,
      y: p.y,
      size: Math.round(d.unitSize * k),
      rotation: 0,
      echelon: d.echelon,
      planned: d.planned,
      hq: d.hq,
      label: '',
      note: '',
    };
    st.addObject(o);
    // after placing a sign go back to selection (hold Shift to keep placing)
    if (!keep) st.setTool('select');
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const st = useStore.getState();
    const p = toWorld(e.clientX, e.clientY);
    if (editing) commitEdit();
    // right click finishes a line / arrow / area being drawn
    if (e.button === 2 && draft.length && tool !== 'calibrate') {
      e.preventDefault();
      return finishDraft(draft, e.shiftKey);
    }
    if (e.button === 1 || e.button === 2 || tool === 'pan' || spaceDown) {
      e.preventDefault();
      return startDrag({ mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }, e);
    }
    if (e.button !== 0) return;
    const target = e.target as Element;
    const handle = target.closest('[data-handle]') as SVGElement | null;
    if (handle && tool === 'select') {
      const [kind, id, idx] = handle.dataset.handle!.split(':');
      const obj = st.doc.objects.find((o) => o.id === id);
      if (!obj) return;
      if (kind === 'v') return startDrag({ mode: 'vertex', id, index: Number(idx), moved: false }, e);
      if (kind === 'ins' && 'points' in obj) {
        st.updateObjects([id], (o) => {
          const pts = (o as LineObj).points.slice();
          pts.splice(Number(idx) + 1, 0, p);
          return { ...o, points: pts } as MapObject;
        });
        return startDrag({ mode: 'vertex', id, index: Number(idx) + 1, moved: true }, e);
      }
      const box = boxes.find((b) => b.id === id);
      const center = obj.kind === 'unit' || obj.kind === 'text' ? { x: obj.x, y: obj.y } : box ? { x: box.x + box.w / 2, y: box.y + box.h / 2 } : p;
      if (kind === 'size') {
        const orig = obj.kind === 'unit' ? obj.size : obj.kind === 'text' ? obj.fontSize : 1;
        return startDrag({ mode: 'resize', id, center, startDist: Math.max(1, dist(center, p)), orig, moved: false }, e);
      }
      if (kind === 'rot') return startDrag({ mode: 'rotate', id, center, moved: false }, e);
    }

    if (tool === 'unit') return placeUnit(p, undefined, e.shiftKey);
    if (tool === 'text') {
      const o: TextObj = { id: uid(), kind: 'text', layerId: layerFor('text', st.defaults.side), side: st.defaults.side, x: p.x, y: p.y, text: '', fontSize: Math.round(22 * docScale(st.doc)), rotation: 0, bold: true, halo: true };
      st.addObject(o);
      if (!e.shiftKey) st.setTool('select');
      // open the editor after the browser finishes the mouse-down focus change
      setTimeout(() => setEditing({ id: o.id, value: '' }), 0);
      return;
    }
    if (tool === 'measure') {
      setMeasureResult(null);
      return startDrag({ mode: 'measure', start: p, cur: p }, e);
    }
    if ((POINT_TOOLS as readonly string[]).includes(tool)) {
      // the second click of a double click lands on the same spot: don't add it twice
      const last = draft[draft.length - 1];
      if (e.detail >= 2 || (last && dist(last, p) * view.zoom < 4)) return;
      const next = [...draft, p];
      if (tool === 'calibrate' && next.length === 2) {
        setDraft([]);
        setCalib({ a: next[0], b: next[1], value: '' });
        return;
      }
      setDraft(next);
      return;
    }

    // select tool
    const hit = target.closest('[data-id]') as SVGElement | null;
    const id = hit?.getAttribute('data-id');
    if (id) {
      let sel = st.selection;
      if (e.shiftKey) {
        sel = sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id];
        st.setSelection(sel);
        return;
      }
      if (!sel.includes(id)) {
        sel = [id];
        st.setSelection(sel);
      }
      const orig = st.doc.objects.filter((o) => sel.includes(o.id));
      return startDrag({ mode: 'move', start: p, orig, moved: false }, e);
    }
    if (!e.shiftKey) st.setSelection([]);
    startDrag({ mode: 'band', start: p, cur: p }, e);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toWorld(e.clientX, e.clientY);
    useStore.getState().setCursor(p);
    setHover(p);
    const d = drag.current;
    if (!d) return;
    const st = useStore.getState();
    switch (d.mode) {
      case 'pan':
        st.setView({ x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy });
        break;
      case 'move': {
        const dx = p.x - d.start.x;
        const dy = p.y - d.start.y;
        if (!d.moved) {
          if (Math.hypot(dx, dy) * view.zoom < 3) return;
          st.checkpoint();
          d.moved = true;
        }
        const byId = new Map(d.orig.map((o) => [o.id, o]));
        st.patch((doc) => ({ ...doc, objects: doc.objects.map((o) => (byId.has(o.id) ? translate(byId.get(o.id)!, dx, dy) : o)) }));
        break;
      }
      case 'vertex': {
        if (!d.moved) {
          st.checkpoint();
          d.moved = true;
        }
        st.updateObjects(
          [d.id],
          (o) => {
            const pts = (o as LineObj).points.slice();
            pts[d.index] = p;
            return { ...o, points: pts } as MapObject;
          },
          false,
        );
        break;
      }
      case 'resize': {
        if (!d.moved) {
          st.checkpoint();
          d.moved = true;
        }
        const k = dist(d.center, p) / d.startDist;
        st.updateObjects(
          [d.id],
          (o) => {
            const s = docScale(st.doc);
            if (o.kind === 'unit') return { ...o, size: Math.max(16, Math.min(400 * s, d.orig * k)) };
            if (o.kind === 'text') return { ...o, fontSize: Math.max(6, Math.min(300 * s, d.orig * k)) };
            return o;
          },
          false,
        );
        break;
      }
      case 'rotate': {
        if (!d.moved) {
          st.checkpoint();
          d.moved = true;
        }
        let ang = (Math.atan2(p.y - d.center.y, p.x - d.center.x) * 180) / Math.PI + 90;
        if (e.shiftKey) ang = Math.round(ang / 15) * 15;
        ang = ((ang % 360) + 360) % 360;
        st.updateObjects([d.id], (o) => (o.kind === 'unit' || o.kind === 'text' ? { ...o, rotation: Math.round(ang) } : o), false);
        break;
      }
      case 'band':
      case 'measure':
        drag.current = { ...d, cur: p };
        setDragState(drag.current);
        break;
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragState(null);
    if (!d) return;
    const st = useStore.getState();
    if (d.mode === 'band') {
      const x1 = Math.min(d.start.x, d.cur.x);
      const x2 = Math.max(d.start.x, d.cur.x);
      const y1 = Math.min(d.start.y, d.cur.y);
      const y2 = Math.max(d.start.y, d.cur.y);
      if ((x2 - x1) * view.zoom < 4 && (y2 - y1) * view.zoom < 4) return;
      const ids: string[] = [];
      svgRef.current!.querySelectorAll('[data-id]').forEach((el) => {
        const b = (el as SVGGraphicsElement).getBBox();
        if (b.x >= x1 && b.y >= y1 && b.x + b.width <= x2 && b.y + b.height <= y2) ids.push(el.getAttribute('data-id')!);
      });
      st.setSelection([...new Set([...st.selection, ...ids])]);
    }
    if (d.mode === 'measure') setMeasureResult({ a: d.start, b: d.cur });
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const st = useStore.getState();
    if ((POINT_TOOLS as readonly string[]).includes(tool)) {
      if (tool !== 'calibrate') finishDraft(draft, e.shiftKey);
      return;
    }
    const target = e.target as Element;
    const handle = target.closest('[data-handle]') as SVGElement | null;
    if (handle) {
      const [kind, id, idx] = handle.dataset.handle!.split(':');
      if (kind === 'v') {
        const o = st.doc.objects.find((x) => x.id === id) as LineObj | AreaObj | undefined;
        const min = o?.kind === 'area' ? 3 : 2;
        if (o && o.points.length > min) st.updateObjects([id], (x) => ({ ...x, points: (x as LineObj).points.filter((_, i) => i !== Number(idx)) }) as MapObject);
      }
      return;
    }
    const hit = target.closest('[data-id]') as SVGElement | null;
    const id = hit?.getAttribute('data-id');
    const obj = st.doc.objects.find((o) => o.id === id);
    if (obj?.kind === 'text') setEditing({ id: obj.id, value: obj.text });
  };

  const commitEdit = () => {
    if (!editing) return;
    const st = useStore.getState();
    const value = editing.value.trim() ? editing.value : '';
    if (!value) {
      st.patch((d) => ({ ...d, objects: d.objects.filter((o) => o.id !== editing.id) }));
      st.setSelection([]);
    } else {
      st.patch((d) => ({ ...d, objects: d.objects.map((o) => (o.id === editing.id && o.kind === 'text' ? { ...o, text: value } : o)) }));
    }
    setEditing(null);
  };

  const onDrop = (e: React.DragEvent) => {
    const sym = e.dataTransfer.getData('application/x-tactic-symbol');
    if (!sym) return;
    e.preventDefault();
    useStore.getState().setDefaults({ symbol: sym });
    placeUnit(toWorld(e.clientX, e.clientY), sym);
  };

  // ---------------------------------------------------------------- overlays
  const z = view.zoom;
  const hs = 5 / z; // handle half-size in world units
  const selObjs = doc.objects.filter((o) => selection.includes(o.id));
  const draftPts = hover && draft.length ? [...draft, hover] : draft;
  const draftColor = objColor({ side: defaults.side } as MapObject, doc.standard);
  const mpp = doc.metersPerPx;
  const measureLabel = (a: Pt, b: Pt) => {
    const px = dist(a, b);
    return mpp ? formatDistance(px * mpp) : `${Math.round(px)} пикс. (масштаб не задан)`;
  };
  const meas = dragState?.mode === 'measure' ? { a: dragState.start, b: dragState.cur } : measureResult;

  const cursor =
    tool === 'pan' || spaceDown ? (dragState?.mode === 'pan' ? 'grabbing' : 'grab') : tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';

  const editObj = editing ? (doc.objects.find((o) => o.id === editing.id) as TextObj | undefined) : undefined;

  return (
    <div className="canvas-wrap" ref={wrapRef} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <svg
        ref={svgRef}
        className="canvas"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHover(null);
          useStore.getState().setCursor(null);
        }}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${z})`}>
          {doc.map ? (
            <rect x={0} y={0} width={doc.map.width} height={doc.map.height} fill="#fff" className="map-shadow" />
          ) : null}
          <MapContent doc={doc} interactive hitWidth={14 / z} />

          {/* selection */}
          {boxes.map((b) => {
            const o = selObjs.find((x) => x.id === b.id);
            if (!o) return null;
            const pad = 4 / z;
            const scalable = o.kind === 'unit' || o.kind === 'text';
            return (
              <g key={b.id} className="sel">
                <rect x={b.x - pad} y={b.y - pad} width={b.w + pad * 2} height={b.h + pad * 2} fill="none" stroke="#14a1ff" strokeWidth={1.2 / z} strokeDasharray={`${4 / z} ${3 / z}`} />
                {scalable && selection.length === 1 && tool === 'select' && (
                  <>
                    <rect data-handle={`size:${o.id}`} x={b.x + b.w + pad - hs} y={b.y + b.h + pad - hs} width={hs * 2} height={hs * 2} className="handle" strokeWidth={1.5 / z} style={{ cursor: 'nwse-resize' }} />
                    <line x1={b.x + b.w / 2} y1={b.y - pad} x2={b.x + b.w / 2} y2={b.y - pad - 18 / z} stroke="#14a1ff" strokeWidth={1.2 / z} />
                    <circle data-handle={`rot:${o.id}`} cx={b.x + b.w / 2} cy={b.y - pad - 18 / z} r={hs} className="handle" strokeWidth={1.5 / z} style={{ cursor: 'grab' }} />
                  </>
                )}
              </g>
            );
          })}
          {selection.length === 1 &&
            tool === 'select' &&
            selObjs.map((o) =>
              'points' in o ? (
                <g key={o.id + 'v'}>
                  {o.points.map((p, i) => {
                    const n = o.points[(i + 1) % o.points.length];
                    const last = i === o.points.length - 1 && o.kind !== 'area';
                    return last ? null : (
                      <circle key={'m' + i} data-handle={`ins:${o.id}:${i}`} cx={(p.x + n.x) / 2} cy={(p.y + n.y) / 2} r={hs * 0.75} className="handle mid" strokeWidth={1 / z} />
                    );
                  })}
                  {o.points.map((p, i) => (
                    <rect key={i} data-handle={`v:${o.id}:${i}`} x={p.x - hs} y={p.y - hs} width={hs * 2} height={hs * 2} className="handle" strokeWidth={1.5 / z} />
                  ))}
                </g>
              ) : null,
            )}

          {/* drafting */}
          {draftPts.length > 0 && (
            <g pointerEvents="none">
              <path
                d={toPathD(tool === 'calibrate' ? draftPts : smoothPath(draftPts, tool === 'area'), tool === 'area')}
                fill={tool === 'area' ? draftColor : 'none'}
                fillOpacity={0.12}
                stroke={tool === 'calibrate' ? '#ff8c00' : draftColor}
                strokeWidth={2.5 / z}
                strokeDasharray={`${6 / z} ${4 / z}`}
              />
              {draft.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3.5 / z} fill="#fff" stroke={draftColor} strokeWidth={1.5 / z} />
              ))}
            </g>
          )}

          {dragState?.mode === 'band' && (
            <rect
              x={Math.min(dragState.start.x, dragState.cur.x)}
              y={Math.min(dragState.start.y, dragState.cur.y)}
              width={Math.abs(dragState.cur.x - dragState.start.x)}
              height={Math.abs(dragState.cur.y - dragState.start.y)}
              fill="rgba(20,161,255,0.08)"
              stroke="#14a1ff"
              strokeWidth={1 / z}
            />
          )}

          {meas && (
            <g pointerEvents="none">
              <line x1={meas.a.x} y1={meas.a.y} x2={meas.b.x} y2={meas.b.y} stroke="#111" strokeWidth={4 / z} />
              <line x1={meas.a.x} y1={meas.a.y} x2={meas.b.x} y2={meas.b.y} stroke="#ffd400" strokeWidth={2 / z} strokeDasharray={`${8 / z} ${5 / z}`} />
              <text
                x={(meas.a.x + meas.b.x) / 2}
                y={(meas.a.y + meas.b.y) / 2 - 10 / z}
                fontSize={14 / z}
                fontWeight={700}
                fontFamily="Arial"
                fill="#111"
                stroke="#fff"
                strokeWidth={4 / z}
                paintOrder="stroke"
                textAnchor="middle"
              >
                {measureLabel(meas.a, meas.b)}
              </text>
            </g>
          )}
        </g>
      </svg>

      {!doc.map && doc.objects.length === 0 && (
        <div className="empty-hint">
          <div className="empty-title">Загрузите карту местности</div>
          <div>Файл → Загрузить карту (Ctrl+M) или перетащите фото сюда</div>
        </div>
      )}

      {editing && editObj && (
        <textarea
          className="inline-edit"
          autoFocus
          style={{
            left: view.x + editObj.x * z - 100,
            top: view.y + editObj.y * z - 16,
            fontSize: Math.max(12, editObj.fontSize * z),
          }}
          value={editing.value}
          placeholder="Текст…"
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commitEdit();
            }
            if (e.key === 'Escape') commitEdit();
          }}
        />
      )}

      {calib && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              const m = parseFloat(calib.value.replace(',', '.'));
              const px = dist(calib.a, calib.b);
              if (m > 0 && px > 0) {
                useStore.getState().change((d) => ({ ...d, metersPerPx: m / px }));
                useStore.getState().showToast(`Масштаб задан: 1 пикс. = ${(m / px).toFixed(2)} м`);
              }
              setCalib(null);
              useStore.getState().setTool('select');
            }}
          >
            <div className="modal-title">Калибровка масштаба</div>
            <label>
              Расстояние между отмеченными точками, метров
              <input autoFocus value={calib.value} onChange={(e) => setCalib({ ...calib, value: e.target.value })} placeholder="например, 1000" />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setCalib(null)}>
                Отмена
              </button>
              <button type="submit" className="primary">
                Задать
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
