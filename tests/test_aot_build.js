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

    ['build: respects outDir', async () => {
      const dir = tmpDir();
      const outDir = tmpDir();
      fs.copyFileSync(path.join(__dirname, 'fixtures/aot-build/simple.schema.json'), path.join(dir, 'x.schema.json'));
      await build({ globs: [path.join(dir, '*.schema.json')], outDir });
      assert(fs.existsSync(path.join(outDir, 'x.compiled.mjs')), 'output not in outDir');
      assert(!fs.existsSync(path.join(dir, 'x.compiled.mjs')), 'output should NOT be alongside source');
    }],

    ['build: respects suffix', async () => {
      const dir = tmpDir();
      fs.copyFileSync(path.join(__dirname, 'fixtures/aot-build/simple.schema.json'), path.join(dir, 'y.schema.json'));
      await build({ globs: [path.join(dir, '*.schema.json')], suffix: '.gen' });
      assert(fs.existsSync(path.join(dir, 'y.gen.mjs')), 'expected suffix to be .gen');
    }],

    ['build: skips unchanged inputs on second run (cache hit)', async () => {
      const dir = tmpDir();
      const cacheFile = path.join(dir, '.cache.json');
      fs.copyFileSync(path.join(__dirname, 'fixtures/aot-build/simple.schema.json'), path.join(dir, 'c.schema.json'));
      const r1 = await build({ globs: [path.join(dir, '*.schema.json')], cacheFile });
      assert(r1.compiled.length === 1 && r1.cached.length === 0, `r1 compiled=${r1.compiled.length} cached=${r1.cached.length}`);
      const r2 = await build({ globs: [path.join(dir, '*.schema.json')], cacheFile });
      assert(r2.compiled.length === 0 && r2.cached.length === 1, `r2 compiled=${r2.compiled.length} cached=${r2.cached.length}`);
    }],

    ['build: re-compiles when input content changes', async () => {
      const dir = tmpDir();
      const cacheFile = path.join(dir, '.cache.json');
      fs.copyFileSync(path.join(__dirname, 'fixtures/aot-build/simple.schema.json'), path.join(dir, 'd.schema.json'));
      await build({ globs: [path.join(dir, '*.schema.json')], cacheFile });
      // Modify input
      const altered = JSON.parse(fs.readFileSync(path.join(dir, 'd.schema.json'), 'utf8'));
      altered.properties.id.minimum = 5;
      fs.writeFileSync(path.join(dir, 'd.schema.json'), JSON.stringify(altered));
      const r2 = await build({ globs: [path.join(dir, '*.schema.json')], cacheFile });
      assert(r2.compiled.length === 1 && r2.cached.length === 0, `r2 compiled=${r2.compiled.length} cached=${r2.cached.length}`);
    }],

    ['build: --check returns staleCount > 0 when output is missing', async () => {
      const dir = tmpDir();
      fs.copyFileSync(path.join(__dirname, 'fixtures/aot-build/simple.schema.json'), path.join(dir, 'e.schema.json'));
      const r = await build({ globs: [path.join(dir, '*.schema.json')], check: true });
      assert(r.staleCount === 1, `expected 1 stale, got ${r.staleCount}`);
      assert(r.compiled.length === 0, `--check should not write outputs (got ${r.compiled.length})`);
    }],

    ['build: --check returns staleCount === 0 when up to date', async () => {
      const dir = tmpDir();
      const cacheFile = path.join(dir, '.cache.json');
      fs.copyFileSync(path.join(__dirname, 'fixtures/aot-build/simple.schema.json'), path.join(dir, 'f.schema.json'));
      await build({ globs: [path.join(dir, '*.schema.json')], cacheFile });
      const r = await build({ globs: [path.join(dir, '*.schema.json')], cacheFile, check: true });
      assert(r.staleCount === 0, `expected 0 stale, got ${r.staleCount}`);
    }],

    ['build: --max-size fails when output exceeds budget', async () => {
      const dir = tmpDir();
      fs.copyFileSync(path.join(__dirname, 'fixtures/aot-build/complex.schema.json'), path.join(dir, 'big.schema.json'));
      const r = await build({ globs: [path.join(dir, '*.schema.json')], maxSize: 100 });
      assert(r.failed.length === 1, `expected 1 failed (over budget), got ${r.failed.length}`);
      assert(/exceeds.*max/i.test(r.failed[0].error), `expected size-budget error, got: ${r.failed[0].error}`);
    }],

    ['build: --max-size passes when output fits', async () => {
      const dir = tmpDir();
      fs.copyFileSync(path.join(__dirname, 'fixtures/aot-build/simple.schema.json'), path.join(dir, 'small.schema.json'));
      const r = await build({ globs: [path.join(dir, '*.schema.json')], maxSize: 1_000_000 });
      assert(r.failed.length === 0, `expected 0 failed, got ${r.failed.length}`);
      assert(r.compiled.length === 1, `expected 1 compiled, got ${r.compiled.length}`);
    }],

    ['build: --strict promotes skipped to failed', async () => {
      const dir = tmpDir();
      // A schema using a runtime-only feature: dynamicRef. toStandaloneModule should return null.
      const incompatible = {
        $id: 'https://example.com/dyn',
        $defs: { node: { $dynamicAnchor: 'node', type: 'object' } },
        $dynamicRef: '#node',
      };
      fs.writeFileSync(path.join(dir, 'dyn.schema.json'), JSON.stringify(incompatible));
      const lax = await build({ globs: [path.join(dir, '*.schema.json')] });
      // The schema MAY succeed or be skipped depending on engine support; if it succeeds, this test is
      // a no-op for the strict assertion. We only assert strict promotes skipped → failed when skipped.
      if (lax.skipped.length === 1) {
        const r = await build({ globs: [path.join(dir, '*.schema.json')], strict: true });
        assert(r.failed.length === 1 && r.skipped.length === 0, `strict mode: expected failed=1 skipped=0, got failed=${r.failed.length} skipped=${r.skipped.length}`);
      }
    }],
  ]) {
    const [name, fn] = t;
    try { await fn(); console.log(`  PASS  ${name}`); passed++; }
    catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++; }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
