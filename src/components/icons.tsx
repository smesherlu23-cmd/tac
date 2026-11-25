import type { ReactNode } from 'react';

const I = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const Icons = {
  select: <I><path d="M5 3l14 8-6 1.5L10 19z" /></I>,
  pan: <I><path d="M8 13V5.5a1.5 1.5 0 013 0V12m0-6.5v-1a1.5 1.5 0 013 0V12m0-5.5a1.5 1.5 0 013 0V14a7 7 0 01-7 7h-1a6 6 0 01-5-2.7L4.6 15a1.6 1.6 0 012.6-1.8L8 14" /></I>,
  unit: <I><rect x="3" y="7" width="18" height="11" rx="1" /><path d="M3 7l18 11M21 7L3 18" /></I>,
  arrow: <I><path d="M3 18c4-1 8-5 11-10M10 7l5-0.5L15.5 12" /><path d="M14 7l3-4" opacity="0" /></I>,
  line: <I><path d="M3 17c3-6 6 2 9-4s6-2 9-6" /></I>,
  area: <I><path d="M5 6l9-2 6 6-3 9-11-2z" /></I>,
  text: <I><path d="M5 6V4h14v2M12 4v16M9 20h6" /></I>,
  measure: <I><path d="M3 17L17 3l4 4L7 21z" /><path d="M7 13l2 2M10 10l2 2M13 7l2 2" /></I>,
  calibrate: <I><circle cx="5" cy="18" r="2" /><circle cx="19" cy="6" r="2" /><path d="M6.5 16.5l11-9" strokeDasharray="2 2" /></I>,
  undo: <I><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></I>,
  redo: <I><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 000 12h3" /></I>,
  newDoc: <I><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></I>,
  open: <I><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></I>,
  save: <I><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3M8 21v-7h8v7" /></I>,
  map: <I><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></I>,
  exportIcon: <I><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 15v5h14v-5" /></I>,
  eye: <I><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></I>,
  eyeOff: <I><path d="M3 3l18 18M10.6 5.1A10 10 0 0122 12s-1.2 2.1-3.3 4M6.6 6.6C4 8.3 2 12 2 12s4 7 10 7c1.9 0 3.5-.6 4.9-1.4" /></I>,
  lock: <I><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></I>,
  unlock: <I><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 017.5-2" /></I>,
  plus: <I><path d="M12 5v14M5 12h14" /></I>,
  trash: <I><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" /></I>,
  up: <I><path d="M6 15l6-6 6 6" /></I>,
  down: <I><path d="M6 9l6 6 6-6" /></I>,
  fit: <I><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></I>,
  zoomIn: <I><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4M8 11h6M11 8v6" /></I>,
  zoomOut: <I><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4M8 11h6" /></I>,
  copy: <I><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M16 8V4H4v12h4" /></I>,
};
