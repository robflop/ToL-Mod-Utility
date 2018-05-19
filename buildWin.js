const packager = require('electron-packager');

console.log('Now building... (This might take a while)');

const buildOptions = {
	dir: './',
	appCopyright: 'Copyright (C) 2018 robflop',
	platform: 'win32',
	arch: process.argv[2] || 'ia32',
	asar: true,
	icon: './src/icon.ico',
	ignore: /(buildWin|makeInstallers|vscode|eslintrc|gitattributes|gitignore|htmlhintrc|travis)/,
	out: 'dist/',
	overwrite: true,
	prune: true,
	win32metadata: {
		CompanyName: 'robflop',
		ProductName: 'ToL-Mod-Utility',
		FileDescription: 'Throne of Lies Mod Utility',
		OriginalFilename: 'ToL-Mod-Utility.exe'
	}
};

packager(buildOptions).then(appPaths => console.log('Successfully built into the following folder:', appPaths.join('\n')));