import { createRequire } from 'node:module';
import fs from 'node:fs';

export function getProjectMindVersion(): string {
  try {
    const req = typeof require !== 'undefined' ? require : createRequire(import.meta.url);
    // Since this file might be compiled into dist/utils/version.js or bundled into dist/index.js,
    // resolving 'project-mind/package.json' from its own dependencies might fail if we are linked.
    // Instead we resolve '..' from this file until we find package.json, or just hardcode it to package.json.
    // Wait, let's just parse the package.json we know is at the root of the install.
    // We can find the path by resolving from __dirname if available, or import.meta.url.
    let rootPath = '';
    if (typeof __dirname !== 'undefined') {
        rootPath = __dirname;
    } else {
        rootPath = new URL('.', import.meta.url).pathname;
    }
    
    // We navigate up to find package.json
    let currentDir = rootPath;
    for (let i = 0; i < 3; i++) {
      const pkgPath = `${currentDir}/package.json`;
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === 'project-mind' && pkg.version) {
          return pkg.version;
        }
      }
      currentDir = `${currentDir}/..`;
    }
    
    return '1.1.0'; // Fallback
  } catch (err) {
    return '1.1.0'; // Fallback
  }
}
