import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import feedback from './src/dev/feedback/integration.ts';

export default defineConfig({
  integrations: [react(), feedback()],
});
