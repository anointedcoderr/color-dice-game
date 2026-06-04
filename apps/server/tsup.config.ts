import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // All node_modules (express, socket.io, @prisma/client, …) are listed in
  // dependencies and are therefore externalised by tsup automatically, so the
  // Prisma query engine resolves from node_modules at runtime. Only our own
  // src/ is bundled.
  splitting: false,
  shims: false,
});
