#!/usr/bin/env node
/**
 * Moonfin Tizen Build Script
 * 
 * Usage:
 *   npm run build          - Build unsigned .wgt (for development)
 *   npm run build:signed   - Build signed .wgt (for store/production)
 *   npm run install-tv     - Build and install to connected TV
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TIZEN_DIR = path.join(ROOT, 'tizen');
const RESOURCES_DIR = path.join(ROOT, 'resources');

const args = process.argv.slice(2);
const isSigned = args.includes('--signed');
const shouldInstall = args.includes('--install');
const isDev = args.includes('--dev');  // Use --dev for debug builds

// ANSI colors
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;

function log(msg) { console.log(cyan('[build]'), msg); }
function success(msg) { console.log(green('[✓]'), msg); }
function warn(msg) { console.log(yellow('[!]'), msg); }
function error(msg) { console.log(red('[✗]'), msg); }

function run(cmd, options = {}) {
	log(`Running: ${cmd}`);
	try {
		execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...options });
		return true;
	} catch (e) {
		return false;
	}
}

function findTizenCLI() {
	const possiblePaths = [
		// Windows
		'C:\\tizen-studio\\tools\\ide\\bin\\tizen.bat',
		process.env.LOCALAPPDATA + '\\tizen-studio\\tools\\ide\\bin\\tizen.bat',
		process.env.USERPROFILE + '\\tizen-studio\\tools\\ide\\bin\\tizen.bat',
		// macOS/Linux
		'/usr/local/tizen-studio/tools/ide/bin/tizen',
		process.env.HOME + '/tizen-studio/tools/ide/bin/tizen',
	];
	
	for (const p of possiblePaths) {
		if (p && fs.existsSync(p)) return p;
	}
	
	// Try PATH
	try {
		execSync('tizen version', { stdio: 'pipe' });
		return 'tizen';
	} catch (e) {
		return null;
	}
}

function findSDB() {
	const possiblePaths = [
		// Windows
		'C:\\tizen-studio\\tools\\sdb.exe',
		process.env.LOCALAPPDATA + '\\tizen-studio\\tools\\sdb.exe',
		process.env.USERPROFILE + '\\tizen-studio\\tools\\sdb.exe',
		// macOS/Linux
		'/usr/local/tizen-studio/tools/sdb',
		process.env.HOME + '/tizen-studio/tools/sdb',
	];
	
	for (const p of possiblePaths) {
		if (p && fs.existsSync(p)) return p;
	}
	
	// Try PATH
	try {
		execSync('sdb version', { stdio: 'pipe' });
		return 'sdb';
	} catch (e) {
		return null;
	}
}

function copyDir(src, dest) {
	if (!fs.existsSync(src)) return;
	
	const files = fs.readdirSync(src);
	for (const file of files) {
		const srcPath = path.join(src, file);
		const destPath = path.join(dest, file);
		
		if (fs.statSync(srcPath).isDirectory()) {
			if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
			copyDir(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

function copyFiles(src, dest, pattern = null) {
	if (!fs.existsSync(src)) return;
	if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
	
	const files = fs.readdirSync(src);
	for (const file of files) {
		if (pattern && !file.match(pattern)) continue;
		const srcPath = path.join(src, file);
		const destPath = path.join(dest, file);
		if (!fs.statSync(srcPath).isDirectory()) {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

async function main() {
	console.log('\n' + cyan('═'.repeat(50)));
	console.log(cyan('  Moonfin Tizen Build'));
	console.log(cyan('═'.repeat(50)) + '\n');
	
	// Step 1: Find Tizen CLI
	const tizenCLI = findTizenCLI();
	if (!tizenCLI) {
		error('Tizen CLI not found!');
		console.log('\nPlease install Tizen Studio from:');
		console.log('https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html');
		process.exit(1);
	}
	success(`Found Tizen CLI: ${tizenCLI}`);
	
	// Step 2: Build Enact app
	log(`Building Enact app (${isDev ? 'development' : 'production'})...`);
	const packCmd = isDev ? 'npx enact pack' : 'npx enact pack -p';
	if (!run(packCmd)) {
		error('Enact build failed!');
		process.exit(1);
	}
	success('Enact build complete');
	
	// Step 3: Copy Tizen config files
	log('Copying Tizen configuration...');
	copyFiles(TIZEN_DIR, DIST);
	success('Copied config.xml and icons');
	
	// Step 4: Copy resources
	log('Copying resources...');
	const distResources = path.join(DIST, 'resources');
	if (!fs.existsSync(distResources)) fs.mkdirSync(distResources, { recursive: true });
	copyFiles(RESOURCES_DIR, distResources, /\.png$/);
	success('Copied resource images');
	
	// Step 5: Clean up unnecessary files to reduce package size
	log('Cleaning up unnecessary files...');
	
	// Remove source maps if any
	const distFiles = fs.readdirSync(DIST);
	distFiles.forEach(file => {
		if (file.endsWith('.map')) {
			fs.unlinkSync(path.join(DIST, file));
		}
	});
	
	// Clean up iLib locale data - keep only essential files
	const ilibLocalePath = path.join(DIST, 'node_modules', 'ilib', 'locale');
	if (fs.existsSync(ilibLocalePath)) {
		// Keep only ilibmanifest.json and en-US locale
		const localeDirs = fs.readdirSync(ilibLocalePath);
		let removedCount = 0;
		localeDirs.forEach(item => {
			const itemPath = path.join(ilibLocalePath, item);
			// Keep manifest and English locale
			if (item === 'ilibmanifest.json' || item === 'en' || item === 'und') {
				return;
			}
			// Remove other locale folders
			if (fs.statSync(itemPath).isDirectory()) {
				fs.rmSync(itemPath, { recursive: true, force: true });
				removedCount++;
			}
		});
		success(`Removed ${removedCount} unused locale folders`);
	}
	
	// Step 6: Package WGT
	log(`Packaging ${isSigned ? 'signed' : 'unsigned'} .wgt...`);
	
	const wgtName = 'Moonfin.wgt';
	const wgtPath = path.join(DIST, wgtName);
	
	// Remove old wgt if exists
	if (fs.existsSync(wgtPath)) fs.unlinkSync(wgtPath);
	
	let packageCmd;
	if (isSigned) {
		// Use the active signing profile
		packageCmd = `"${tizenCLI}" package -t wgt -- "${DIST}"`;
	} else {
		// Package without signing (for development/sideloading)
		packageCmd = `"${tizenCLI}" package -t wgt -- "${DIST}"`;
	}
	
	if (!run(packageCmd, { cwd: DIST })) {
		error('Packaging failed!');
		process.exit(1);
	}
	
	// Find the generated wgt
	const wgtFiles = fs.readdirSync(DIST).filter(f => f.endsWith('.wgt'));
	if (wgtFiles.length === 0) {
		error('No .wgt file generated!');
		process.exit(1);
	}
	
	const generatedWgt = path.join(DIST, wgtFiles[0]);
	
	// Show final size
	const stats = fs.statSync(generatedWgt);
	const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
	success(`Package created: ${generatedWgt} (${sizeMB} MB)`);
	
	// Step 6: Install to TV (if requested)
	if (shouldInstall) {
		const sdb = findSDB();
		if (!sdb) {
			error('SDB not found! Cannot install to TV.');
			process.exit(1);
		}
		
		log('Installing to TV...');
		if (!run(`"${tizenCLI}" install -n "${generatedWgt}"`)) {
			error('Installation failed! Make sure your TV is connected.');
			console.log('\nTo connect your TV:');
			console.log('1. Enable Developer Mode on your TV');
			console.log('2. Run: sdb connect <TV_IP_ADDRESS>');
			process.exit(1);
		}
		success('Installed to TV!');
		
		log('Launching app...');
		run(`"${tizenCLI}" run -p Moonfin000.moonfin`);
	}
	
	console.log('\n' + green('═'.repeat(50)));
	console.log(green('  Build Complete!'));
	console.log(green('═'.repeat(50)));
	console.log(`\n  Output: ${cyan(generatedWgt)}`);
	
	if (!shouldInstall) {
		console.log('\n  To install to your TV:');
		console.log(`  ${yellow('npm run install-tv')}`);
		console.log('\n  Or manually:');
		console.log(`  ${yellow(`tizen install -n "${generatedWgt}"`)}`);
	}
	
	console.log('');
}

main().catch(e => {
	error(e.message);
	process.exit(1);
});
