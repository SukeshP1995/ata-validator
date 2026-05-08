'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'bin', 'ata.js');
const FIXTURES = path.join(__dirname, 'fixtures/aot-build');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}: ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ata-aot-cli-')); }

console.log('\nata aot CLI build tests\n');

test('cli: build emits per-file modules from glob arg', () => {
  const dir = tmpDir();
  fs.copyFileSync(path.join(FIXTURES, 'simple.schema.json'), path.join(dir, 'a.schema.json'));
  fs.copyFileSync(path.join(FIXTURES, 'complex.schema.json'), path.join(dir, 'b.schema.json'));
  const res = spawnSync('node', [CLI, 'build', path.join(dir, '*.schema.json')], { encoding: 'utf8' });
  assert(res.status === 0, `cli exit ${res.status}: ${res.stderr}`);
  assert(fs.existsSync(path.join(dir, 'a.compiled.mjs')), 'a.compiled.mjs missing');
  assert(fs.existsSync(path.join(dir, 'b.compiled.mjs')), 'b.compiled.mjs missing');
});

test('cli: build prints a summary line per compiled file', () => {
  const dir = tmpDir();
  fs.copyFileSync(path.join(FIXTURES, 'simple.schema.json'), path.join(dir, 'x.schema.json'));
  const res = spawnSync('node', [CLI, 'build', path.join(dir, '*.schema.json')], { encoding: 'utf8' });
  assert(res.status === 0, `cli exit ${res.status}: ${res.stderr}`);
  assert(/x\.schema\.json/.test(res.stdout), `stdout missing input mention: ${res.stdout}`);
  assert(/x\.compiled\.mjs/.test(res.stdout), `stdout missing output mention: ${res.stdout}`);
});

test('cli: build --out-dir routes outputs', () => {
  const dir = tmpDir();
  const outDir = tmpDir();
  fs.copyFileSync(path.join(FIXTURES, 'simple.schema.json'), path.join(dir, 'q.schema.json'));
  const res = spawnSync('node', [CLI, 'build', path.join(dir, '*.schema.json'), '--out-dir', outDir], { encoding: 'utf8' });
  assert(res.status === 0, `cli exit ${res.status}: ${res.stderr}`);
  assert(fs.existsSync(path.join(outDir, 'q.compiled.mjs')), 'output not in --out-dir');
});

test('cli: build --check exits 1 when stale', () => {
  const dir = tmpDir();
  fs.copyFileSync(path.join(FIXTURES, 'simple.schema.json'), path.join(dir, 'k.schema.json'));
  const res = spawnSync('node', [CLI, 'build', path.join(dir, '*.schema.json'), '--check'], { encoding: 'utf8' });
  assert(res.status === 1, `expected exit 1 (stale), got ${res.status}`);
  assert(/stale/.test(res.stdout), `expected 'stale' in stdout: ${res.stdout}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
