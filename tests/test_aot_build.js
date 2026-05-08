'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { build } = require('../lib/aot-build');

let passed = 0, failed = 0;
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ata-aot-build-'));
}

console.log('\nata aot build tests\n');

(async () => {
  for (const t of [
    ['build: emits per-file modules from glob', async () => {
      const dir = tmpDir();
      const src = path.join(dir, 'user.schema.json');
      fs.copyFileSync(path.join(__dirname, 'fixtures/aot-build/simple.schema.json'), src);
      const report = await build({ globs: [path.join(dir, '*.schema.json')] });
      assert(report.compiled.length === 1, `expected 1 compiled, got ${report.compiled.length}`);
      const out = path.join(dir, 'user.compiled.mjs');
      assert(fs.existsSync(out), `expected ${out} to exist`);
      const src2 = fs.readFileSync(out, 'utf8');
      assert(src2.includes('export'), 'output should contain ESM export');
    }],

    ['build: emits one module per input across a glob', async () => {
      const dir = tmpDir();
      fs.copyFileSync(path.join(__dirname, 'fixtures/aot-build/simple.schema.json'), path.join(dir, 'a.schema.json'));
      fs.copyFileSync(path.join(__dirname, 'fixtures/aot-build/complex.schema.json'), path.join(dir, 'b.schema.json'));
      const report = await build({ globs: [path.join(dir, '*.schema.json')] });
      assert(report.compiled.length === 2, `expected 2 compiled, got ${report.compiled.length}`);
      assert(fs.existsSync(path.join(dir, 'a.compiled.mjs')), 'a.compiled.mjs missing');
      assert(fs.existsSync(path.join(dir, 'b.compiled.mjs')), 'b.compiled.mjs missing');
    }],

    ['build: complex schema (format + patternProperties) compiles to a working validator', async () => {
      const dir = tmpDir();
      fs.copyFileSync(path.join(__dirname, 'fixtures/aot-build/complex.schema.json'), path.join(dir, 'order.schema.json'));
      const report = await build({ globs: [path.join(dir, '*.schema.json')] });
      assert(report.compiled.length === 1, `expected 1 compiled, got ${report.compiled.length}`);
      const out = path.join(dir, 'order.compiled.mjs');
      const mod = await import('file://' + out);
      assert(typeof mod.validate === 'function', 'validate export missing');
      const validDoc = { id: 1, name: 'a', email: 'a@b.com', tags: ['t'] };
      assert(mod.validate(validDoc).valid === true, 'valid doc should pass');
      assert(mod.validate({ id: 0 }).valid === false, 'invalid doc should fail');
    }],
  ]) {
    const [name, fn] = t;
    try { await fn(); console.log(`  PASS  ${name}`); passed++; }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++; }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
