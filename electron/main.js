const {
  app, BrowserWindow, ipcMain, clipboard, globalShortcut,
  Tray, Menu, nativeImage, dialog, Notification, shell
} = require('electron');
const path = require('path');
const fs = require('fs');

const HOTKEY = 'Control+Alt+M';
const APP_ID = 'com.local.aicopykeeper';

let win = null;
let tray = null;
let quitting = false;
let rendererReady = false;
let firstHideHinted = false;

/* ---------------- 剪贴板内容判定 ---------------- */

function looksLikeMarkdown(text) {
  let score = 0;
  if (/(^|\n)[ \t]{0,3}#{1,6}[ \t]+\S/.test(text)) score += 2;
  if (/(^|\n)[ \t]*\|.*\|/.test(text) && /(^|\n)[ \t]*\|?[\s:|-]{3,}/.test(text)) score += 2;
  if (/\*\*[^*\n]+\*\*/.test(text)) score += 1;
  if (/(^|\n)[ \t]*([-*+]|\d+[.)])[ \t]+\S/.test(text)) score += 1;
  if (/(^|\n)[ \t]*>[ \t]+\S/.test(text)) score += 1;
  if (/```/.test(text)) score += 2;
  if (/`[^`\n]+`/.test(text)) score += 1;
  if (/(^|\n)[ \t]*([-*_])[ \t]*\1[ \t]*\1[-*_\s]*(\n|$)/.test(text)) score += 1;
  return score >= 2;
}

function notify(title, body) {
  if (!Notification.isSupported()) return;
  try {
    new Notification({ title, body, silent: false }).show();
  } catch (e) { /* ignore */ }
}

/* ---------------- 窗口 ---------------- */

/* 内嵌 64x64 图标。之前用 resources/icon.png，但打包时该目录不在 asar 里，
   nativeImage 读到空图 → 托盘显示空白方块 */
const APP_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAFGElEQVR42uWb+XYUVRCH+2lEwia0YBJ2pFkE9c95AVHHnYCQlSC7yzwAS4IgHpcXcMXt9DvMO4yoJJnMjJ7TlFW3bs29tjO3JzBLT/ec8/2f75e+e5X38id1j3jpY8OLHxE1xfEPDceuGV4grjJHr656R68wR4jLzGHiEnOIuFhVBMQFw8EPDM+fF1a8A8Q8s584x+wj5pi9xOyyYg8xw+wmppldxBSx5O0kJplxJNfyKoA1ygcoX0LxEKmgfITiQBwhLjOHiUvMIeJiVREQFwwo3QTFNStwgJhn9hPnmH3EHLOXmF0mIpSvoHiIlFA+6FR+/KwVQIJ8ESmjPKC4AuUhBfKwh5hhdhPTijLKF5PkxyQAh7yPhMdIfHjkYRcxRSyFKO+3k1cBOOQLSDTE8rCTmFyKkEIr+bEzKoC28pABecU4U4jLj0oALT77KGPygPIRivu2/OiZh16rCS/MoDyMMaEtP/q+FYA122dVHlAeUL4o8s9JANY6X864PPKwLPIqgNgmxyl//usGfPbbP8yvhrtxfiH+hjtxfmY+jfMTczvOfWYRmbpX64Y8oDygeKACOG0FoHd4beVJetC/xfuNbsgTJZLfIQHovX3o+uyr9UcDD2AF/4YuyAPKhzskAOtgU3GN+dQE8OTygOIVFcApCsCc6pwHGxrrg/4t/NjohjwRkfx2CUAfaRNn+/mvGn2Z8JiGAcUn79a6JQ8oD9slAOs8n6WlLkmeA5igAMxlRp7kgeSfnfjLs29y8iQPJK8CsK6x8iTPAZykAMwdXp7kgeR9CUBfYOZJHnwJwLq9TZSf+7Le06VuoRU/MLfifM/cjHH69mon8hzAexSAubp2ypPwsPxufFdPkgeS3yYB6Ht752e/koKtcMdb5tqjJHnYJgFYjxbOMT90AbjlOYB3KQDzYuOc8IZtCCTIA8lvlQD0c1XibD/7RT1VE95NFCVuWJxarHYiD1tVAH969ltdFpe6dvJA8hyAeajMk7wK4Jl3rAByJg8k3wxAP0/nSd4EYL3P50meA3jbCiBn8kDyWyQAXZmRKD/zeS0VS12Tb+swsVB9HHnYIgFYZSlOeRJO6+86BrFGeQ7grWYAqibH+dmneSu8jFvfNcoDyW/mAJoFSc4xPxQBdC4PmyUAqxrLOeGlegh8U1+rPAfw5h+eXYqWONtP36sNdMK73oKTt6qPIw8kv0kC0HV4WVzq2snDJgnAKkLMkzwH8AYFYCow8yQPJL9RAtDlp3mSh40SgFV7myd5DqBIAZjC4zzJA8lvkAB01XWiPD1Rd3upoyusAcjDBgnAKjmPXPIk2/NLzP7JRyqA1ykAU29fcX32vdwK0zV2H+WJCsmPSAC62SB0jfleBkB7+T7KA8qHIyqAB57daVFyTXi9HALqONs/eUD5EsmPvEYBmDaTIGm2P3tntet7++aFRv/kkQcBya+XAKwem3LGlrpW8mWRVwHEGoyKGZcHlC+u/08A/28wCjMsH9ryT7+qA4h1V/m6zSRr8hFK+7a8CqBNa1khY/KA0oW4PAfQvrWsoNtMsvCfbym/7oQKwNlX5+s2k2Ee8347eRWAq6nQajAq6k6LYVrqivEJLy6/7sTvXifyntVjE+hmg1CXnEcpkI/03j7UO7zAXudd8k+9ogPoUN6TNhNpNpCScyk8lvJTKUKUUjQpSJKyFClOkBdaeaiU5yp5tJCra7nAlGssucyQI60cbGR726m8CiDP8sS/jzorzpmwz7IAAAAASUVORK5CYII=';

function appIcon() {
  try {
    const img = nativeImage.createFromDataURL(APP_ICON_DATA_URL);
    if (!img.isEmpty()) return img;
  } catch (e) { /* ignore */ }
  return nativeImage.createEmpty();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 840,
    minWidth: 880,
    minHeight: 560,
    title: 'AI 对话格式复制工具',
    backgroundColor: '#f4f6f8',
    icon: appIcon(),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));

  // 右键菜单：Electron 默认不提供，导致输入框里只能用 Ctrl+V，鼠标右键粘不了
  win.webContents.on('context-menu', (_e, params) => {
    const items = [];
    if (params.isEditable) {
      items.push({ label: '剪切', role: 'cut', enabled: params.editFlags.canCut });
      items.push({ label: '复制', role: 'copy', enabled: params.editFlags.canCopy });
      items.push({ label: '粘贴', role: 'paste' });
      items.push({ type: 'separator' });
      items.push({ label: '全选', role: 'selectAll' });
    } else if (params.selectionText && params.selectionText.trim()) {
      items.push({ label: '复制', role: 'copy' });
      items.push({ type: 'separator' });
      items.push({ label: '全选', role: 'selectAll' });
    } else {
      items.push({ label: '全选', role: 'selectAll' });
    }
    Menu.buildFromTemplate(items).popup({ window: win });
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.on('did-finish-load', () => {
    rendererReady = true;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('focus', () => {
    if (win && !win.isDestroyed()) win.webContents.send('win:shown');
  });

  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
    if (!firstHideHinted) {
      firstHideHinted = true;
      if (tray) {
        try {
          tray.displayBalloon({
            title: '还在后台运行',
            content: '关闭窗口只是收到托盘。按 ' + HOTKEY.replace('Control', 'Ctrl') + ' 可在任何地方直接把剪贴板里的 AI 回复转成富文本，右键托盘图标可退出。',
            iconType: 'info'
          });
        } catch (err) { /* ignore */ }
      }
    }
  });
}

/* ---------------- 托盘 ---------------- */

function showWindow() {
  if (!win || win.isDestroyed()) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  const img = appIcon();
  const trayImg = img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 32, height: 32 });
  tray = new Tray(trayImg);
  tray.setToolTip('AI 对话格式复制工具 · by AsaZhou');

  const menu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: showWindow },
    { label: '把剪贴板转成富文本  (Ctrl+Alt+M)', click: transformClipboard },
    { type: 'separator' },
    {
      label: '窗口置顶',
      type: 'checkbox',
      checked: false,
      click: (item) => { if (win && !win.isDestroyed()) win.setAlwaysOnTop(item.checked); }
    },
    { label: '打开临时文件夹', click: () => shell.openPath(app.getPath('temp')) },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        quitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', showWindow);
  tray.on('click', showWindow);
}

/* ---------------- 核心：转换剪贴板 ---------------- */

function transformClipboard() {
  const text = clipboard.readText();
  if (!text || !text.trim()) {
    notify('剪贴板是空的', '先复制一段 AI 回复再按热键。');
    return;
  }
  if (!looksLikeMarkdown(text)) {
    notify('看起来不是 Markdown', '为避免覆盖原有格式，本次未做转换。可以打开主窗口手动粘贴处理。');
    showWindow();
    return;
  }
  if (!win || win.isDestroyed()) {
    createWindow();
    setTimeout(() => transformClipboard(), 1200);
    return;
  }
  if (!rendererReady) {
    notify('窗口还在启动', '请稍等一秒再按一次热键。');
    return;
  }

  // 走渲染进程 + 用户手势：Electron 的 clipboard.write 在部分安全软件环境下会静默失败，
  // 而 Chromium 的 execCommand('copy') 能稳定写入 CF_HTML。
  const code = 'window.__hotkeyTransform(' + JSON.stringify(text) + ')';
  win.webContents.executeJavaScript(code, true).then((result) => {
    if (result === 'ok' || result === 'ok-ipc') {
      notify('已转成富文本', '直接 Ctrl+V 粘到 Word / 邮件 / 文档里即可。');
    } else {
      notify('转换失败', '请打开主窗口手动粘贴处理（' + String(result) + '）');
      showWindow();
    }
  }).catch((err) => {
    notify('转换失败', String(err && err.message ? err.message : err));
    showWindow();
  });
}

/* ---------------- IPC ---------------- */

ipcMain.handle('clip:read-text', () => clipboard.readText());

ipcMain.handle('clip:write-rich', (_e, html, text, fromHotkey) => {
  clipboard.write({ text: text || '', html: html || '' });
  if (fromHotkey) {
    const kind = /<table/i.test(html) ? '含表格' : '含格式';
    notify('已转成富文本' + '（' + kind + '）', '直接 Ctrl+V 粘到 Word / 邮件 / 文档里即可。');
  }
  return true;
});

ipcMain.handle('clip:write-text', (_e, text) => {
  clipboard.write({ text: text || '' });
  return true;
});

ipcMain.handle('file:save', async (_e, name, bytes) => {
  const ext = (path.extname(name) || '').slice(1).toLowerCase();
  const filters = ext === 'png'
    ? [{ name: 'PNG 图片', extensions: ['png'] }]
    : [{ name: 'Word 文档', extensions: ['doc'] }];
  const safeName = String(name || 'AI对话').replace(/[\\/:*?"<>|]/g, '_');
  const res = await dialog.showSaveDialog(win, {
    title: '保存文件',
    defaultPath: path.join(app.getPath('desktop'), safeName),
    filters
  });
  if (res.canceled || !res.filePath) return null;
  await fs.promises.writeFile(res.filePath, Buffer.from(bytes));
  return res.filePath;
});

ipcMain.handle('app:notify', (_e, title, body) => {
  notify(title || '提示', body || '');
  return true;
});

/* ---------------- 生命周期 ---------------- */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    createWindow();
    createTray();

    const ok = globalShortcut.register(HOTKEY, transformClipboard);
    if (!ok) {
      console.warn('全局热键注册失败：' + HOTKEY);
    }

    app.on('activate', () => showWindow());
  });

  app.on('window-all-closed', () => {
    // 常驻托盘，不退出
  });

  app.on('before-quit', () => {
    quitting = true;
    globalShortcut.unregisterAll();
  });
}
