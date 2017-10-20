const { app, BrowserWindow } = require('electron');
const { productName, version, description } = require('../package.json');
const isDev = require('electron-is-dev');
app.setAppUserModelId('com.robflop.tol-mod-utility');

app.on('ready', () => {
	const mainWindow = new BrowserWindow({ minWidth: 1080, minHeight: 720, webPreferences: { devTools: isDev || false }, center: true, show: false });
	mainWindow.loadURL(`file://${__dirname}/index.html`);
	mainWindow.on('ready-to-show', () => {
		if (isDev) mainWindow.webContents.openDevTools();
		mainWindow.setMenu(null);
		mainWindow.setSize(1080, 720);
		mainWindow.setTitle(`${productName} ${version} - ${description}`);
		mainWindow.show();
	});
});

app.on('window-all-closed', () => app.quit());