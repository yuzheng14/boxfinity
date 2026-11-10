import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  base: '/boxfinity/',
  server: { host: '127.0.0.1', port: Number(process.env.PORT || 4173), strictPort: true },
  preview: { host: '127.0.0.1', port: Number(process.env.PORT || 4173), strictPort: true },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-core', test: /three\/build\/three\.core/ },
            { name: 'three-renderer', test: /three\/build\/three\.module/ },
          ],
        },
      },
    },
  },
  plugins: [{
    name: 'three-license',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'vendor/three/LICENSE',
        source: readFileSync(new URL('./node_modules/three/LICENSE', import.meta.url), 'utf8'),
      });
    },
  }],
});
