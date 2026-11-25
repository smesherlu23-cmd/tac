import type { ReactNode } from 'react';
import type { AreaObj, ArrowObj, Doc, FillStyle, LineObj, MapObject, Standard, TextObj, UnitObj } from '../types';
import { renderSymbol, sideColor, svgDataUrl } from '../symbols/render';
import {
  arrowHead,
  centroid,
  midpointAlong,
  polylineLength,
  samplesAlong,
  smoothPath,
  toPathD,
  trimEnd,
  wideArrowOutline,
} from '../graphics/geometry';

const FONT = 'Arial, Helvetica, sans-serif';
const HALO = 'rgba(255,255,255,0.9)';

export function objColor(o: MapObject, standard: Standard) {
  return sideColor(standard, o.side, o.color);
}

function patternId(fill: FillStyle, color: string) {
  return `p-${fill}-${color.replace(/[^a-z0-9]/gi, '')}`;
}

function Patterns({ objects, standard }: { objects: MapObject[]; standard: Standard }) {
  const seen = new Map<string, { fill: FillStyle; color: string }>();
  for (const o of objects) {
    if (o.kind === 'area' && (o.fill === 'hatch' || o.fill === 'cross')) {
      const c = objColor(o, standard);
      seen.set(patternId(o.fill, c), { fill: o.fill, color: c });
    }
  }
  return (
    <defs>
      {[...seen.entries()].map(([id, { fill, color }]) => (
        <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="12" stroke={color} strokeWidth="2" />
          {fill === 'cross' && <line x1="0" y1="6" x2="12" y2="6" stroke={color} strokeWidth="2" />}
        </pattern>
      ))}
      <filter id="f-gray">
        <feColorMatrix type="saturate" values="0.15" />
      </filter>
    </defs>
  );
}

/** Text that stays readable along a path: flips when upside down. */
function PathLabel({ x, y, a, text, color, size, dy = 0 }: { x: number; y: number; a: number; text: string; color: string; size: number; dy?: number }) {
  if (!text) return null;
  let deg = (a * 180) / Math.PI;
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return (
    <text
      x={x}
      y={y}
      transform={`rotate(${deg} ${x} ${y}) translate(0 ${dy})`}
      fill={color}
      stroke={HALO}
      strokeWidth={size / 4}
      paintOrder="stroke"
      fontFamily={FONT}
      fontWeight={700}
      fontSize={size}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {text}
    </text>
  );
}

function UnitView({ o, standard }: { o: UnitObj; standard: Standard }) {
  const r = renderSymbol(o.symbol, { standard, side: o.side, echelon: o.echelon, planned: o.planned, hq: o.hq, size: o.size, color: o.color });
  const c = objColor(o, standard);
  const left = o.x - r.ax;
  const top = o.y - r.ay;
  const fs = Math.max(10, o.size * 0.3);
  const labelX = left + r.w + 4;
  const midY = o.hq ? top + r.h * 0.3 : o.y;
  return (
    <g transform={o.rotation ? `rotate(${o.rotation} ${o.x} ${o.y})` : undefined}>
      <image href={svgDataUrl(r.svg)} x={left} y={top} width={r.w} height={r.h} />
      {o.label && (
        <text x={labelX} y={midY} fill={c} stroke={HALO} strokeWidth={fs / 4} paintOrder="stroke" fontFamily={FONT} fontWeight={700} fontSize={fs} dominantBaseline="central">
          {o.label}
        </text>
      )}
      {o.note && (
        <text x={o.x} y={top + r.h + fs * 0.9} fill={c} stroke={HALO} strokeWidth={fs / 4} paintOrder="stroke" fontFamily={FONT} fontSize={fs * 0.85} textAnchor="middle" dominantBaseline="central">
          {o.note}
        </text>
      )}
    </g>
  );
}

function ArrowView({ o, standard }: { o: ArrowObj; standard: Standard }) {
  const c = objColor(o, standard);
  if (o.points.length < 2) return null;
  const path = smoothPath(o.points);
  const w = o.width;
  const mid = midpointAlong(path);
  const label = <PathLabel x={mid.x} y={mid.y} a={mid.a} text={o.label} color={c} size={Math.max(12, w * 0.6)} dy={o.style === 'main' || o.style === 'counter' ? 0 : -w * 0.7} />;
  if (o.style === 'main' || o.style === 'counter') {
    const outline = wideArrowOutline(o.points, w);
    if (!outline.length) return null;
    return (
      <g>
        <path d={toPathD(outline, true)} fill="none" stroke={HALO} strokeWidth={6} strokeLinejoin="round" />
        <path
          d={toPathD(outline, true)}
          fill={c}
          fillOpacity={o.style === 'main' ? 0.28 : 0.12}
          stroke={c}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeDasharray={o.style === 'counter' ? '12 7' : undefined}
        />
        {label}
      </g>
    );
  }
  const sw = Math.max(2, w / 6);
  const headSize = Math.max(12, w * 0.55);
  const body = trimEnd(path, headSize * 0.5);
  const head = arrowHead(path, headSize, o.style === 'withdraw');
  const dash = o.style === 'withdraw' ? `${sw * 4} ${sw * 2.5}` : o.style === 'fire' ? `${sw * 0.5} ${sw * 2}` : undefined;
  return (
    <g>
      <path d={toPathD(body)} fill="none" stroke={HALO} strokeWidth={sw + 4} strokeLinecap="round" strokeLinejoin="round" />
      <path d={toPathD(body)} fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
      {o.style === 'withdraw' ? (
        <path d={toPathD(head)} fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d={toPathD(head, true)} fill={c} stroke={HALO} strokeWidth={1.5} strokeLinejoin="round" />
      )}
      {o.style === 'fire' && head.length === 3 && (
        <circle cx={o.points[0].x} cy={o.points[0].y} r={sw * 1.6} fill={c} />
      )}
      {label}
    </g>
  );
}

function lineDecorations(o: LineObj, path: { x: number; y: number }[], c: string, sw: number): ReactNode {
  const s = sw;
  switch (o.style) {
    case 'front': {
      // semicircles on the enemy-facing (left) side
      const r = s * 2.2;
      const smp = samplesAlong(path, r * 3.2);
      const d = smp
        .map(({ x, y, a }) => {
          const ax = Math.cos(a);
          const ay = Math.sin(a);
          const x1 = x - ax * r;
          const y1 = y - ay * r;
          const x2 = x + ax * r;
          const y2 = y + ay * r;
          return `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`;
        })
        .join(' ');
      return <path d={d} fill={c} stroke={c} strokeWidth={1} />;
    }
    case 'trench': {
      const t = s * 2.5;
      const smp = samplesAlong(path, t * 2, t);
      const d = smp
        .map(({ x, y, a }) => {
          const nx = Math.sin(a);
          const ny = -Math.cos(a);
          const ax = Math.cos(a) * (t / 2);
          const ay = Math.sin(a) * (t / 2);
          return `M${x - ax},${y - ay} l${nx * t},${ny * t} l${ax * 2},${ay * 2} l${-nx * t},${-ny * t}`;
        })
        .join(' ');
      return <path d={d} fill="none" stroke={c} strokeWidth={s} strokeLinejoin="miter" />;
    }
    case 'antitank': {
      const t = s * 3;
      const smp = samplesAlong(path, t * 1.6, t);
      const d = smp
        .map(({ x, y, a }) => {
          const nx = Math.sin(a);
          const ny = -Math.cos(a);
          const ax = Math.cos(a) * (t / 2);
          const ay = Math.sin(a) * (t / 2);
          return `M${x - ax},${y - ay} L${x + nx * t},${y + ny * t} L${x + ax},${y + ay} Z`;
        })
        .join(' ');
      return <path d={d} fill={c} stroke={c} strokeWidth={1} />;
    }
    case 'wire': {
      const t = s * 2.4;
      const smp = samplesAlong(path, t * 2.6);
      const d = smp.map(({ x, y }) => `M${x - t},${y - t} L${x + t},${y + t} M${x + t},${y - t} L${x - t},${y + t}`).join(' ');
      return <path d={d} fill="none" stroke={c} strokeWidth={s * 0.8} strokeLinecap="round" />;
    }
    case 'mines': {
      const r = s * 1.8;
      const smp = samplesAlong(path, r * 4);
      return (
        <g>
          {smp.map(({ x, y }, i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={c} stroke={HALO} strokeWidth={1} />
          ))}
        </g>
      );
    }
    default:
      return null;
  }
}

function LineView({ o, standard }: { o: LineObj; standard: Standard }) {
  const c = objColor(o, standard);
  if (o.points.length < 2) return null;
  const path = o.smooth ? smoothPath(o.points) : o.points;
  const sw = o.width;
  const showBase = o.style !== 'mines';
  const dash =
    o.style === 'dashed'
      ? `${sw * 4} ${sw * 2.5}`
      : o.style === 'boundary'
        ? `${sw * 8} ${sw * 2} ${sw * 0.1} ${sw * 2} ${sw * 0.1} ${sw * 2}`
        : o.style === 'mines'
          ? `${sw * 0.1} ${sw * 100}`
          : undefined;
  const mid = midpointAlong(path);
  const d = toPathD(path);
  return (
    <g>
      {showBase && <path d={d} fill="none" stroke={HALO} strokeWidth={sw + 4} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />}
      {showBase && <path d={d} fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />}
      {lineDecorations(o, path, c, sw)}
      <PathLabel x={mid.x} y={mid.y} a={mid.a} text={o.label} color={c} size={Math.max(12, sw * 4)} dy={-sw * 3.5} />
    </g>
  );
}

function AreaView({ o, standard }: { o: AreaObj; standard: Standard }) {
  const c = objColor(o, standard);
  if (o.points.length < 3) return null;
  const path = o.smooth ? smoothPath(o.points, true) : o.points;
  const d = toPathD(path, true);
  const fill = o.fill === 'none' ? 'none' : o.fill === 'solid' ? c : `url(#${patternId(o.fill, c)})`;
  const ct = centroid(path);
  const fs = Math.max(13, o.width * 5);
  return (
    <g>
      <path d={d} fill="none" stroke={HALO} strokeWidth={o.width + 4} strokeLinejoin="round" opacity={0.8} />
      <path
        d={d}
        fill={fill}
        fillOpacity={o.fill === 'none' ? undefined : o.fillOpacity}
        stroke={c}
        strokeWidth={o.width}
        strokeLinejoin="round"
        strokeDasharray={o.dashed ? `${o.width * 4} ${o.width * 2.5}` : undefined}
      />
      {o.label && (
        <text x={ct.x} y={ct.y} fill={c} stroke={HALO} strokeWidth={fs / 4} paintOrder="stroke" fontFamily={FONT} fontWeight={700} fontSize={fs} textAnchor="middle" dominantBaseline="central">
          {o.label}
        </text>
      )}
    </g>
  );
}

function TextView({ o, standard }: { o: TextObj; standard: Standard }) {
  const c = objColor(o, standard);
  const lines = o.text.split('\n');
  return (
    <text
      x={o.x}
      y={o.y}
      transform={o.rotation ? `rotate(${o.rotation} ${o.x} ${o.y})` : undefined}
      fill={c}
      stroke={o.halo ? HALO : undefined}
      strokeWidth={o.halo ? o.fontSize / 4 : undefined}
      paintOrder="stroke"
      fontFamily={FONT}
      fontWeight={o.bold ? 700 : 400}
      fontSize={o.fontSize}
      textAnchor="middle"
    >
      {lines.map((l, i) => (
        <tspan key={i} x={o.x} dy={i === 0 ? `${0.35 - (lines.length - 1) * 0.6}em` : '1.2em'}>
          {l || ' '}
        </tspan>
      ))}
    </text>
  );
}

export function ObjectView({ o, standard }: { o: MapObject; standard: Standard }) {
  switch (o.kind) {
    case 'unit':
      return <UnitView o={o} standard={standard} />;
    case 'arrow':
      return <ArrowView o={o} standard={standard} />;
    case 'line':
      return <LineView o={o} standard={standard} />;
    case 'area':
      return <AreaView o={o} standard={standard} />;
    case 'text':
      return <TextView o={o} standard={standard} />;
  }
}

/** Invisible wide stroke so thin lines are easy to click. */
function HitPath({ o, width }: { o: MapObject; width: number }) {
  if (o.kind !== 'line' && o.kind !== 'arrow' && o.kind !== 'area') return null;
  const smooth = o.kind === 'arrow' || o.smooth;
  const closed = o.kind === 'area';
  const p = smooth ? smoothPath(o.points, closed) : o.points;
  return (
    <path
      d={toPathD(p, closed)}
      fill={closed ? 'transparent' : 'none'}
      stroke="transparent"
      strokeWidth={Math.max(width, o.kind === 'arrow' ? o.width : 0)}
      style={{ pointerEvents: closed ? 'all' : 'stroke' }}
    />
  );
}

/** Whole map in world coordinates. Used both on screen and for export. */
export function MapContent({ doc, interactive, hitWidth = 14 }: { doc: Doc; interactive?: boolean; hitWidth?: number }) {
  return (
    <>
      <Patterns objects={doc.objects} standard={doc.standard} />
      {doc.map && (
        <image
          href={doc.map.dataUrl}
          x={0}
          y={0}
          width={doc.map.width}
          height={doc.map.height}
          opacity={doc.map.opacity}
          filter={doc.map.grayscale ? 'url(#f-gray)' : undefined}
          preserveAspectRatio="none"
        />
      )}
      {doc.layers.map((l) =>
        l.visible ? (
          <g key={l.id} opacity={l.opacity}>
            {doc.objects
              .filter((o) => o.layerId === l.id)
              .map((o) =>
                interactive ? (
                  <g key={o.id} data-id={l.locked ? undefined : o.id} style={l.locked ? { pointerEvents: 'none' } : undefined}>
                    <ObjectView o={o} standard={doc.standard} />
                    <HitPath o={o} width={hitWidth} />
                  </g>
                ) : (
                  <ObjectView key={o.id} o={o} standard={doc.standard} />
                ),
              )}
          </g>
        ) : null,
      )}
    </>
  );
}

export { polylineLength };
