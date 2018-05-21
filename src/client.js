const { app, BrowserWindow } = require('electron');
const { productName, version, description } = require('../package.json');
app.setAppUserModelId('com.robflop.tol-mod-utility');

app.on('ready', () => {
	// require('vue-devtools').install();

	const mainWindow = new BrowserWindow({ minWidth: 1420, minHeight: 840, webPreferences: { devTools: false }, center: true, show: false });
	mainWindow.loadURL(`file://${__dirname}/index.html`);
	mainWindow.on('ready-to-show', () => {
		mainWindow.setMenu(null);
		mainWindow.setSize(1420, 840);
		mainWindow.setTitle(`${productName} ${version} - ${description}`);
		mainWindow.show();
	});
	// mainWindow.webContents.openDevTools();
});

app.on('window-all-closed', () => app.quit());