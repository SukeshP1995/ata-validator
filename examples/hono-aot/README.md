# Hono + ata-AOT bundle size demo

Reproduces the bundle-size comparison from the ata-validator 0.13.0 release.

## Run

```bash
npm install
npm run build:schemas   # compiles schemas/*.schema.json → build/*.compiled.mjs
npm run measure         # builds both apps with esbuild, prints sizes
```

## What's compared

- `src/ata-app.js`: Hono routes that import per-schema `.compiled.mjs` validators (zero runtime ata-validator dep).
- `src/ajv-app.js`: same routes, with `Ajv` + `ajv-formats` at runtime.

Both apps validate the same schemas with the same logic. Only the validator delivery differs.
