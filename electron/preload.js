const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appBridge', {
  isElectron: true,
  readText: () => ipcRenderer.invoke('clip:read-text'),
  copyRich: (html, text, fromHotkey) => ipcRenderer.invoke('clip:write-rich', html, text, !!fromHotkey),
  copyText: (text) => ipcRenderer.invoke('clip:write-text', text),
  saveFile: (name, bytes) => ipcRenderer.invoke('file:save', name, bytes),
  notify: (title, body) => ipcRenderer.invoke('app:notify', title, body),
  onTransform: (cb) => {
    ipcRenderer.on('render:transform', (_e, text) => cb(text));
  },
  onShown: (cb) => {
    ipcRenderer.on('win:shown', () => cb());
  }
});
