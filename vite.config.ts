import type { UserConfig } from 'vite'

export default {
  root: ".",
  server: {
    port: 5555,
  },
      build: {
        target: 'esnext',
        minify: true,
        emptyOutDir: true,
        outDir: 'dist',
    },

} satisfies UserConfig