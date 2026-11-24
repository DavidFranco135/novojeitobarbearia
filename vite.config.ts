import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      publicDir: 'public',
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              // Firebase separado — carrega em paralelo com o app
              'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
              // Gráficos só carregam quando a tela de financeiro abrir
              'recharts': ['recharts', 'react-is'],
              // Ícones
              'icons': ['lucide-react'],
              // React core
              'react-vendor': ['react', 'react-dom'],
            }
          }
        }
      }
    };
});
