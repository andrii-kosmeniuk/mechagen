import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      {
        name: 'inject-supabase-into-index-html',
        transformIndexHtml(html) {
          const url = env.VITE_SUPABASE_URL ?? '';
          const key = env.VITE_SUPABASE_ANON_KEY ?? '';
          return html
            .replaceAll('%VITE_SUPABASE_URL%', url)
            .replaceAll('%VITE_SUPABASE_ANON_KEY%', key);
        },
      },
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
