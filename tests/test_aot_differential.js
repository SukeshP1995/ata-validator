'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { Validator } = require('..');
const { build } = require('../lib/aot-build');

const FIXTURES = path.join(__dirname, 'fixtures/aot-build');
const SCHEMAS = ['simple.schema.json', 'complex.schema.json'];
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
