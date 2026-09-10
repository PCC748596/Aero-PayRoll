
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "AeroPayroll Manager",
    icon: path.join(__dirname, 'icon.ico'), // Você precisará de um arquivo .ico na pasta
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false // Desabilita o F12 e ferramentas de inspeção para proteger o código
    }
  });

  // Remove a barra de menu (Arquivo, Editar, etc) para visual de software nativo
  Menu.setApplicationMenu(null);

  win.loadFile('index.html');

  // Garante que o app abra sempre no tamanho ideal
  win.maximize();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
