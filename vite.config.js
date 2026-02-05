import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
    },
    server: {
      proxy: {
        "/api": 'http://localhost:5100',
      }
    },
    resolve: {
      alias: {
        'react-native$': 'react-native-web',
      },
    },
    define: {
      __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    },
    plugins: [react()],
  };
});
