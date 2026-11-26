import { useMemo, useState, type ReactElement } from 'react';
import { useStore } from '../store';
import type { ArrowStyle, FillStyle, LineStyle, Side } from '../types';
import { CATEGORY_NAMES, SYMBOLS, type Category } from '../symbols/catalog';
import { ECHELONS, SIDE_NAMES, renderSymbol, sideColor, svgDataUrl } from '../symbols/render';

export const ARROW_STYLES: { id: ArrowStyle; name: string }[] = [
  { id: 'main', name: 'Главный удар' },
  { id: 'support', name: 'Вспомогательный удар / направление' },
  { id: 'counter', name: 'Контратака / контрудар' },
  { id: 'withdraw', name: 'Отход' },
  { id: 'fire', name: 'Направление огня' },
];

export const LINE_STYLES: { id: LineStyle; name: string }[] = [
  { id: 'front', name: 'Передний край / ЛБС' },
  { id: 'solid', name: 'Сплошная' },
  { id: 'dashed', name: 'Пунктир (планируемая)' },
  { id: 'boundary', name: 'Разграничительная линия' },
  { id: 'trench', name: 'Траншея / окоп' },
  { id: 'antitank', name: 'Противотанковый ров' },
  { id: 'wire', name: 'Проволочное заграждение' },
  { id: 'mines', name: 'Минное поле (линия мин)' },
];

export const FILL_STYLES: { id: FillStyle; name: string }[] = [
  { id: 'hatch', name: 'Штриховка' },
  { id: 'cross', name: 'Сетка' },
  { id: 'solid', name: 'Заливка' },
  { id: 'none', name: 'Только контур' },
];

const SIDES: Side[] = ['own', 'enemy', 'neutral', 'unknown'];

function ArrowPreview({ style, color }: { style: ArrowStyle; color: string }) {
  const wide = style === 'main' || style === 'counter';
  return (
    <svg viewBox="0 0 60 24" width="60" height="24">
      {wide ? (
        <path
          d="M4,9 L40,7 L40,2 L56,12 L40,22 L40,17 L4,15 L8,12 Z"
          fill={color}
          fillOpacity={style === 'main' ? 0.3 : 0.12}
          stroke={color}
          strokeWidth="1.6"
          strokeDasharray={style === 'counter' ? '4 2.5' : undefined}
        />
      ) : (
        <>
          <path d="M4,12 L48,12" stroke={color} strokeWidth="2.2" strokeDasharray={style === 'withdraw' ? '5 3' : style === 'fire' ? '1 3' : undefined} strokeLinecap="round" />
          {style === 'withdraw' ? (
            <path d="M46,6 L56,12 L46,18" fill="none" stroke={color} strokeWidth="2.2" />
          ) : (
            <path d="M46,6 L56,12 L46,18 Z" fill={color} />
          )}
        </>
      )}
    </svg>
  );
}

function LinePreview({ style, color }: { style: LineStyle; color: string }) {
  const base = <path d="M4,14 L56,14" stroke={color} strokeWidth="2" strokeDasharray={style === 'dashed' ? '6 4' : style === 'boundary' ? '10 3 1 3 1 3' : undefined} />;
  const deco: Record<string, ReactElement> = {
    front: <path d="M10,14 a4,4 0 0 1 8,0 M24,14 a4,4 0 0 1 8,0 M38,14 a4,4 0 0 1 8,0" fill={color} />,
    trench: <path d="M8,14 v-6 h6 v6 M20,14 v-6 h6 v6 M32,14 v-6 h6 v6 M44,14 v-6 h6 v6" fill="none" stroke={color} strokeWidth="2" />,
    antitank: <path d="M8,14 L12,7 L16,14 Z M22,14 L26,7 L30,14 Z M36,14 L40,7 L44,14 Z" fill={color} />,
    wire: <path d="M10,10 l6,8 M16,10 l-6,8 M26,10 l6,8 M32,10 l-6,8 M42,10 l6,8 M48,10 l-6,8" stroke={color} strokeWidth="1.8" />,
    mines: <g fill={color}>{[10, 22, 34, 46].map((x) => <circle key={x} cx={x} cy={14} r={3.5} />)}</g>,
  };
  return (
    <svg viewBox="0 0 60 24" width="60" height="24">
      {style !== 'mines' && base}
      {deco[style]}
    </svg>
  );
}

function FillPreview({ fill, color }: { fill: FillStyle; color: string }) {
  const id = `pv-${fill}`;
  return (
    <svg viewBox="0 0 60 24" width="60" height="24">
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke={color} strokeWidth="1.3" />
          {fill === 'cross' && <line x1="0" y1="2.5" x2="5" y2="2.5" stroke={color} strokeWidth="1.3" />}
        </pattern>
      </defs>
      <path
        d="M8,18 C4,8 18,3 30,5 C46,3 58,9 52,17 C44,23 16,23 8,18 Z"
        fill={fill === 'none' ? 'none' : fill === 'solid' ? color : `url(#${id})`}
        fillOpacity={fill === 'solid' ? 0.25 : 1}
        stroke={color}
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function Palette() {
  const defaults = useStore((s) => s.defaults);
  const setDefaults = useStore((s) => s.setDefaults);
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const standard = useStore((s) => s.doc.standard);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const color = sideColor(standard, defaults.side);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = SYMBOLS.filter((s) => !q || s.name.toLowerCase().includes(q) || (s.keywords ?? '').includes(q));
    const by = new Map<Category, typeof list>();
    for (const s of list) {
      if (!by.has(s.category)) by.set(s.category, []);
      by.get(s.category)!.push(s);
    }
    return [...by.entries()];
  }, [query]);

  return (
    <aside className="panel left">
      <section>
        <div className="section-title">Сторона</div>
        <div className="sides">
          {SIDES.map((s) => (
            <button
              key={s}
              className={defaults.side === s ? 'active' : ''}
              style={{ ['--side' as string]: sideColor(standard, s) }}
              onClick={() => setDefaults({ side: s })}
            >
              <i />
              {SIDE_NAMES[s]}
            </button>
          ))}
        </div>
        <div className="row">
          <label className="grow">
            <span>Звено</span>
            <select value={defaults.echelon} onChange={(e) => setDefaults({ echelon: e.target.value as typeof defaults.echelon })}>
              {ECHELONS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.mark ? `${e.mark}  ` : ''}
                  {e.ru}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row checks">
          <label className="check">
            <input type="checkbox" checked={defaults.planned} onChange={(e) => setDefaults({ planned: e.target.checked })} />
            Планируемое
          </label>
          <label className="check">
            <input type="checkbox" checked={defaults.hq} onChange={(e) => setDefaults({ hq: e.target.checked })} />
            Штаб
          </label>
        </div>
      </section>

      <section className="symbols">
        <div className="section-title">
          Условные знаки <span className="muted">{standard === 'ru' ? 'РФ' : 'НАТО APP-6'}</span>
        </div>
        <input className="search" placeholder="Поиск: танки, птур, кп…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {groups.map(([cat, list]) => (
          <div key={cat} className="cat">
            <button className="cat-title" onClick={() => setCollapsed({ ...collapsed, [cat]: !collapsed[cat] })}>
              <span className={collapsed[cat] ? 'chev closed' : 'chev'}>▾</span>
              {CATEGORY_NAMES[cat]}
            </button>
            {!collapsed[cat] && (
              <div className="grid">
                {list.map((s) => {
                  const r = renderSymbol(s.id, { standard, side: defaults.side, echelon: 'none', planned: defaults.planned, hq: false, size: 40 });
                  const active = tool === 'unit' && defaults.symbol === s.id;
                  return (
                    <button
                      key={s.id}
                      className={'sym' + (active ? ' active' : '')}
                      title={`${s.name} — щёлкните и ставьте на карту, или перетащите`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-tactic-symbol', s.id);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => {
                        setDefaults({ symbol: s.id });
                        setTool('unit');
                      }}
                    >
                      <img src={svgDataUrl(r.svg)} alt="" draggable={false} />
                      <span>{s.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </section>

      <section>
        <div className="section-title">Стрелки</div>
        <div className="styles">
          {ARROW_STYLES.map((a) => (
            <button
              key={a.id}
              className={tool === 'arrow' && defaults.arrowStyle === a.id ? 'active' : ''}
              onClick={() => {
                setDefaults({ arrowStyle: a.id });
                setTool('arrow');
              }}
            >
              <ArrowPreview style={a.id} color={color} />
              <span>{a.name}</span>
            </button>
          ))}
        </div>
        <div className="section-title">Линии и рубежи</div>
        <div className="styles">
          {LINE_STYLES.map((l) => (
            <button
              key={l.id}
              className={tool === 'line' && defaults.lineStyle === l.id ? 'active' : ''}
              onClick={() => {
                setDefaults({ lineStyle: l.id });
                setTool('line');
              }}
            >
              <LinePreview style={l.id} color={color} />
              <span>{l.name}</span>
            </button>
          ))}
        </div>
        <div className="section-title">Районы</div>
        <div className="styles">
          {FILL_STYLES.map((f) => (
            <button
              key={f.id}
              className={tool === 'area' && defaults.areaFill === f.id ? 'active' : ''}
              onClick={() => {
                setDefaults({ areaFill: f.id });
                setTool('area');
              }}
            >
              <FillPreview fill={f.id} color={color} />
              <span>{f.name}</span>
            </button>
          ))}
        </div>
        <p className="hint">Стрелки, линии и районы: щёлкайте по точкам, двойной щелчок, правая кнопка или Enter завершает, Esc отменяет. После размещения включается выделение; Shift — рисовать/ставить подряд.</p>
      </section>
    </aside>
  );
}
