'use strict'

// CI pipeline simulation: cold process, compile schemas, run validations.
// Measured with mitata for process isolation.

const { bench, group, run, summary, do_not_optimize } = require('mitata')
const { Validator } = require('../index')
const Ajv = require('./node_modules/ajv')
const addFormats = require('./node_modules/ajv-formats')

const schemas = [
  { type: 'object', properties: { id: { type: 'integer', minimum: 1 }, name: { type: 'string', minLength: 1, maxLength: 100 }, email: { type: 'string', format: 'email' }, active: { type: 'boolean' } }, required: ['id', 'name', 'email'] },
  { type: 'object', properties: { title: { type: 'string', minLength: 1 }, price: { type: 'number', minimum: 0 }, currency: { type: 'string', enum: ['USD', 'EUR', 'TRY'] }, tags: { type: 'array', items: { type: 'string' }, maxItems: 10 } }, required: ['title', 'price'] },
  { type: 'object', properties: { query: { type: 'string', minLength: 1 }, page: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, required: ['query'] },
  { type: 'object', properties: { userId: { type: 'integer', minimum: 1 }, items: { type: 'array', items: { type: 'object', properties: { productId: { type: 'integer' }, quantity: { type: 'integer', minimum: 1, maximum: 99 } }, required: ['productId', 'quantity'] }, minItems: 1, maxItems: 50 } }, required: ['userId', 'items'] },
  { type: 'object', properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 } }, required: ['email', 'password'] },
]

const testData = [
  { valid: { id: 1, name: 'Mert', email: 'mert@test.com', active: true }, invalid: { id: -1, name: '', email: 'bad', active: 'no' } },
  { valid: { title: 'Widget', price: 9.99, currency: 'USD', tags: ['sale'] }, invalid: { title: '', price: -1 } },
  { valid: { query: 'test', page: 1, limit: 20 }, invalid: { query: '', page: 0 } },
  { valid: { userId: 1, items: [{ productId: 1, quantity: 2 }] }, invalid: { userId: -1, items: [] } },
  { valid: { email: 'a@b.com', password: '12345678' }, invalid: { email: 'bad', password: '123' } },
]

function runAta(schemaCount, validationsPerSchema) {
  const validators = []
  for (let i = 0; i < schemaCount; i++) {
    validators.push(new Validator(schemas[i % schemas.length]))
  }
  for (let i = 0; i < schemaCount; i++) {
    const data = testData[i % testData.length]
    for (let j = 0; j < validationsPerSchema; j++) {
      do_not_optimize(validators[i].validate(data.valid))
      do_not_optimize(validators[i].validate(data.invalid))
    }
  }
}

function runAjv(schemaCount, validationsPerSchema) {
  const ajv = new Ajv({ allErrors: true })
  addFormats(ajv)
  const validators = []
  for (let i = 0; i < schemaCount; i++) {
    validators.push(ajv.compile(schemas[i % schemas.length]))
  }
  for (let i = 0; i < schemaCount; i++) {
    const data = testData[i % testData.length]
    for (let j = 0; j < validationsPerSchema; j++) {
      do_not_optimize(validators[i](data.valid))
      do_not_optimize(validators[i](data.invalid))
    }
  }
}

summary(() => {
  group('CI: 5 schemas, 100 validations each', () => {
    bench('ata', () => runAta(5, 100))
    bench('ajv', () => runAjv(5, 100))
  })

  group('CI: 20 schemas, 500 validations each', () => {
    bench('ata', () => runAta(20, 500))
    bench('ajv', () => runAjv(20, 500))
  })

  group('CI: 50 schemas, 1000 validations each', () => {
    bench('ata', () => runAta(50, 1000))
    bench('ajv', () => runAjv(50, 1000))
  })
})

run()
