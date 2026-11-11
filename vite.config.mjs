import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/boxfinity/',
  build: { license: { fileName: 'THIRD_PARTY_LICENSES.md' } },
  plugins: [react()],
});
