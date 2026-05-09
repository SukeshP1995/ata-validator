'use strict';

// Simulates an environment without the native addon (Cloudflare Workers,
// browser, Bun without N-API). The fix landed for issue #22 keeps the invalid
// path on a pure-JS branch instead of dereferencing a null _compiled.
//
// This test runs in a fresh Node process with `pkg-prebuilds` resolution
// blocked, so `native` ends up null inside index.js.

const { spawnSync } = require('child_process');
const path = require('path');

const child = `
  const Module = require('module');
  const orig = Module._resolveFilename;
  Module._resolveFilename = function(id, ...rest) {
    if (id === 'pkg-prebuilds') throw new Error('not in this env');
    return orig.call(this, id, ...rest);
  };
  const { Validator, validate } = require(${JSON.stringify(path.join(__dirname, '..', 'index.js'))});

  let passed = 0, failed = 0;
  function assert(cond, msg) {
    if (cond) passed++;
    else { console.log('  FAIL ' + msg); failed++; }
  }

  console.log('\\nata no-native (Workers-style) tests\\n');

  // --- Reporter's schema from issue #22 ---
  const schema = {
    type: 'object',
    required: ['basics'],
    properties: {
      basics: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string', minLength: 1 } }
      }
    }
  };

  // valid
  const r1 = validate(schema, { basics: { name: 'Wind' } });
  assert(r1.valid === true, 'valid input → valid:true (got ' + JSON.stringify(r1) + ')');

  // invalid — missing nested required
  let r2;
  try { r2 = validate(schema, { basics: {} }); }
  catch (e) {
    console.log('  FAIL invalid input threw: ' + e.message);
    failed++;
  }
  if (r2) {
    assert(r2.valid === false, 'invalid input → valid:false');
    assert(Array.isArray(r2.errors) && r2.errors.length > 0, 'invalid input has at least one error');
    assert(typeof r2.errors[0].message === 'string', 'error has a message');
  }

  // invalid — missing top-level required
  let r3;
  try { r3 = validate(schema, {}); }
  catch (e) {
    console.log('  FAIL empty input threw: ' + e.message);
    failed++;
  }
  if (r3) {
    assert(r3.valid === false, 'empty input → valid:false');
    assert(Array.isArray(r3.errors) && r3.errors.length > 0, 'empty input has at least one error');
  }

  // --- Validator class direct ---
  const v = new Validator({ type: 'string', minLength: 3 });
  const r4 = v.validate('abc');
  assert(r4.valid === true, 'Validator class valid path');
  const r5 = v.validate('a');
  assert(r5.valid === false, 'Validator class invalid path');
  assert(Array.isArray(r5.errors) && r5.errors.length > 0, 'Validator class invalid has errors');

  console.log('  PASS ' + passed + ' / FAIL ' + failed);
  if (failed > 0) process.exit(1);
`;

const result = spawnSync(process.execPath, ['-e', child], {
  stdio: 'inherit',
});
process.exit(result.status === null ? 1 : result.status);
