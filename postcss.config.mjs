/**
 * Tailwind v4 runs as a PostCSS plugin and needs no config file of its own —
 * the theme lives in app/globals.css, in the `@theme` block that the palette
 * generator writes.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
