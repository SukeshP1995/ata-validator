#!/usr/bin/env node
'use strict'

/**
 * Fastify with ata + abortEarly vs Fastify default (ajv).
 * Measures req/s for valid and invalid payloads on a realistic schema.
 */

const { Validator } = require('../index')
const autocannon = require('autocannon')

const DURATION = 5
const CONNECTIONS = 10
const PIPELINING = 10

const schema = {
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1, maxLength: 100 },
    email: { type: 'string' },
    age: { type: 'integer', minimum: 0, maximum: 150 },
    role: { type: 'string', enum: ['admin', 'user', 'guest'] },
    active: { type: 'boolean' },
    score: { type: 'number', minimum: 0, maximum: 100 },
    tag: { type: 'string', maxLength: 20 },
    createdAt: { type: 'string' },
    flags: { type: 'string' },
  },
  required: ['id', 'name', 'email'],
}

const validBody = JSON.stringify({
  id: 42, name: 'alice', email: 'a@b.com', age: 30, role: 'user',
  active: true, score: 88.5, tag: 't1', createdAt: '2026-04-24', flags: 'x',
})
const invalidBody = JSON.stringify({
  id: -1, name: '', email: 123, age: 999, role: 'unknown',
})

function ataCompiler(abortEarly) {
  return ({ schema }) => {
    const v = new Validator(schema, { abortEarly })
    return function validate(data) {
      const r = v.validate(data)
      if (r.valid) return { value: data }
      const err = new Error(r.errors.map(e => e.message).join(', '))
      err.validation = r.errors
      return { error: err }
    }
  }
}

function run(port, body, label) {
  return new Promise((resolve) => {
    const instance = autocannon({
      url: `http://127.0.0.1:${port}/u`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      duration: DURATION,
      connections: CONNECTIONS,
      pipelining: PIPELINING,
    }, (err, result) => {
      if (err) throw err
      console.log(`  ${label.padEnd(36)} ${result.requests.average.toLocaleString().padStart(10)} req/s  p99 ${result.latency.p99.toFixed(2)}ms`)
      resolve(result)
    })
    autocannon.track(instance, { renderProgressBar: false, renderLatencyTable: false, renderResultsTable: false })
  })
}

async function main() {
  const Fastify = require('fastify')

  const ajvSrv = Fastify({ logger: false })
  ajvSrv.post('/u', { schema: { body: schema } }, async () => ({ ok: true }))
  await ajvSrv.listen({ port: 3301, host: '127.0.0.1' })

  const ataSrv = Fastify({ logger: false })
  ataSrv.setValidatorCompiler(ataCompiler(false))
  ataSrv.post('/u', { schema: { body: schema } }, async () => ({ ok: true }))
  await ataSrv.listen({ port: 3302, host: '127.0.0.1' })

  const ataAbortSrv = Fastify({ logger: false })
  ataAbortSrv.setValidatorCompiler(ataCompiler(true))
  ataAbortSrv.post('/u', { schema: { body: schema } }, async () => ({ ok: true }))
  await ataAbortSrv.listen({ port: 3303, host: '127.0.0.1' })

  console.log('\nFastify: ajv vs ata vs ata+abortEarly')
  console.log('='.repeat(64))
  console.log(`${DURATION}s, ${CONNECTIONS} connections, pipelining=${PIPELINING}\n`)

  await run(3301, validBody, 'warmup ajv')
  await run(3302, validBody, 'warmup ata')
  await run(3303, validBody, 'warmup ata+abortEarly')
  console.log('')

  console.log('Valid payload:')
  const a1 = await run(3301, validBody, 'Fastify + ajv')
  const b1 = await run(3302, validBody, 'Fastify + ata')
  const c1 = await run(3303, validBody, 'Fastify + ata + abortEarly')
  console.log(`  ata/ajv: ${(b1.requests.average / a1.requests.average).toFixed(2)}x | ata-abort/ajv: ${(c1.requests.average / a1.requests.average).toFixed(2)}x\n`)

  console.log('Invalid payload (most interesting for abort-early):')
  const a2 = await run(3301, invalidBody, 'Fastify + ajv')
  const b2 = await run(3302, invalidBody, 'Fastify + ata')
  const c2 = await run(3303, invalidBody, 'Fastify + ata + abortEarly')
  console.log(`  ata/ajv: ${(b2.requests.average / a2.requests.average).toFixed(2)}x | ata-abort/ajv: ${(c2.requests.average / a2.requests.average).toFixed(2)}x\n`)

  await ajvSrv.close()
  await ataSrv.close()
  await ataAbortSrv.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
