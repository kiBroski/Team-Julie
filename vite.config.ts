
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // We need to copy manifest.json and sw.js to the build folder manually
    // because they are in the root, not a public folder.
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'sw.js', dest: '.' }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 3000
  }
});
