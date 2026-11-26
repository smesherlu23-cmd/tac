import { useStore } from '../store';
import { formatDistance } from '../graphics/geometry';
import { Icons } from './icons';
import { requestFit } from '../actions';

const TOOL_HINTS: Record<string, string> = {
  select: 'Щёлкните объект, чтобы выделить. Shift — добавить к выделению. Протяните по пустому месту — рамка.',
  pan: 'Тяните карту мышью.',
  unit: 'Щёлкните по карте, чтобы поставить знак (Shift — поставить несколько подряд). Знак выбирается слева.',
  arrow: 'Щёлкайте точки пути стрелки. Двойной щелчок, правая кнопка или Enter — готово. Backspace — убрать точку.',
  line: 'Щёлкайте точки линии. Двойной щелчок, правая кнопка или Enter — готово. Backspace — убрать точку.',
  area: 'Щёлкайте вершины района. Двойной щелчок, правая кнопка или Enter — замкнуть. Backspace — убрать точку.',
  text: 'Щёлкните, где нужна надпись, и наберите текст.',
  measure: 'Тяните, чтобы измерить расстояние.',
  calibrate: 'Отметьте две точки с известным расстоянием (например, концы масштабной линейки карты).',
};

export default function StatusBar() {
  const cursor = useStore((s) => s.cursor);
  const view = useStore((s) => s.view);
  const tool = useStore((s) => s.tool);
  const mpp = useStore((s) => s.doc.metersPerPx);
  const count = useStore((s) => s.doc.objects.length);
  const toast = useStore((s) => s.toast);
  const setView = useStore((s) => s.setView);

  const zoomBy = (k: number) => {
    const el = document.querySelector('svg.canvas') as SVGSVGElement | null;
    const w = el?.clientWidth ?? 800;
    const h = el?.clientHeight ?? 600;
    const zoom = Math.min(20, Math.max(0.05, view.zoom * k));
    const kk = zoom / view.zoom;
    setView({ zoom, x: w / 2 - (w / 2 - view.x) * kk, y: h / 2 - (h / 2 - view.y) * kk });
  };

  return (
    <div className="statusbar">
      <span className="hint-text">{toast ?? TOOL_HINTS[tool]}</span>
      <span className="spacer" />
      {cursor && (
        <span>
          X {Math.round(cursor.x)} · Y {Math.round(cursor.y)}
          {mpp ? ` (${formatDistance(cursor.x * mpp)}, ${formatDistance(cursor.y * mpp)})` : ''}
        </span>
      )}
      <span>{mpp ? `100 пикс. = ${formatDistance(mpp * 100)}` : 'масштаб не задан'}</span>
      <span>объектов: {count}</span>
      <span className="zoom">
        <button onClick={() => zoomBy(1 / 1.25)} title="Отдалить">{Icons.zoomOut}</button>
        <span>{Math.round(view.zoom * 100)}%</span>
        <button onClick={() => zoomBy(1.25)} title="Приблизить">{Icons.zoomIn}</button>
        <button onClick={requestFit} title="Показать всю карту (Ctrl+0)">{Icons.fit}</button>
      </span>
    </div>
  );
}
