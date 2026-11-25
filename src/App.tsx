import { useEffect } from 'react';
import Toolbar from './components/Toolbar';
import Palette from './components/Palette';
import Canvas from './components/Canvas';
import Properties from './components/Properties';
import Layers from './components/Layers';
import StatusBar from './components/StatusBar';
import { useStore } from './store';
import { api, exportPdf, exportPng, exportSvg, newDoc, openMap, openMapFile, openProject, openProjectFile, requestFit, saveProject } from './actions';
import { loadAutosave, saveAutosave } from './autosave';

function runCommand(cmd: string) {
  const st = useStore.getState();
  switch (cmd) {
    case 'new': return newDoc();
    case 'open': return openProject();
    case 'openMap': return openMap();
    case 'save': return saveProject();
    case 'saveAs': return saveProject(true);
    case 'exportPng': return exportPng(2);
    case 'exportSvg': return exportSvg();
    case 'exportPdf': return exportPdf();
    case 'undo': return st.undo();
    case 'redo': return st.redo();
    case 'fit': return requestFit();
  }
}

export default function App() {
  const title = useStore((s) => s.doc.title);
  const dirty = useStore((s) => s.dirty);

  useEffect(() => {
    const t = `${dirty ? '• ' : ''}${title || 'Без названия'} — Tactic`;
    document.title = t;
    api?.setTitle(t);
  }, [title, dirty]);

  // menu commands (Electron) or keyboard shortcuts (browser)
  useEffect(() => {
    if (api) return api.onMenu(runCommand);
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const m: Record<string, string> = { KeyS: e.shiftKey ? 'saveAs' : 'save', KeyO: 'open', KeyM: 'openMap', KeyE: 'exportPng', Digit0: 'fit' };
      if (m[e.code]) {
        e.preventDefault();
        runCommand(m[e.code]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // restore last session, then autosave
  useEffect(() => {
    let alive = true;
    loadAutosave().then((r) => {
      if (!alive || !r?.doc || (!r.doc.map && !r.doc.objects.length)) return;
      useStore.getState().loadDoc(r.doc, r.filePath);
      useStore.getState().showToast('Восстановлена последняя сессия');
      requestFit();
    });
    let last = useStore.getState().doc;
    const timer = setInterval(() => {
      const st = useStore.getState();
      if (st.doc !== last) {
        last = st.doc;
        saveAutosave(st.doc, st.filePath).catch(() => {});
      }
    }, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // drop image or .tmap files anywhere
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      e.preventDefault();
      if (f.name.toLowerCase().endsWith('.tmap')) openProjectFile(f);
      else if (f.type.startsWith('image/')) openMapFile(f);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <div className="main">
        <Palette />
        <Canvas />
        <aside className="panel right">
          <section>
            <Properties />
          </section>
          <section>
            <Layers />
          </section>
        </aside>
      </div>
      <StatusBar />
    </div>
  );
}
