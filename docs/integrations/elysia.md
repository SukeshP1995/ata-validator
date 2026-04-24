# Elysia

[Elysia](https://elysiajs.com) uses TypeBox for its built-in validation. ata is useful when you have schemas coming from outside (OpenAPI specs, JSON Schema Store, shared registries) that you do not want to translate to TypeBox.

The recommended pattern is a direct handler check. No framework hook required.

## Install

```bash
bun add ata-validator
```

## Direct handler usage

```ts
import { Elysia } from 'elysia'
import { Validator } from 'ata-validator'

const userSchema = new Validator({
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1 },
    email: { type: 'string' },
    role: { type: 'string', enum: ['admin', 'user', 'guest'] },
  },
  required: ['id', 'name', 'email'],
})

const app = new Elysia()
  .post('/users', ({ body, set }) => {
    const r = userSchema.validate(body)
    if (!r.valid) {
      set.status = 400
      return { error: 'validation failed', errors: r.errors }
    }
    return { ok: true, id: (body as any).id }
  })
  .listen(3000)
```

## As a reusable derive

Elysia's `derive` adds computed values to context. Wrap the validation there when multiple routes use the same schema:

```ts
import { Elysia } from 'elysia'
import { Validator } from 'ata-validator'

const userSchema = new Validator({ /* ... */ })

function validatedUser() {
  return (app: Elysia) =>
    app.derive(async ({ body, set }) => {
      const r = userSchema.validate(body)
      if (!r.valid) {
        set.status = 400
        throw new Error(JSON.stringify({ errors: r.errors }))
      }
      return { user: body as { id: number; name: string; email: string } }
    })
}

new Elysia()
  .use(validatedUser())
  .post('/users', ({ user }) => ({ ok: true, id: user.id }))
```

## Buffer path

Elysia exposes `request` for raw access. For high-throughput endpoints, validate the raw body buffer with simdjson before parsing:

```ts
import { Validator } from 'ata-validator'

const v = new Validator(schema)

new Elysia()
  .post('/ingest', async ({ request, set }) => {
    const buf = Buffer.from(await request.arrayBuffer())
    if (!v.isValid(buf)) { set.status = 400; return { ok: false } }
    return { ok: true, data: JSON.parse(buf.toString()) }
  })
```

## Build-time compile for edge deploys

Elysia on Bun + edge runtimes benefits from pre-compiled validators. Run `ata compile` during build and import the generated module directly:

```bash
npx ata compile schemas/user.json -o src/user.validator.mjs --name User
```

```ts
import { Elysia } from 'elysia'
import { isValid, type User } from './schemas/user.validator.mjs'

new Elysia()
  .post('/users', ({ body, set }) => {
    if (!isValid(body)) { set.status = 400; return { ok: false } }
    const user: User = body
    return { ok: true, id: user.id }
  })
```

No `ata-validator` in the runtime bundle, around 1 KB per schema.

## Notes

- TypeBox integration in Elysia remains the idiomatic path for schemas defined in code. Use ata for schemas that live in JSON files.
- Standard Schema V1 support in Elysia is tracked upstream; once available, `userSchema` can be passed directly to Elysia's schema slot without the inline check.
- For type-safe `body` inside the handler, either cast manually or use the build-time compile path which gives `isValid` as a type predicate.
