# tRPC

tRPC v11 accepts any [Standard Schema V1](https://standardschema.dev) as procedure input. `ata-validator` implements Standard Schema natively, so a `Validator` instance drops straight into `.input()`.

## Install

```bash
npm install ata-validator @trpc/server
```

## Procedure input

```ts
import { initTRPC } from '@trpc/server'
import { Validator } from 'ata-validator'

const t = initTRPC.create()

const userSchema = new Validator({
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1 },
    email: { type: 'string' },
  },
  required: ['id', 'name', 'email'],
})

export const appRouter = t.router({
  createUser: t.procedure
    .input(userSchema)
    .mutation(({ input }) => {
      // `input` is typed as unknown; add a build-time step to narrow.
      return { ok: true, id: (input as any).id }
    }),
})
```

## Narrowing the input type

`Validator` itself is not parameterized, so `input` comes in as `unknown` by default. Two honest approaches for getting a typed `input`:

### Option 1: compile the schema and use the generated type

```bash
npx ata compile schemas/user.json -o src/user.validator.mjs --name User
```

```ts
import { initTRPC } from '@trpc/server'
import { Validator } from 'ata-validator'
import type { User } from './schemas/user.validator.mjs'
import userSchemaJson from './schemas/user.json' with { type: 'json' }

const t = initTRPC.create()
const userSchema = new Validator(userSchemaJson)

export const appRouter = t.router({
  createUser: t.procedure
    .input(userSchema)
    .mutation(({ input }) => {
      const user = input as User  // runtime-validated, type-asserted
      return { ok: true, id: user.id }
    }),
})
```

The cast is safe because `.input(userSchema)` has already run the validator; if `input` is reachable, the shape matches `User`.

### Option 2: skip the runtime validator, use the compiled one only

If the schema is static, the compiled module has both the type and a runtime check. You can bypass `t.procedure.input()` entirely:

```ts
import { initTRPC } from '@trpc/server'
import { TRPCError } from '@trpc/server'
import { isValid, type User } from './schemas/user.validator.mjs'

const t = initTRPC.create()

export const appRouter = t.router({
  createUser: t.procedure
    .mutation(({ rawInput }) => {
      if (!isValid(rawInput)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid input' })
      }
      // `rawInput` is narrowed to User here by the type predicate.
      return { ok: true, id: rawInput.id }
    }),
})
```

Trade-off: loses tRPC's automatic error formatting, gains direct narrowing and no runtime dependency on `ata-validator`.

## Error shape

tRPC surfaces validation failures as `TRPCError` with code `BAD_REQUEST`. ata's Standard Schema `issues` array maps to tRPC's default error formatter. Each issue has `message` and `path`:

```json
{
  "code": "BAD_REQUEST",
  "issues": [
    { "message": "must be >= 1", "path": ["id"] }
  ]
}
```

Override via `errorFormatter` in `initTRPC.create()` if the default is too verbose.

## Notes

- Versions before tRPC v11 do not support Standard Schema directly. For v10, wrap the Validator manually in a function that matches the legacy validator contract.
- Using `ata compile` for both the runtime validator and types keeps the schema file as the single source of truth.
- abortEarly mode works as input validator but discards the detailed `issues` list, so the client only sees "validation failed". Good for high-throughput internal endpoints, bad for public API with informative error responses.
