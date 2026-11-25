import type { Pt } from '../types';

export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

/** Centripetal-ish Catmull-Rom sampled into a dense polyline. */
export function smoothPath(pts: Pt[], closed = false, steps = 12): Pt[] {
  if (pts.length < 3) return pts.slice();
  const n = pts.length;
  const get = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out: Pt[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

export function polylineLength(p: Pt[]): number {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += dist(p[i - 1], p[i]);
  return l;
}

export function toPathD(p: Pt[], closed = false): string {
  if (!p.length) return '';
  const r = (v: number) => Math.round(v * 10) / 10;
  return 'M' + p.map((q) => `${r(q.x)},${r(q.y)}`).join(' L') + (closed ? ' Z' : '');
}

/** Points along a polyline every `step` px, with tangent angle. */
export function samplesAlong(p: Pt[], step: number, offset = step / 2): { x: number; y: number; a: number }[] {
  const res: { x: number; y: number; a: number }[] = [];
  if (p.length < 2 || step <= 0) return res;
  let next = offset;
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1];
    const b = p[i];
    const len = dist(a, b);
    if (len === 0) continue;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    while (next <= acc + len) {
      const t = (next - acc) / len;
      res.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: ang });
      next += step;
      if (res.length > 4000) return res;
    }
    acc += len;
  }
  return res;
}

/** Cut a polyline at length L from its start; returns the part before. */
export function trimEnd(p: Pt[], cut: number): Pt[] {
  const total = polylineLength(p);
  const target = Math.max(0, total - cut);
  const out: Pt[] = [p[0]];
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const len = dist(p[i - 1], p[i]);
    if (acc + len >= target) {
      const t = len ? (target - acc) / len : 0;
      out.push({ x: p[i - 1].x + (p[i].x - p[i - 1].x) * t, y: p[i - 1].y + (p[i].y - p[i - 1].y) * t });
      return out;
    }
    out.push(p[i]);
    acc += len;
  }
  return out;
}

function normals(p: Pt[]): Pt[] {
  return p.map((_, i) => {
    const a = p[Math.max(0, i - 1)];
    const b = p[Math.min(p.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  });
}

/**
 * Outline of a wide tactical arrow (main attack) following the path.
 * The body tapers slightly from tail to the head.
 */
export function wideArrowOutline(raw: Pt[], width: number, smooth = true): Pt[] {
  const p0 = smooth ? smoothPath(raw) : raw;
  if (p0.length < 2) return [];
  const headLen = width * 1.6;
  const headHalf = width * 1.05;
  const total = polylineLength(p0);
  if (total < headLen * 1.2) return [];
  const body = trimEnd(p0, headLen);
  const ns = normals(body);
  const left: Pt[] = [];
  const right: Pt[] = [];
  let acc = 0;
  const bodyLen = polylineLength(body);
  body.forEach((q, i) => {
    if (i > 0) acc += dist(body[i - 1], q);
    const t = bodyLen ? acc / bodyLen : 0;
    const half = (width / 2) * (0.75 + 0.25 * t);
    left.push({ x: q.x + ns[i].x * half, y: q.y + ns[i].y * half });
    right.push({ x: q.x - ns[i].x * half, y: q.y - ns[i].y * half });
  });
  const end = body[body.length - 1];
  const tip = p0[p0.length - 1];
  const dx = tip.x - end.x;
  const dy = tip.y - end.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  const headL = { x: end.x + nx * headHalf, y: end.y + ny * headHalf };
  const headR = { x: end.x - nx * headHalf, y: end.y - ny * headHalf };
  // tail notch (swallow tail)
  const start = body[0];
  const s1 = body[Math.min(1, body.length - 1)];
  const sl = Math.hypot(s1.x - start.x, s1.y - start.y) || 1;
  const notch = { x: start.x + ((s1.x - start.x) / sl) * width * 0.35, y: start.y + ((s1.y - start.y) / sl) * width * 0.35 };
  return [...left, headL, tip, headR, ...right.reverse(), notch];
}

/** Simple arrow head (triangle) at the end of a polyline. */
export function arrowHead(p: Pt[], size: number, open = false): Pt[] {
  if (p.length < 2) return [];
  const tip = p[p.length - 1];
  let k = p.length - 2;
  while (k > 0 && dist(p[k], tip) < size * 0.5) k--;
  const prev = p[k];
  const ang = Math.atan2(tip.y - prev.y, tip.x - prev.x);
  const a1 = ang + Math.PI - 0.42;
  const a2 = ang + Math.PI + 0.42;
  const l = open ? size * 1.1 : size;
  return [
    { x: tip.x + Math.cos(a1) * l, y: tip.y + Math.sin(a1) * l },
    tip,
    { x: tip.x + Math.cos(a2) * l, y: tip.y + Math.sin(a2) * l },
  ];
}

export function centroid(p: Pt[]): Pt {
  if (!p.length) return { x: 0, y: 0 };
  const s = p.reduce((a, q) => ({ x: a.x + q.x, y: a.y + q.y }), { x: 0, y: 0 });
  return { x: s.x / p.length, y: s.y / p.length };
}

export function midpointAlong(p: Pt[]): { x: number; y: number; a: number } {
  const total = polylineLength(p);
  const s = samplesAlong(p, total + 1, total / 2);
  return s[0] ?? { x: p[0]?.x ?? 0, y: p[0]?.y ?? 0, a: 0 };
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)} км`;
  return `${Math.round(m)} м`;
}
