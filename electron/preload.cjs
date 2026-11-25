const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tactic', {
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (json, filePath) => ipcRenderer.invoke('project:save', json, filePath),
  openImage: () => ipcRenderer.invoke('image:open'),
  saveExport: (data, ext, encoding) => ipcRenderer.invoke('export:save', data, ext, encoding),
  exportPdf: (svg, width, height) => ipcRenderer.invoke('export:pdf', svg, width, height),
  onMenu: (cb) => {
    const handler = (_e, cmd) => cb(cmd);
    ipcRenderer.on('menu', handler);
    return () => ipcRenderer.removeListener('menu', handler);
  },
  setTitle: (title) => ipcRenderer.send('window:title', title),
});
