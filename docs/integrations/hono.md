# Hono

[Hono](https://hono.dev) is a small, fast web framework that runs on Bun, Deno, Cloudflare Workers, and Node. ata fits in as a middleware.

## Install

```bash
npm install ata-validator hono
```

## Basic middleware

Write a small factory that returns a Hono middleware given a schema:

```ts
import { Hono } from 'hono'
import { Validator } from 'ata-validator'
import type { MiddlewareHandler } from 'hono'

function ataBody(schema: object): MiddlewareHandler {
  const v = new Validator(schema)
  return async (c, next) => {
    const body = await c.req.json().catch(() => null)
    if (body === null) return c.json({ error: 'invalid JSON' }, 400)
    const r = v.validate(body)
    if (!r.valid) return c.json({ error: 'validation failed', errors: r.errors }, 400)
    c.set('body', body)
    await next()
  }
}

const app = new Hono()

app.post('/users',
  ataBody({
    type: 'object',
    properties: {
      id: { type: 'integer', minimum: 1 },
      name: { type: 'string', minLength: 1 },
      email: { type: 'string' },
    },
    required: ['id', 'name', 'email'],
  }),
  (c) => {
    const body = c.get('body')
    return c.json({ ok: true, id: body.id, name: body.name })
  },
)

export default app
```

## Buffer path (Bun / Node runtime)

On runtimes with access to a raw body buffer, skip `JSON.parse` in the middleware and hand the buffer to the native simdjson path:

```ts
import { Validator } from 'ata-validator'

const v = new Validator(schema)

app.post('/ingest', async (c) => {
  const buf = await c.req.arrayBuffer()
  const body = Buffer.from(buf)
  if (!v.isValid(body)) return c.json({ error: 'invalid' }, 400)
  // parse only on success
  return c.json({ ok: true, data: JSON.parse(body.toString()) })
})
```

This avoids building a JS object tree for invalid requests.

## Cloudflare Workers bundle note

On Workers, the runtime dependency on `ata-validator` adds ~27 KB gzipped to the bundle. For size-sensitive deploys, pre-compile the schema with [ata-vite](https://github.com/ata-core/ata-vite) or the `ata compile` CLI:

```bash
npx ata compile schemas/user.json -o src/user.validator.mjs
```

Then import the compiled validator directly, skipping ata-validator at runtime:

```ts
import { isValid } from './schemas/user.validator.mjs'

app.post('/users', async (c) => {
  const body = await c.req.json()
  if (!isValid(body)) return c.json({ error: 'invalid' }, 400)
  return c.json({ ok: true })
})
```

Compiled output is around 1 KB gzipped per schema.

## Notes

- Hono's built-in `zValidator` handles Zod/Valibot schemas. The adapter above mirrors that shape but for raw JSON Schema, useful when the schema comes from OpenAPI or a shared registry.
- `c.set('body', body)` stores the parsed value on context so the handler does not re-parse.
- For abort-early semantics (stub error only), pass `{ abortEarly: true }` to the Validator.
