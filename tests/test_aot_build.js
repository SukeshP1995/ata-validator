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
  ]) {
    const [name, fn] = t;
    try { await fn(); console.log(`  PASS  ${name}`); passed++; }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++; }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
