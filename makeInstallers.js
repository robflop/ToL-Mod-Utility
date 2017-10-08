const { createWindowsInstaller } = require('electron-winstaller');
const { join } = require('path');
const { version } = require('./package.json');

const arch = process.argv[2] || 'ia32';
const distPath = join(__dirname, 'dist');

console.log('Now creating Installer(s)... (This might take a while)');

const appDirectory = join(distPath, `ToL-Mod-Utility-win32-${arch}`);

const settings = {
	appDirectory,
	authors: 'robflop',
	outputDirectory: join(appDirectory, '..', 'windows-installer'),
	exe: 'ToL-Mod-Utility.exe',
	setupExe: `ToL-Mod-UtilityInstaller-${version}-${arch}.exe`,
	description: 'ToL-Mod-Utility',
	noMsi: true,
	title: 'ToL-Mod-Utility',
	iconURL: 'https://github.com/robflop/ToL-Mod-Utility/raw/master/src/icon.ico',
	setupIcon: join(appDirectory, '..', '..', 'src', 'icon.ico')
};

return createWindowsInstaller(settings)
	.then(() => {
		console.log(`Installer successfully created for version ${version} on win32-${arch}`);
		process.exit();
	})
	.catch(e => {
		console.log(`An error occurred creating the installer for version ${version} on win32-${arch}: ${e.message}`);
		process.exit();
	});