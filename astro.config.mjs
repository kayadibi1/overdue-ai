// @ts-check
import { defineConfig } from 'astro/config';

// Primary deploy = apex domain on newbox (base '/'). PAGES=1 builds the GitHub Pages backup.
const onPages = process.env.PAGES === '1';

export default defineConfig({
  output: 'static',
  site: onPages ? 'https://kayadibi1.github.io' : 'https://overduetracker.org',
  base: onPages ? '/overdue-ai' : '/',
});
