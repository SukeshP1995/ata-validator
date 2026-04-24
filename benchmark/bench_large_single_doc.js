#!/usr/bin/env node
'use strict'

/**
 * Single large JSON document: where simdjson's SIMD bulk scan should shine.
 * Scenarios:
 *   A) ajv: JSON.parse(buf) + validate(parsed)  — needs parsed object
 *   B) ata: isValid(buf)                         — bool only, simdjson path
 *   C) ata: JSON.parse(buf) + isValidObject      — two-pass, like ajv
 */

const { Validator } = require('../index')
const Ajv = require('./node_modules/ajv')

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
          role: { type: 'string', enum: ['admin','user','guest'] },
          active: { type: 'boolean' },
          score: { type: 'number', minimum: 0, maximum: 100 },
        },
        required: ['id','name','email'],
      },
    },
  },
  required: ['users'],
}

function makeDoc(nUsers) {
  const users = []
  for (let i = 0; i < nUsers; i++) {
    users.push({
      id: i + 1, name: `user${i}`, email: `u${i}@example.com`,
      age: 20 + (i % 50), role: ['admin','user','guest'][i % 3],
      active: i % 2 === 0, score: 50 + (i % 50),
    })
  }
  return JSON.stringify({ users })
}

function bench(name, fn, rounds) {
  for (let i = 0; i < 5; i++) fn() // warmup
  const t0 = process.hrtime.bigint()
  for (let i = 0; i < rounds; i++) fn()
  const t1 = process.hrtime.bigint()
  const ns = Number(t1 - t0) / rounds
  return { name, ns }
}

function main() {
  const sizes = [1000, 10000, 100000, 500000]

  console.log('Single large document validation')
  console.log('='.repeat(72))

  for (const n of sizes) {
    const doc = makeDoc(n)
    const buffer = Buffer.from(doc)
    const bytes = buffer.length

    const ajv = new Ajv({ allErrors: false })
    const ajvValidate = ajv.compile(schema)
    const v = new Validator(schema)

    // Pick rounds so each bench runs about 2 seconds
    const ataIsValidNs = bench('probe', () => v.isValid(buffer), 20).ns
    const rounds = Math.max(10, Math.ceil(2e9 / Math.max(ataIsValidNs, 1)))

    console.log(`\n--- ${n.toLocaleString()} users, ${(bytes/1024/1024).toFixed(2)} MB, ${rounds} rounds ---`)

    const ajvFull = bench('ajv parse+validate', () => ajvValidate(JSON.parse(doc)), rounds)
    const ataBool = bench('ata isValid (buffer, no parse)', () => v.isValid(buffer), rounds)
    const ataTwoPass = bench('ata JSON.parse + isValidObject', () => v.isValidObject(JSON.parse(doc)), rounds)

    function report(name, ns) {
      const msPerCall = ns / 1e6
      const mbPerSec = (bytes / 1024 / 1024) / (ns / 1e9)
      console.log(`  ${name.padEnd(38)} ${msPerCall.toFixed(3).padStart(8)} ms   ${mbPerSec.toFixed(1).padStart(6)} MB/s`)
      return msPerCall
    }

    const a = report(ajvFull.name, ajvFull.ns)
    const b = report(ataBool.name, ataBool.ns)
    const c = report(ataTwoPass.name, ataTwoPass.ns)

    console.log(`  ata bool vs ajv:       ${(a/b).toFixed(2)}x`)
    console.log(`  ata two-pass vs ajv:   ${(a/c).toFixed(2)}x`)
  }
}

main()
