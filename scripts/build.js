#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const chalk = require('chalk');

class ChromeExtensionBuilder {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.buildDir = path.join(this.projectRoot, 'build');
    this.distDir = path.join(this.projectRoot, 'dist');
    this.tempDir = path.join(this.buildDir, 'temp');
    
    this.manifest = this.loadManifest();
    this.packageJson = this.loadPackageJson();
    
    this.isDev = process.argv.includes('--dev');
    this.isStore = process.argv.includes('--store');
  }

  loadManifest() {
    try {
      const manifestPath = path.join(this.projectRoot, 'manifest.json');
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      this.error('Failed to load manifest.json:', error.message);
      process.exit(1);
    }
  }

  loadPackageJson() {
    try {
      const packagePath = path.join(this.projectRoot, 'package.json');
      return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    } catch (error) {
      this.error('Failed to load package.json:', error.message);
      process.exit(1);
    }
  }

  log(message) {
    console.log(chalk.blue('[INFO]'), message);
  }

  success(message) {
    console.log(chalk.green('[SUCCESS]'), message);
  }

  warning(message) {
    console.log(chalk.yellow('[WARNING]'), message);
  }

  error(message, details = '') {
    console.error(chalk.red('[ERROR]'), message);
    if (details) console.error(details);
  }

  async cleanup() {
    this.log('Cleaning build directories...');
    await fs.remove(this.buildDir);
    await fs.remove(this.distDir);
  }

  async createDirectories() {
    this.log('Creating build directories...');
    await fs.ensureDir(this.buildDir);
    await fs.ensureDir(this.distDir);
    await fs.ensureDir(this.tempDir);
  }

  shouldExclude(filePath) {
    const excludePatterns = this.packageJson.build?.exclude || [];
    const relativePath = path.relative(this.projectRoot, filePath);
    
    return excludePatterns.some(pattern => {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\//g, '[\\/\\\\]');
      
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(relativePath) || regex.test(relativePath.replace(/\\/g, '/'));
    });
  }

  async copyFiles() {
    this.log('Copying extension files...');
    
    const copyFile = async (src, dest) => {
      if (this.shouldExclude(src)) {
        return;
      }
      
      const stat = await fs.stat(src);
      if (stat.isDirectory()) {
        await fs.ensureDir(dest);
        const files = await fs.readdir(src);
        for (const file of files) {
          await copyFile(path.join(src, file), path.join(dest, file));
        }
      } else {
        await fs.copy(src, dest);
      }
    };

    // Copy all files
    const files = await fs.readdir(this.projectRoot);
    for (const file of files) {
      const srcPath = path.join(this.projectRoot, file);
      const destPath = path.join(this.tempDir, file);
      await copyFile(srcPath, destPath);
    }
  }

  async validateFiles() {
    this.log('Validating extension files...');
    
    const requiredFiles = [
      'manifest.json',
      'src/popup/popup.html',
      'src/popup/popup.js',
      'src/popup/popup.css',
      'src/content/content.js',
      'src/content/content.css',
      'src/background/background.js',
      'src/assets/icon16.png',
      'src/assets/icon32.png',
      'src/assets/icon48.png',
      'src/assets/icon128.png'
    ];

    let allValid = true;
    for (const file of requiredFiles) {
      const filePath = path.join(this.tempDir, file);
      if (!await fs.pathExists(filePath)) {
        this.error(`Required file missing: ${file}`);
        allValid = false;
      }
    }

    if (!allValid) {
      throw new Error('Validation failed: missing required files');
    }

    // Validate manifest.json
    try {
      const manifestPath = path.join(this.tempDir, 'manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      
      if (!manifest.name || !manifest.version || !manifest.description) {
        throw new Error('Manifest missing required fields');
      }
    } catch (error) {
      this.error('Manifest validation failed:', error.message);
      throw error;
    }

    this.success('File validation passed');
  }

  async createZip() {
    const version = this.manifest.version;
    const zipName = `ai-language-translator-v${version}${this.isDev ? '-dev' : ''}.zip`;
    const zipPath = path.join(this.distDir, zipName);

    this.log(`Creating ZIP archive: ${zipName}`);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level
      });

      output.on('close', () => {
        const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
        this.success(`ZIP created: ${sizeInMB}MB`);
        resolve(zipPath);
      });

      archive.on('error', (err) => {
        this.error('Archive creation failed:', err.message);
        reject(err);
      });

      archive.pipe(output);
      archive.directory(this.tempDir, false);
      archive.finalize();
    });
  }

  async createDevFolder() {
    const devPath = path.join(this.distDir, 'extension-dev');
    this.log('Creating development folder...');
    await fs.copy(this.tempDir, devPath);
    this.success(`Development folder created: ${devPath}`);
    return devPath;
  }

  async printResults(zipPath, devPath) {
    console.log('\n' + '='.repeat(60));
    this.success('Build completed successfully!');
    console.log('='.repeat(60));
    
    console.log('\n📦 Build artifacts:');
    console.log(`  • Production ZIP: ${path.relative(this.projectRoot, zipPath)}`);
    if (devPath) {
      console.log(`  • Development folder: ${path.relative(this.projectRoot, devPath)}`);
    }
    
    console.log('\n📊 File information:');
    const stats = await fs.stat(zipPath);
    const sizeInKB = (stats.size / 1024).toFixed(1);
    console.log(`  • ZIP size: ${sizeInKB} KB`);
    console.log(`  • Version: ${this.manifest.version}`);
    console.log(`  • Extension name: ${this.manifest.name}`);
    
    console.log('\n🚀 Installation instructions:');
    console.log('');
    
    if (devPath) {
      console.log('Development mode (recommended for testing):');
      console.log('  1. Open Chrome and go to chrome://extensions/');
      console.log('  2. Enable "Developer mode" in the top right');
      console.log('  3. Click "Load unpacked"');
      console.log(`  4. Select the folder: ${path.relative(this.projectRoot, devPath)}`);
      console.log('');
    }
    
    console.log('Chrome Web Store submission:');
    console.log('  1. Go to Chrome Web Store Developer Dashboard');
    console.log('  2. Create new item or update existing');
    console.log(`  3. Upload the ZIP file: ${path.relative(this.projectRoot, zipPath)}`);
    console.log('  4. Fill in store listing details');
    console.log('  5. Submit for review');
    
    console.log('\n' + '='.repeat(60));
  }

  async build() {
    try {
      console.log(chalk.cyan.bold('\n🔨 AI Language Translator - Chrome Extension Builder'));
      console.log(chalk.cyan('='.repeat(60)));
      
      const buildType = this.isDev ? 'Development' : this.isStore ? 'Store Release' : 'Production';
      this.log(`Build type: ${buildType}`);
      this.log(`Version: ${this.manifest.version}`);
      
      await this.cleanup();
      await this.createDirectories();
      await this.copyFiles();
      await this.validateFiles();
      
      const zipPath = await this.createZip();
      let devPath = null;
      
      if (!this.isStore) {
        devPath = await this.createDevFolder();
      }
      
      await this.printResults(zipPath, devPath);
      
    } catch (error) {
      this.error('Build failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Check if script is run directly
if (require.main === module) {
  const builder = new ChromeExtensionBuilder();
  builder.build().catch(() => process.exit(1));
}

module.exports = ChromeExtensionBuilder;