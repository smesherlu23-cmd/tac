import { useState } from 'react';
import { useStore } from '../store';
import type { Tool } from '../types';
import { Icons } from './icons';
import { exportPdf, exportPng, exportSvg, newDoc, openMap, openProject, saveProject, api } from '../actions';

const TOOLS: { id: Tool; name: string; key: string }[] = [
  { id: 'select', name: 'Выделение', key: 'V' },
  { id: 'pan', name: 'Рука (или пробел)', key: 'H' },
  { id: 'unit', name: 'Условный знак', key: 'U' },
  { id: 'arrow', name: 'Стрелка', key: 'A' },
  { id: 'line', name: 'Линия', key: 'L' },
  { id: 'area', name: 'Район', key: 'R' },
  { id: 'text', name: 'Текст', key: 'T' },
  { id: 'measure', name: 'Линейка', key: 'M' },
  { id: 'calibrate', name: 'Задать масштаб карты', key: '' },
];

export default function Toolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const standard = useStore((s) => s.doc.standard);
  const setStandard = useStore((s) => s.setStandard);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="toolbar">
      <div className="brand">
        <span className="brand-mark">◆</span> Tactic
      </div>
      {!api && (
        <div className="group">
          <button title="Новая карта" onClick={newDoc}>{Icons.newDoc}</button>
          <button title="Открыть проект (.tmap)" onClick={openProject}>{Icons.open}</button>
          <button title="Сохранить проект" onClick={() => saveProject()}>{Icons.save}</button>
        </div>
      )}
      <div className="group">
        <button className="with-label" title="Загрузить карту местности (Ctrl+M)" onClick={openMap}>
          {Icons.map}
          <span>Карта</span>
        </button>
      </div>
      <div className="group tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={tool === t.id ? 'active' : ''}
            title={t.key ? `${t.name} (${t.key})` : t.name}
            onClick={() => setTool(t.id)}
          >
            {Icons[t.id]}
          </button>
        ))}
      </div>
      <div className="group">
        <button title="Отменить (Ctrl+Z)" disabled={!canUndo} onClick={undo}>{Icons.undo}</button>
        <button title="Повторить (Ctrl+Y)" disabled={!canRedo} onClick={redo}>{Icons.redo}</button>
      </div>
      <div className="spacer" />
      <div className="segmented" title="Стандарт условных знаков">
        <button className={standard === 'ru' ? 'active' : ''} onClick={() => standard !== 'ru' && setStandard('ru')}>
          РФ
        </button>
        <button className={standard === 'nato' ? 'active' : ''} onClick={() => standard !== 'nato' && setStandard('nato')}>
          НАТО
        </button>
      </div>
      <div className="group dropdown">
        <button className="with-label primary" onClick={() => setExportOpen((v) => !v)}>
          {Icons.exportIcon}
          <span>Экспорт</span>
        </button>
        {exportOpen && (
          <div className="menu" onMouseLeave={() => setExportOpen(false)}>
            <button onClick={() => { setExportOpen(false); exportPng(2); }}>PNG (2×, для печати)</button>
            <button onClick={() => { setExportOpen(false); exportPng(1); }}>PNG (1×)</button>
            <button onClick={() => { setExportOpen(false); exportSvg(); }}>SVG (вектор)</button>
            <button onClick={() => { setExportOpen(false); exportPdf(); }}>PDF</button>
          </div>
        )}
      </div>
    </div>
  );
}
