import * as esbuild from 'esbuild';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');
const dependencies = pkg.dependencies || {};
// Bundle most dependencies into the output to speed up server cold starts.
// Only keep packages with native bindings or known bundling issues as external.
const externalList = Object.keys(dependencies).filter(dep => {
  // pg has native bindings - keep external (not used at runtime anyway)
  if (dep === 'pg') return true;
  return false;
});
try {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: 'dist',
    external: externalList,
    banner: {
      js: `
import { createRequire as __createRequire } from 'module';
const require = __createRequire(import.meta.url);
`.trim(),
    },
  });
  console.log('⚡ Server build complete!');

  // Export Expo web static files and copy into server/dist/web
  const { execSync } = await import('child_process');
  const path = await import('path');
  const fs = await import('fs');

  const clientDir = path.resolve(import.meta.dirname, '..', 'client');
  const clientDistDir = path.resolve(clientDir, 'dist');
  const webDistDir = path.resolve(import.meta.dirname, 'dist', 'web');

  console.log('📦 Exporting Expo web static files...');
  execSync('npx expo export --output-dir dist', { cwd: clientDir, stdio: 'inherit' });

  // Copy client/dist to server/dist/web
  if (fs.existsSync(webDistDir)) {
    fs.rmSync(webDistDir, { recursive: true, force: true });
  }
  fs.cpSync(clientDistDir, webDistDir, { recursive: true });
  console.log('✅ Web static files copied to dist/web/');
} catch (e) {
  console.error(e);
  process.exit(1);
}
