# Koa

ata drops into Koa as a small middleware. Koa's `ctx` pattern keeps the wiring short.

## Install

```bash
npm install ata-validator koa @koa/router koa-bodyparser
```

## Body validation middleware

```js
const Koa = require('koa')
const Router = require('@koa/router')
const bodyParser = require('koa-bodyparser')
const { Validator } = require('ata-validator')

function ataBody(schema, opts = {}) {
  const v = new Validator(schema, opts)
  return async (ctx, next) => {
    const r = v.validate(ctx.request.body)
    if (!r.valid) {
      ctx.status = 400
      ctx.body = { error: 'validation failed', errors: r.errors }
      return
    }
    await next()
  }
}

const app = new Koa()
const router = new Router()

app.use(bodyParser())

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1 },
    email: { type: 'string' },
  },
  required: ['id', 'name', 'email'],
}

router.post('/users', ataBody(userSchema), (ctx) => {
  ctx.body = { ok: true, id: ctx.request.body.id }
})

app.use(router.routes())
app.listen(3000)
```

## Abort-early for public endpoints

```js
router.post('/ingest', ataBody(userSchema, { abortEarly: true }), handler)
```

Invalid requests return a stub error without walking the schema tree to produce detail, about 4x faster on the invalid path.

## Buffer path (raw body)

Koa does not buffer raw bodies by default. For webhook-style endpoints where you want to skip `JSON.parse` on invalid input, use `raw-body`:

```js
const getRawBody = require('raw-body')
const { Validator } = require('ata-validator')

const v = new Validator(schema)

router.post('/ingest', async (ctx) => {
  const buf = await getRawBody(ctx.req, { limit: '10mb' })
  if (!v.isValid(buf)) {
    ctx.status = 400
    ctx.body = { error: 'invalid' }
    return
  }
  const data = JSON.parse(buf.toString())
  ctx.body = { ok: true, data }
})
```

`isValid(buffer)` uses simdjson on the native addon path, which means malformed or mismatched payloads are rejected without a full JS object tree ever being built.

## Query / params validation

Same middleware, different input:

```js
function ataQuery(schema) {
  const v = new Validator(schema)
  return async (ctx, next) => {
    const r = v.validate(ctx.query)
    if (!r.valid) {
      ctx.status = 400
      ctx.body = { errors: r.errors }
      return
    }
    await next()
  }
}

router.get('/search', ataQuery({
  type: 'object',
  properties: { q: { type: 'string', minLength: 1 } },
  required: ['q'],
}), handler)
```

## Error mapping

ata errors follow the ajv shape. Map to something friendlier if your API surface expects flatter errors:

```js
if (!r.valid) {
  ctx.status = 400
  ctx.body = {
    error: 'validation failed',
    issues: r.errors.map((e) => ({
      field: e.instancePath.replace(/^\//, ''),
      message: e.message,
    })),
  }
  return
}
```

## Notes

- Hold the Validator at module scope. Do not instantiate inside the middleware factory return.
- For JSON files read at startup, pair with `ata compile` to skip the runtime ata-validator dependency on serverless platforms.
- The `coerceTypes: true` and `removeAdditional: true` options still apply and mutate `ctx.request.body` in place.
