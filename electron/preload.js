const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  getRuntimeInfo: () => ipcRenderer.invoke("desktop:getRuntimeInfo"),
  openConfigFile: () => ipcRenderer.invoke("desktop:openConfigFile"),
  openDataDirectory: () => ipcRenderer.invoke("desktop:openDataDirectory"),
  getAiConfig: () => ipcRenderer.invoke("desktop:getAiConfig"),
  saveAiConfig: (nextConfig) => ipcRenderer.invoke("desktop:saveAiConfig", nextConfig),
  getWorkspaceStateSync: () => ipcRenderer.sendSync("desktop:getWorkspaceStateSync"),
  setWorkspaceValueSync: (key, value) => ipcRenderer.sendSync("desktop:setWorkspaceValueSync", { key, value }),
});
