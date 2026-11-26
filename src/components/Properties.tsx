import type { ReactNode } from 'react';
import { docScale, useStore, uid } from '../store';
import type { Doc, MapObject, Side } from '../types';
import { SYMBOLS } from '../symbols/catalog';
import { ECHELONS, SIDE_NAMES, sideColor } from '../symbols/render';
import { ARROW_STYLES, FILL_STYLES, LINE_STYLES } from './Palette';
import { Icons } from './icons';
import { formatDistance } from '../graphics/geometry';

/** Coalesce rapid edits of the same field into one undo step. */
let lastKey = '';
let lastTime = 0;
function edit(ids: string[], key: string, fn: (o: MapObject) => MapObject) {
  const now = Date.now();
  const k = ids.join(',') + ':' + key;
  const record = k !== lastKey || now - lastTime > 1000;
  lastKey = k;
  lastTime = now;
  useStore.getState().updateObjects(ids, fn, record);
}

function editDoc(key: string, fn: (d: Doc) => Doc) {
  const now = Date.now();
  const record = key !== lastKey || now - lastTime > 1000;
  lastKey = key;
  lastTime = now;
  const st = useStore.getState();
  if (record) st.change(fn);
  else st.patch(fn);
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);

function Range({ value, min, max, step = 1, onChange, suffix = '' }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="range">
      <input type="range" min={min} max={Math.max(max, value)} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span>
        {step < 1 ? value.toFixed(2) : Math.round(value)}
        {suffix}
      </span>
    </div>
  );
}

function DocProps() {
  const doc = useStore((s) => s.doc);
  const setTool = useStore((s) => s.setTool);
  return (
    <>
      <div className="section-title">Документ</div>
      <Field label="Название">
        <input value={doc.title} onChange={(e) => editDoc('title', (d) => ({ ...d, title: e.target.value }))} />
      </Field>
      {doc.map ? (
        <>
          <div className="section-title">Подложка</div>
          <div className="muted small">
            {doc.map.name} · {doc.map.width}×{doc.map.height}
          </div>
          <Field label="Прозрачность карты">
            <Range value={doc.map.opacity} min={0.1} max={1} step={0.05} onChange={(v) => editDoc('mapop', (d) => ({ ...d, map: d.map && { ...d.map, opacity: v } }))} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={doc.map.grayscale} onChange={(e) => editDoc('gray', (d) => ({ ...d, map: d.map && { ...d.map, grayscale: e.target.checked } }))} />
            Обесцветить карту (знаки заметнее)
          </label>
          <button className="btn danger" onClick={() => useStore.getState().change((d) => ({ ...d, map: null }))}>
            Убрать подложку
          </button>
        </>
      ) : null}
      <div className="section-title">Масштаб</div>
      <div className="muted small">
        {doc.metersPerPx ? `1 пикс. карты = ${doc.metersPerPx.toFixed(2)} м; 100 пикс. = ${formatDistance(doc.metersPerPx * 100)}` : 'Не задан. Отметьте две точки с известным расстоянием.'}
      </div>
      <button className="btn" onClick={() => setTool('calibrate')}>
        {Icons.calibrate} Задать масштаб по двум точкам
      </button>
      <p className="hint">
        Горячие клавиши: V выделение, U знак, A стрелка, L линия, R район, T текст, M линейка, пробел + мышь — перемещение, колесо — масштаб,
        Ctrl+D — копия, Delete — удалить, стрелки — сдвиг.
      </p>
    </>
  );
}

export default function Properties() {
  const selection = useStore((s) => s.selection);
  const doc = useStore((s) => s.doc);
  const objs = doc.objects.filter((o) => selection.includes(o.id));
  const st = useStore.getState;

  if (!objs.length) return <DocProps />;

  const ids = objs.map((o) => o.id);
  const o = objs[0];
  const single = objs.length === 1;
  // slider limits follow the map size so large photos still get usable ranges
  const ks = docScale(doc);
  const color = o.color || sideColor(doc.standard, o.side);

  const reorder = (dir: 1 | -1) =>
    st().change((d) => {
      const arr = d.objects.slice();
      const idxs = ids.map((id) => arr.findIndex((x) => x.id === id)).sort((a, b) => (dir > 0 ? b - a : a - b));
      for (const i of idxs) {
        let j = i + dir;
        while (j >= 0 && j < arr.length && arr[j].layerId !== arr[i].layerId) j += dir;
        if (j < 0 || j >= arr.length) continue;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return { ...d, objects: arr };
    });

  const duplicate = () => {
    const copies = objs.map((x) => {
      const c = JSON.parse(JSON.stringify(x)) as MapObject;
      c.id = uid();
      if ('points' in c) c.points = c.points.map((p) => ({ x: p.x + 20, y: p.y + 20 }));
      else {
        c.x += 20;
        c.y += 20;
      }
      return c;
    });
    st().change((d) => ({ ...d, objects: [...d.objects, ...copies] }));
    st().setSelection(copies.map((c) => c.id));
  };

  const title = single
    ? { unit: 'Условный знак', arrow: 'Стрелка', line: 'Линия', area: 'Район', text: 'Текст' }[o.kind]
    : `Выделено: ${objs.length}`;

  return (
    <>
      <div className="section-title">{title}</div>
      <div className="sides compact">
        {(['own', 'enemy', 'neutral', 'unknown'] as Side[]).map((s) => (
          <button
            key={s}
            className={objs.every((x) => x.side === s) ? 'active' : ''}
            style={{ ['--side' as string]: sideColor(doc.standard, s) }}
            onClick={() => edit(ids, 'side', (x) => ({ ...x, side: s }))}
            title={SIDE_NAMES[s]}
          >
            <i />
            {SIDE_NAMES[s]}
          </button>
        ))}
      </div>
      <div className="row">
        <Field label="Свой цвет">
          <div className="color-row">
            <input type="color" value={color} onChange={(e) => edit(ids, 'color', (x) => ({ ...x, color: e.target.value }))} />
            {objs.some((x) => x.color) && (
              <button className="link" onClick={() => edit(ids, 'color-reset', (x) => ({ ...x, color: undefined }))}>
                по стороне
              </button>
            )}
          </div>
        </Field>
        <Field label="Слой">
          <select value={o.layerId} onChange={(e) => edit(ids, 'layer', (x) => ({ ...x, layerId: e.target.value }))}>
            {doc.layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {single && o.kind === 'unit' && (
        <>
          <Field label="Знак">
            <select value={o.symbol} onChange={(e) => edit(ids, 'symbol', (x) => ({ ...x, symbol: e.target.value }))}>
              {SYMBOLS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Звено">
            <select value={o.echelon} onChange={(e) => edit(ids, 'ech', (x) => ({ ...x, echelon: e.target.value as typeof o.echelon }))}>
              {ECHELONS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.mark ? `${e.mark}  ` : ''}
                  {e.ru}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Обозначение (справа)">
            <input value={o.label} placeholder="напр. 2 мср / 1 мсб" onChange={(e) => edit(ids, 'label', (x) => ({ ...x, label: e.target.value }))} />
          </Field>
          <Field label="Примечание (снизу)">
            <input value={o.note} placeholder="напр. 3 БМП-2, 40 л/с" onChange={(e) => edit(ids, 'note', (x) => ({ ...x, note: e.target.value }))} />
          </Field>
          <div className="row checks">
            <label className="check">
              <input type="checkbox" checked={o.planned} onChange={(e) => edit(ids, 'planned', (x) => ({ ...x, planned: e.target.checked }))} />
              Планируемое
            </label>
            <label className="check">
              <input type="checkbox" checked={o.hq} onChange={(e) => edit(ids, 'hq', (x) => ({ ...x, hq: e.target.checked }))} />
              Штаб
            </label>
          </div>
          <Field label="Размер">
            <Range value={o.size} min={16} max={Math.round(240 * ks)} onChange={(v) => edit(ids, 'size', (x) => ({ ...x, size: v }))} />
          </Field>
          <Field label="Поворот">
            <Range value={o.rotation} min={0} max={359} suffix="°" onChange={(v) => edit(ids, 'rot', (x) => ({ ...x, rotation: v }))} />
          </Field>
        </>
      )}

      {single && o.kind === 'arrow' && (
        <>
          <Field label="Тип">
            <select value={o.style} onChange={(e) => edit(ids, 'astyle', (x) => ({ ...x, style: e.target.value }) as MapObject)}>
              {ARROW_STYLES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ширина">
            <Range value={o.width} min={6} max={Math.round(120 * ks)} onChange={(v) => edit(ids, 'w', (x) => ({ ...x, width: v }))} />
          </Field>
          <Field label="Подпись">
            <input value={o.label} placeholder="напр. 1 мсб" onChange={(e) => edit(ids, 'label', (x) => ({ ...x, label: e.target.value }))} />
          </Field>
        </>
      )}

      {single && o.kind === 'line' && (
        <>
          <Field label="Тип">
            <select value={o.style} onChange={(e) => edit(ids, 'lstyle', (x) => ({ ...x, style: e.target.value }) as MapObject)}>
              {LINE_STYLES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Толщина">
            <Range value={o.width} min={1} max={Math.round(16 * ks)} step={0.5} onChange={(v) => edit(ids, 'w', (x) => ({ ...x, width: v }))} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={o.smooth} onChange={(e) => edit(ids, 'smooth', (x) => ({ ...x, smooth: e.target.checked }))} />
            Сглаживать
          </label>
          <Field label="Подпись">
            <input value={o.label} placeholder="напр. Рубеж «Берёза»" onChange={(e) => edit(ids, 'label', (x) => ({ ...x, label: e.target.value }))} />
          </Field>
        </>
      )}

      {single && o.kind === 'area' && (
        <>
          <Field label="Заливка">
            <select value={o.fill} onChange={(e) => edit(ids, 'fill', (x) => ({ ...x, fill: e.target.value as typeof o.fill }))}>
              {FILL_STYLES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          {o.fill !== 'none' && (
            <Field label="Плотность заливки">
              <Range value={o.fillOpacity} min={0.05} max={1} step={0.05} onChange={(v) => edit(ids, 'fop', (x) => ({ ...x, fillOpacity: v }))} />
            </Field>
          )}
          <Field label="Толщина контура">
            <Range value={o.width} min={1} max={Math.round(16 * ks)} step={0.5} onChange={(v) => edit(ids, 'w', (x) => ({ ...x, width: v }))} />
          </Field>
          <div className="row checks">
            <label className="check">
              <input type="checkbox" checked={o.dashed} onChange={(e) => edit(ids, 'dashed', (x) => ({ ...x, dashed: e.target.checked }))} />
              Пунктир
            </label>
            <label className="check">
              <input type="checkbox" checked={o.smooth} onChange={(e) => edit(ids, 'smooth', (x) => ({ ...x, smooth: e.target.checked }))} />
              Сглаживать
            </label>
          </div>
          <Field label="Подпись">
            <input value={o.label} placeholder="напр. РС 1 мсб" onChange={(e) => edit(ids, 'label', (x) => ({ ...x, label: e.target.value }))} />
          </Field>
        </>
      )}

      {single && o.kind === 'text' && (
        <>
          <Field label="Текст">
            <textarea rows={3} value={o.text} onChange={(e) => edit(ids, 'text', (x) => ({ ...x, text: e.target.value }))} />
          </Field>
          <Field label="Размер шрифта">
            <Range value={o.fontSize} min={8} max={Math.round(160 * ks)} onChange={(v) => edit(ids, 'fs', (x) => ({ ...x, fontSize: v }))} />
          </Field>
          <Field label="Поворот">
            <Range value={o.rotation} min={0} max={359} suffix="°" onChange={(v) => edit(ids, 'rot', (x) => ({ ...x, rotation: v }))} />
          </Field>
          <div className="row checks">
            <label className="check">
              <input type="checkbox" checked={o.bold} onChange={(e) => edit(ids, 'bold', (x) => ({ ...x, bold: e.target.checked }))} />
              Жирный
            </label>
            <label className="check">
              <input type="checkbox" checked={o.halo} onChange={(e) => edit(ids, 'halo', (x) => ({ ...x, halo: e.target.checked }))} />
              Белая обводка
            </label>
          </div>
        </>
      )}

      {single && 'points' in o && <p className="hint">Тяните квадратные точки, чтобы изменить форму. Круглые — добавить точку. Двойной щелчок по точке удаляет её.</p>}

      <div className="row actions">
        <button className="btn" title="Выше" onClick={() => reorder(1)}>
          {Icons.up}
        </button>
        <button className="btn" title="Ниже" onClick={() => reorder(-1)}>
          {Icons.down}
        </button>
        <button className="btn" title="Копия (Ctrl+D)" onClick={duplicate}>
          {Icons.copy}
        </button>
        <button className="btn danger" title="Удалить (Delete)" onClick={() => st().deleteSelection()}>
          {Icons.trash}
        </button>
      </div>
    </>
  );
}
