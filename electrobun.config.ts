import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    identifier: "com.whisp.app",
    name: "Whisp",
    version: "0.1.0",
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    copy: {
      ".electrobun/views/main": "views/main",
      bin: "bin",
    },
    watch: ["src/bun", "src/shared", ".electrobun/views/main"],
  },
} satisfies ElectrobunConfig;
