# Express

ata fits into Express as a small middleware factory. Validate the parsed body before the route handler sees it.

## Install

```bash
npm install ata-validator express
```

## Body validation middleware

```js
const express = require('express')
const { Validator } = require('ata-validator')

function ataBody(schema, opts = {}) {
  const v = new Validator(schema, opts)
  return (req, res, next) => {
    const r = v.validate(req.body)
    if (!r.valid) {
      return res.status(400).json({ error: 'validation failed', errors: r.errors })
    }
    next()
  }
}

const app = express()
app.use(express.json())

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1 },
    email: { type: 'string' },
  },
  required: ['id', 'name', 'email'],
}

app.post('/users', ataBody(userSchema), (req, res) => {
  res.json({ ok: true, id: req.body.id })
})

app.listen(3000)
```

## Abort-early variant

For high-throughput route guards that only need reject / accept:

```js
app.post('/ingest', ataBody(userSchema, { abortEarly: true }), handler)
```

On failure the client receives `{ errors: [{ message: 'validation failed' }] }` without the detailed paths, but the invalid path runs ~4x faster per request.

## Buffer path (raw body)

If the route has `bodyParser.raw({ type: 'application/json' })` the body arrives as a `Buffer`. Use simdjson validation and skip `JSON.parse` for rejected payloads:

```js
const { Validator } = require('ata-validator')

const v = new Validator(userSchema)

app.post(
  '/ingest',
  express.raw({ type: 'application/json', limit: '10mb' }),
  (req, res) => {
    if (!v.isValid(req.body)) {
      return res.status(400).json({ error: 'invalid' })
    }
    const parsed = JSON.parse(req.body.toString())
    // ...
  },
)
```

Useful for webhook endpoints where most traffic is untrusted.

## Query and params

Same pattern, pointing at a different slot on the request:

```js
function ataQuery(schema) {
  const v = new Validator(schema)
  return (req, res, next) => {
    const r = v.validate(req.query)
    if (!r.valid) return res.status(400).json({ errors: r.errors })
    next()
  }
}

app.get('/search', ataQuery({
  type: 'object',
  properties: { q: { type: 'string', minLength: 1 } },
  required: ['q'],
}), handler)
```

## Error formatter

Default errors have ajv's shape (`keyword`, `instancePath`, `params`, `message`). For end-user responses, map to a flatter structure:

```js
function ataBody(schema, opts = {}) {
  const v = new Validator(schema, opts)
  return (req, res, next) => {
    const r = v.validate(req.body)
    if (!r.valid) {
      const issues = r.errors.map((e) => ({
        field: e.instancePath.replace(/^\//, ''),
        message: e.message,
      }))
      return res.status(400).json({ error: 'validation failed', issues })
    }
    next()
  }
}
```

## Notes

- Works identically with Connect-style frameworks (Restify, server applications using Express-style middleware).
- Hold the Validator instance at module scope to reuse the compiled validator across requests.
- For schemas that change per request (very rare), instantiate inside the middleware; the lazy-compile path keeps construction under a microsecond.
