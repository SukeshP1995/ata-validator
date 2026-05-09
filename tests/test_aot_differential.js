'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { Validator } = require('..');
const { build } = require('../lib/aot-build');

const FIXTURES = path.join(__dirname, 'fixtures/aot-build');
const SCHEMAS = [
  'simple.schema.json',
  'complex.schema.json',
  'realworld-user.schema.json',
  'realworld-order.schema.json',
  'realworld-address.schema.json',
  'realworld-paginated.schema.json',
  'realworld-error.schema.json',
];
const DOCS = {
  'simple.schema.json': [
    { id: 1, name: 'ok' },
    { id: 0, name: 'ok' },
    { id: 1 },
    { name: 'no id' },
    'not an object',
    { id: 1, name: '' },
  ],
  'complex.schema.json': [
    { id: 1, name: 'a', email: 'a@b.com', tags: ['t'] },
    { id: 1, name: 'a', email: 'a@b.com', tags: [] },
    { id: 1, name: 'a' },
    { id: 1, name: 'a', email: 'not-an-email', tags: ['t'] },
    { id: 1, name: 'a', email: 'a@b.com', tags: ['t'], 'x-flag': 'on' },
    { id: 1, name: 'a', email: 'a@b.com', tags: ['t'], 'x-flag': 5 },
    { id: 1, name: 'a', email: 'a@b.com', tags: ['t'], extra: 'no' },
  ],
  'realworld-user.schema.json': [
    // valid: all required fields present, valid formats and enum
    { id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com', displayName: 'Alice', role: 'admin' },
    // invalid: extra prop with additionalProperties:false
    { id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com', displayName: 'Alice', role: 'admin', extra: 'no' },
    // invalid: bad uuid format
    { id: 'bad-uuid', email: 'a@b.com', displayName: 'Alice', role: 'admin' },
    // invalid: bad email format
    { id: '550e8400-e29b-41d4-a716-446655440000', email: 'not-an-email', displayName: 'Alice', role: 'admin' },
    // invalid: empty displayName violates minLength
    { id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com', displayName: '', role: 'admin' },
    // invalid: role not in enum
    { id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@b.com', displayName: 'Alice', role: 'banned' },
  ],
  'realworld-order.schema.json': [
    // valid: all required fields, lines has min 1 item, all numeric ranges respected
    { orderId: 'ORD-12345678', customerId: '550e8400-e29b-41d4-a716-446655440000', lines: [{ sku: 'X', quantity: 1, unitPrice: 9.99 }], total: 9.99 },
    // invalid: orderId pattern mismatch (too short)
    { orderId: 'ORD-1234', customerId: '550e8400-e29b-41d4-a716-446655440000', lines: [{ sku: 'X', quantity: 1, unitPrice: 9.99 }], total: 9.99 },
    // invalid: lines empty (minItems: 1)
    { orderId: 'ORD-12345678', customerId: '550e8400-e29b-41d4-a716-446655440000', lines: [], total: 0 },
    // invalid: line quantity violates minimum:1
    { orderId: 'ORD-12345678', customerId: '550e8400-e29b-41d4-a716-446655440000', lines: [{ sku: 'X', quantity: 0, unitPrice: 9.99 }], total: 0 },
  ],
  'realworld-address.schema.json': [
    // valid: all required fields, country in enum
    { line1: '1 Main St', city: 'NYC', postalCode: '10001', country: 'US' },
    // invalid: country not in enum
    { line1: '1 Main St', city: 'NYC', postalCode: '10001', country: 'XX' },
    // invalid: empty line1 violates minLength
    { line1: '', city: 'NYC', postalCode: '10001', country: 'US' },
    // invalid: postalCode too short (minLength: 2)
    { line1: '1 Main St', city: 'NYC', postalCode: '1', country: 'US' },
  ],
  'realworld-paginated.schema.json': [
    // valid: all required, items has elements
    { items: [{ id: '1', name: 'a' }], page: 1, pageSize: 10, total: 1, hasMore: false },
    // valid: empty items array allowed (no minItems)
    { items: [], page: 1, pageSize: 10, total: 0, hasMore: false },
    // invalid: page violates minimum:1
    { items: [{ id: '1', name: 'a' }], page: 0, pageSize: 10, total: 1, hasMore: false },
    // invalid: pageSize > 200
    { items: [{ id: '1', name: 'a' }], page: 1, pageSize: 500, total: 1, hasMore: false },
  ],
  'realworld-error.schema.json': [
    // valid: minimal RFC 7807 error
    { type: 'https://example.com/error', title: 'Bad Request', status: 400 },
    // valid: all optional fields present
    { type: 'https://example.com/error', title: 'Bad Request', status: 400, detail: 'extra info' },
    // invalid: status below minimum:100
    { type: 'https://example.com/error', title: 'Bad Request', status: 99 },
    // invalid: missing required status
    { type: 'https://example.com/error', title: 'Bad Request' },
  ],
};

(async () => {
  let passed = 0, failed = 0;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ata-aot-diff-'));
  for (const schemaFile of SCHEMAS) {
    fs.copyFileSync(path.join(FIXTURES, schemaFile), path.join(dir, schemaFile));
  }
  await build({ globs: [path.join(dir, '*.schema.json')] });

  for (const schemaFile of SCHEMAS) {
    const schema = JSON.parse(fs.readFileSync(path.join(FIXTURES, schemaFile), 'utf8'));
    const runtime = new Validator(schema);
    const stem = schemaFile.replace(/\.schema\.json$/, '');
    const compiledPath = path.join(dir, stem + '.compiled.mjs');
    const aot = await import('file://' + compiledPath);

    for (const doc of DOCS[schemaFile]) {
      const runtimeResult = runtime.validate(doc).valid;
      const aotResult = aot.isValid(doc);
      const name = `differential ${schemaFile} ${JSON.stringify(doc).slice(0, 40)}`;
      if (runtimeResult === aotResult) {
        console.log(`  PASS  ${name}`);
        passed++;
      } else {
        console.log(`  FAIL  ${name}: runtime=${runtimeResult} aot=${aotResult}`);
        failed++;
      }
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
