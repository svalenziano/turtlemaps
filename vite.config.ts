import type { UserConfig } from 'vite'

export default {
  root: ".",
  server: {
    port: 5555,
  },
      build: {
        target: 'esnext',
        minify: false,
        emptyOutDir: true,

        rollupOptions: {
            output: {
                preserveModules: true,
            },
        },
    },

} satisfies UserConfig