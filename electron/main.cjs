const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');

let win;

const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };

function send(cmd) {
  if (win) win.webContents.send('menu', cmd);
}

function buildMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        { label: 'Новый', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: 'Открыть…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { label: 'Загрузить карту…', accelerator: 'CmdOrCtrl+M', click: () => send('openMap') },
        { type: 'separator' },
        { label: 'Сохранить', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: 'Сохранить как…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveAs') },
        { type: 'separator' },
        { label: 'Экспорт PNG…', accelerator: 'CmdOrCtrl+E', click: () => send('exportPng') },
        { label: 'Экспорт SVG…', click: () => send('exportSvg') },
        { label: 'Экспорт PDF…', click: () => send('exportPdf') },
        { type: 'separator' },
        { role: 'quit', label: 'Выход' },
      ],
    },
    {
      label: 'Правка',
      submenu: [
        { label: 'Отменить', accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
        { label: 'Повторить', accelerator: 'CmdOrCtrl+Y', click: () => send('redo') },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { label: 'Показать всю карту', accelerator: 'CmdOrCtrl+0', click: () => send('fit') },
        { role: 'togglefullscreen', label: 'Полный экран' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#1d2126',
    title: 'Tactic',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('project:open', async () => {
  const r = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Тактическая карта', extensions: ['tmap'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const filePath = r.filePaths[0];
  return { filePath, json: await fs.readFile(filePath, 'utf8') };
});

ipcMain.handle('project:save', async (_e, json, filePath) => {
  let target = filePath;
  if (!target) {
    const r = await dialog.showSaveDialog(win, {
      defaultPath: 'карта.tmap',
      filters: [{ name: 'Тактическая карта', extensions: ['tmap'] }],
    });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
  }
  await fs.writeFile(target, json, 'utf8');
  return target;
});

ipcMain.handle('image:open', async () => {
  const r = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Изображения', extensions: Object.keys(IMAGE_MIME) }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  const ext = path.extname(p).slice(1).toLowerCase();
  const buf = await fs.readFile(p);
  return { name: path.basename(p), dataUrl: `data:${IMAGE_MIME[ext] || 'image/png'};base64,${buf.toString('base64')}` };
});

ipcMain.handle('export:save', async (_e, data, ext, encoding) => {
  const r = await dialog.showSaveDialog(win, {
    defaultPath: `карта.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (r.canceled || !r.filePath) return null;
  await fs.writeFile(r.filePath, encoding === 'base64' ? Buffer.from(data, 'base64') : data);
  return r.filePath;
});

ipcMain.handle('export:pdf', async (_e, svg, width, height) => {
  const r = await dialog.showSaveDialog(win, {
    defaultPath: 'карта.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled || !r.filePath) return null;
  const off = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${width}px ${height}px;margin:0}html,body{margin:0;padding:0}svg{display:block}</style></head><body>${svg}</body></html>`;
  const tmp = path.join(app.getPath('temp'), `tactic-export-${Date.now()}.html`);
  await fs.writeFile(tmp, html, 'utf8');
  try {
    await off.loadFile(tmp);
    const pdf = await off.webContents.printToPDF({
      printBackground: true,
      pageSize: { width: width / 96, height: height / 96 },
      margins: { marginType: 'none' },
    });
    await fs.writeFile(r.filePath, pdf);
  } finally {
    off.destroy();
    fs.unlink(tmp).catch(() => {});
  }
  return r.filePath;
});

ipcMain.on('window:title', (_e, title) => {
  if (win) win.setTitle(title);
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
