import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import feedback from './src/dev/feedback/integration.ts';

// `astro build` re-optimises Vite's dependency cache. When it shares that cache with a
// running `astro dev`, the dev server's copies go stale and the browser gets
// "504 Outdated Optimize Dep" (the dev toolbar disappears). Give builds their own cache.
const separateBuildCache = {
  name: 'separate-build-cache',
  hooks: {
    'astro:config:setup': ({ command, updateConfig }) => {
      if (command === 'build') updateConfig({ vite: { cacheDir: 'node_modules/.vite-build' } });
    },
  },
};

export default defineConfig({
  integrations: [react(), feedback(), separateBuildCache],
});
