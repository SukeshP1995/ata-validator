# SvelteKit

SvelteKit has two natural places for schema validation: server-side form actions (+page.server.ts) and API routes (+server.ts). ata plugs into both as a small inline check.

## Install

```bash
npm install ata-validator
```

## Form actions

```ts
// src/routes/users/+page.server.ts
import { fail } from '@sveltejs/kit'
import { Validator } from 'ata-validator'
import type { Actions } from './$types'

const userSchema = new Validator({
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    email: { type: 'string' },
    age: { type: 'integer', minimum: 13 },
  },
  required: ['name', 'email'],
})

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData()
    const payload = {
      name: form.get('name'),
      email: form.get('email'),
      age: Number(form.get('age')),
    }

    const result = userSchema.validate(payload)
    if (!result.valid) {
      return fail(400, {
        values: payload,
        errors: result.errors.map((e) => ({
          field: e.instancePath.replace(/^\//, ''),
          message: e.message,
        })),
      })
    }

    await saveUser(payload)
    return { success: true }
  },
}
```

The paired page renders the errors:

```svelte
<!-- src/routes/users/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms'
  export let form
</script>

<form method="POST" use:enhance>
  <input name="name" value={form?.values?.name ?? ''} />
  <input name="email" value={form?.values?.email ?? ''} />
  <input name="age" type="number" value={form?.values?.age ?? ''} />

  {#if form?.errors}
    <ul>
      {#each form.errors as e}<li>{e.field}: {e.message}</li>{/each}
    </ul>
  {/if}

  <button type="submit">Save</button>
</form>
```

## API routes (+server.ts)

```ts
// src/routes/api/users/+server.ts
import { json } from '@sveltejs/kit'
import { Validator } from 'ata-validator'
import type { RequestHandler } from './$types'

const userSchema = new Validator({
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1 },
    email: { type: 'string' },
  },
  required: ['id', 'name', 'email'],
})

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null)
  if (body === null) {
    return json({ error: 'invalid JSON' }, { status: 400 })
  }

  const r = userSchema.validate(body)
  if (!r.valid) {
    return json({ error: 'validation failed', errors: r.errors }, { status: 400 })
  }

  // body is validated, handle it
  return json({ ok: true, id: body.id })
}
```

## Buffer path for edge deploys

Cloudflare Pages + SvelteKit deployments can skip `JSON.parse` on invalid payloads:

```ts
export const POST: RequestHandler = async ({ request }) => {
  const buf = Buffer.from(await request.arrayBuffer())
  if (!userSchema.isValid(buf)) {
    return json({ error: 'invalid' }, { status: 400 })
  }
  const body = JSON.parse(buf.toString())
  return json({ ok: true, id: body.id })
}
```

Requires the native addon, which works on Node adapters. On Cloudflare Workers adapter, the pure JS fallback still rejects correctly but without the simdjson fast path.

## Build-time compile for tight bundles

For Cloudflare Pages or other size-sensitive adapters, pre-compile the schema:

```bash
npx ata compile src/lib/schemas/user.json -o src/lib/schemas/user.validator.mjs --name User
```

```ts
import { json } from '@sveltejs/kit'
import { isValid, type User } from '$lib/schemas/user.validator.mjs'

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  if (!isValid(body)) {
    return json({ error: 'invalid' }, { status: 400 })
  }
  const user: User = body
  return json({ ok: true, id: user.id })
}
```

No `ata-validator` in the runtime bundle, around 1 KB per schema.

## Notes

- Hold Validator instances at module scope in `+page.server.ts` / `+server.ts` files. Module-scope initialization runs once per server start.
- For enhanced forms, return `{ values, errors }` as shown so the page can restore the user's input on failure.
- ata's `coerceTypes: true` helps with form data where everything arrives as strings ("42" -> 42). Pass it when constructing the Validator.
