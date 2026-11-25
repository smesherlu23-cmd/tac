import { useState } from 'react';
import { uid, useStore } from '../store';
import { Icons } from './icons';

export default function Layers() {
  const layers = useStore((s) => s.doc.layers);
  const objects = useStore((s) => s.doc.objects);
  const active = useStore((s) => s.activeLayerId);
  const autoLayer = useStore((s) => s.autoLayer);
  const { change, setActiveLayer, setAutoLayer } = useStore.getState();
  const [renaming, setRenaming] = useState<string | null>(null);

  const upd = (id: string, patch: Partial<(typeof layers)[number]>) =>
    change((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const move = (id: string, dir: 1 | -1) =>
    change((d) => {
      const arr = d.layers.slice();
      const i = arr.findIndex((l) => l.id === id);
      const j = i + dir;
      if (j < 0 || j >= arr.length) return d;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...d, layers: arr };
    });

  const add = () => {
    const id = 'l-' + uid();
    change((d) => ({ ...d, layers: [...d.layers, { id, name: `Слой ${d.layers.length + 1}`, visible: true, locked: false, opacity: 1 }] }));
    setActiveLayer(id);
    setRenaming(id);
  };

  const remove = (id: string) => {
    if (layers.length <= 1) return;
    const n = objects.filter((o) => o.layerId === id).length;
    if (n && !window.confirm(`Удалить слой вместе с объектами (${n})?`)) return;
    change((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id), objects: d.objects.filter((o) => o.layerId !== id) }));
    if (active === id) setActiveLayer(layers.find((l) => l.id !== id)!.id);
  };

  return (
    <>
      <div className="section-title">
        Слои
        <button className="icon-btn" title="Новый слой" onClick={add}>
          {Icons.plus}
        </button>
      </div>
      <div className="layers">
        {[...layers].reverse().map((l) => (
          <div key={l.id} className={'layer' + (l.id === active ? ' active' : '')} onClick={() => setActiveLayer(l.id)}>
            <button className="icon-btn" title={l.visible ? 'Скрыть' : 'Показать'} onClick={(e) => { e.stopPropagation(); upd(l.id, { visible: !l.visible }); }}>
              {l.visible ? Icons.eye : Icons.eyeOff}
            </button>
            <button className={'icon-btn' + (l.locked ? ' on' : '')} title={l.locked ? 'Разблокировать' : 'Заблокировать'} onClick={(e) => { e.stopPropagation(); upd(l.id, { locked: !l.locked }); }}>
              {l.locked ? Icons.lock : Icons.unlock}
            </button>
            {renaming === l.id ? (
              <input
                autoFocus
                className="layer-name-input"
                defaultValue={l.name}
                onBlur={(e) => {
                  upd(l.id, { name: e.target.value || l.name });
                  setRenaming(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            ) : (
              <span className="layer-name" onDoubleClick={() => setRenaming(l.id)} title="Двойной щелчок — переименовать">
                {l.name}
              </span>
            )}
            <span className="count">{objects.filter((o) => o.layerId === l.id).length}</span>
            <div className="layer-actions">
              <button className="icon-btn" title="Выше" onClick={(e) => { e.stopPropagation(); move(l.id, 1); }}>{Icons.up}</button>
              <button className="icon-btn" title="Ниже" onClick={(e) => { e.stopPropagation(); move(l.id, -1); }}>{Icons.down}</button>
              <button className="icon-btn" title="Удалить слой" onClick={(e) => { e.stopPropagation(); remove(l.id); }}>{Icons.trash}</button>
            </div>
          </div>
        ))}
      </div>
      {layers.find((l) => l.id === active) && (
        <label className="field">
          <span>Прозрачность слоя</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={layers.find((l) => l.id === active)!.opacity}
            onChange={(e) => useStore.getState().patch((d) => ({ ...d, layers: d.layers.map((l) => (l.id === active ? { ...l, opacity: Number(e.target.value) } : l)) }))}
          />
        </label>
      )}
      <label className="check">
        <input type="checkbox" checked={autoLayer} onChange={(e) => setAutoLayer(e.target.checked)} />
        Раскладывать по слоям автоматически
      </label>
    </>
  );
}
