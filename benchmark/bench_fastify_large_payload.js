#!/usr/bin/env node
'use strict'

/**
 * Does ata's simdjson buffer path win on large payloads where V8's JSON.parse
 * cannot hide behind micro-optimization?
 *
 * Compare:
 *   A) Fastify default: Fastify parses JSON, ajv validates the parsed object
 *   B) ata two-pass:    buffer content parser + isValid(buf) + JSON.parse
 *   C) ata single-pass: validateAndParse(buf) as content parser
 */

const { Validator } = require('../index')
const autocannon = require('autocannon')

const DURATION = 4
const CONNECTIONS = 10
const PIPELINING = 1 // pipelining=1 for clean large-payload measurement

const schema = {
  type: 'object',
  properties: {
    users: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer', minimum: 1 },
          name: { type: 'string', minLength: 1 },
          email: { type: 'string' },
          age: { type: 'integer', minimum: 0, maximum: 150 },
          role: { type: 'string', enum: ['admin', 'user', 'guest'] },
          active: { type: 'boolean' },
          score: { type: 'number', minimum: 0, maximum: 100 },
        },
        required: ['id', 'name', 'email'],
      },
    },
  },
  required: ['users'],
}

function makePayload(n) {
  const users = []
  for (let i = 0; i < n; i++) {
    users.push({
      id: i + 1, name: `user${i}`, email: `u${i}@example.com`,
      age: 20 + (i % 50), role: ['admin','user','guest'][i % 3],
      active: i % 2 === 0, score: 50 + (i % 50),
    })
  }
  return JSON.stringify({ users })
}

function run(port, body, label) {
  return new Promise((resolve) => {
    const inst = autocannon({
      url: `http://127.0.0.1:${port}/v`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      duration: DURATION,
      connections: CONNECTIONS,
      pipelining: PIPELINING,
    }, (err, res) => {
      if (err) throw err
      console.log(`  ${label.padEnd(40)} ${res.requests.average.toLocaleString().padStart(10)} req/s  p99 ${res.latency.p99.toFixed(2)}ms`)
      resolve(res)
    })
    autocannon.track(inst, { renderProgressBar: false, renderLatencyTable: false, renderResultsTable: false })
  })
}

async function main() {
  const Fastify = require('fastify')

  // A) Fastify default (ajv)
  const ajvSrv = Fastify({ logger: false, bodyLimit: 5 * 1024 * 1024 })
  ajvSrv.post('/v', { schema: { body: schema } }, async () => ({ ok: true }))
  await ajvSrv.listen({ port: 3401, host: '127.0.0.1' })

  // B) ata two-pass: simdjson isValid + V8 JSON.parse
  const ataTwoPass = Fastify({ logger: false, bodyLimit: 5 * 1024 * 1024 })
  const vTwoPass = new Validator(schema)
  ataTwoPass.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => done(null, body))
  ataTwoPass.post('/v', async (req, reply) => {
    if (!vTwoPass.isValid(req.body)) { reply.code(400); return { ok: false } }
    return { ok: true }
  })
  await ataTwoPass.listen({ port: 3402, host: '127.0.0.1' })

  // C) ata single-pass: validateAndParse
  const ataSinglePass = Fastify({ logger: false, bodyLimit: 5 * 1024 * 1024 })
  const vSingle = new Validator(schema)
  ataSinglePass.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    const r = vSingle.validateAndParse(body)
    if (!r.valid) return done(Object.assign(new Error('invalid'), { statusCode: 400 }))
    done(null, r.value)
  })
  ataSinglePass.post('/v', async () => ({ ok: true }))
  await ataSinglePass.listen({ port: 3403, host: '127.0.0.1' })

  console.log('\nFastify large-payload pipeline: ajv vs ata two-pass vs ata single-pass')
  console.log('='.repeat(72))
  console.log(`${DURATION}s, ${CONNECTIONS} connections, pipelining=${PIPELINING}\n`)

  const sizes = [1, 10, 100, 500]
  for (const n of sizes) {
    const body = makePayload(n)
    console.log(`--- ${n} users, ${body.length.toLocaleString()} bytes ---`)
    await run(3401, body, 'warmup ajv')
    await run(3402, body, 'warmup ata two-pass')
    await run(3403, body, 'warmup ata single-pass')
    console.log('')
    const a = await run(3401, body, 'Fastify + ajv')
    const b = await run(3402, body, 'Fastify + ata (isValid buf + parse)')
    const c = await run(3403, body, 'Fastify + ata (validateAndParse)')
    console.log(`  ata two-pass vs ajv:    ${(b.requests.average / a.requests.average).toFixed(2)}x`)
    console.log(`  ata single-pass vs ajv: ${(c.requests.average / a.requests.average).toFixed(2)}x\n`)
  }

  await ajvSrv.close()
  await ataTwoPass.close()
  await ataSinglePass.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
