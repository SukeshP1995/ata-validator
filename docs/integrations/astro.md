# Astro

Astro API routes and form actions both benefit from ata validation. Astro + Vite means the build-time compile path (via [ata-vite](https://github.com/ata-core/ata-vite)) integrates naturally.

## Install

```bash
npm install ata-validator
```

## API route

```ts
// src/pages/api/users.ts
import type { APIRoute } from 'astro'
import { Validator } from 'ata-validator'

const userSchema = new Validator({
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1 },
    email: { type: 'string' },
  },
  required: ['id', 'name', 'email'],
})

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null)
  if (body === null) {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), { status: 400 })
  }

  const r = userSchema.validate(body)
  if (!r.valid) {
    return new Response(
      JSON.stringify({ error: 'validation failed', errors: r.errors }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )
  }

  // body is validated
  return new Response(JSON.stringify({ ok: true, id: body.id }), {
    headers: { 'content-type': 'application/json' },
  })
}
```

## Astro server actions

```ts
// src/actions/index.ts
import { defineAction } from 'astro:actions'
import { Validator } from 'ata-validator'

const userSchema = new Validator({
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string' },
  },
  required: ['name', 'email'],
})

export const server = {
  createUser: defineAction({
    accept: 'form',
    handler: async (input, context) => {
      const payload = {
        name: input.get('name'),
        email: input.get('email'),
      }
      const r = userSchema.validate(payload)
      if (!r.valid) {
        throw new Error(JSON.stringify({ errors: r.errors }))
      }
      await saveUser(payload)
      return { ok: true }
    },
  }),
}
```

## Build-time compile with ata-vite

Astro uses Vite under the hood. `ata-vite` runs during the build and auto-regenerates on save in dev mode:

```ts
// astro.config.mjs
import { defineConfig } from 'astro/config'
import ata from 'ata-vite'

export default defineConfig({
  vite: {
    plugins: [ata({ schemas: 'src/schemas/**/*.json' })],
  },
})
```

With this in place, every `src/schemas/<name>.json` gets a paired `<name>.validator.mjs` + `<name>.validator.d.mts` alongside. Import either:

```ts
// src/pages/api/users.ts
import type { APIRoute } from 'astro'
import { isValid, type User } from '../../schemas/user.validator.mjs'

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json()
  if (!isValid(body)) {
    return new Response(JSON.stringify({ error: 'invalid' }), { status: 400 })
  }
  const user: User = body
  return new Response(JSON.stringify({ ok: true, id: user.id }))
}
```

No ata-validator in the runtime bundle. For Astro on Cloudflare Pages or Vercel Edge, this keeps the deployed artifact small (around 1 KB per schema gzipped).

## Buffer path for high-volume endpoints

```ts
export const POST: APIRoute = async ({ request }) => {
  const buf = Buffer.from(await request.arrayBuffer())
  if (!userSchema.isValid(buf)) {
    return new Response(JSON.stringify({ error: 'invalid' }), { status: 400 })
  }
  const data = JSON.parse(buf.toString())
  return new Response(JSON.stringify({ ok: true, id: data.id }))
}
```

`isValid(buffer)` uses simdjson on the native adapter. On the Node adapter this runs the native addon; on edge adapters the pure JS fallback is used, still correct but without the simdjson fast path.

## Notes

- Module-scope Validator instances are reused across requests, so construction happens once per server process.
- For Astro server actions, throw `ActionError` with the serialized errors so the client receives a typed failure:

```ts
import { ActionError } from 'astro:actions'

if (!r.valid) {
  throw new ActionError({
    code: 'BAD_REQUEST',
    message: JSON.stringify({ errors: r.errors }),
  })
}
```

The client can parse the message to recover field-level detail. Richer per-field error surfacing depends on Astro version; check the current Actions documentation for any newer error-detail APIs.

- The `ata-vite` plugin and Astro's own Vite integration coexist without configuration changes.
