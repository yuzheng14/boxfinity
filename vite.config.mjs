import { defineConfig } from 'vite';

export default defineConfig({
  base: '/boxfinity/',
  build: { license: { fileName: 'THIRD_PARTY_LICENSES.md' } },
});
