'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Validator } = require('..');

async function expandGlobs(globs) {
  const out = [];
  for (const g of globs) {
    if (typeof fs.promises.glob === 'function') {
      // Node 22+
      for await (const f of fs.promises.glob(g)) out.push(path.resolve(f));
    } else {
      // Node 18-21 fallback: simple non-recursive directory + extension match
      // Pattern accepted: '<dir>/*.<ext>' or absolute file path.
      if (fs.existsSync(g) && fs.statSync(g).isFile()) {
        out.push(path.resolve(g));
        continue;
      }
      const m = g.match(/^(.*?)(?:\/\*\.(.+))?$/);
      const dir = m && m[1] ? m[1] : '.';
      const ext = m && m[2] ? '.' + m[2] : null;
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir)) {
        if (ext && !entry.endsWith(ext)) continue;
        const full = path.join(dir, entry);
        if (fs.statSync(full).isFile()) out.push(path.resolve(full));
      }
    }
  }
  return [...new Set(out)];
}

function parseSchemaFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return JSON.parse(text);
  throw new Error(`unsupported schema extension: ${ext} (file: ${filePath})`);
}

function outputPathFor(input, opts) {
  const suffix = opts.suffix || '.compiled';
  const ext = opts.format === 'cjs' ? '.cjs' : '.mjs';
  const dir = opts.outDir || path.dirname(input);
  const base = path.basename(input, path.extname(input));
  // Strip a trailing ".schema" for cleaner output names: foo.schema.json -> foo.compiled.mjs
  const stem = base.endsWith('.schema') ? base.slice(0, -('.schema'.length)) : base;
  return path.join(dir, stem + suffix + ext);
}

function readCache(cacheFile) {
  if (!cacheFile || !fs.existsSync(cacheFile)) return {};
  try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { return {}; }
}

function writeCache(cacheFile, data) {
  if (!cacheFile) return;
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
}

function hashContent(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32);
}

async function build(opts) {
  const globs = opts.globs || [];
  if (globs.length === 0) throw new Error('build: at least one glob required');
  const format = opts.format || 'esm';
  const inputs = await expandGlobs(globs);
  const cache = readCache(opts.cacheFile);
  const newCache = {};

  const compiled = [];
  const cached = [];
  const skipped = [];
  const failed = [];

  for (const input of inputs) {
    try {
      const raw = fs.readFileSync(input);
      const inputHash = hashContent(raw);
      const output = outputPathFor(input, { ...opts, format });
      const cacheEntry = cache[input];
      if (opts.check) {
        const upToDate = (
          cacheEntry &&
          cacheEntry.inputHash === inputHash &&
          cacheEntry.output === output &&
          fs.existsSync(output) &&
          cacheEntry.outputHash === hashContent(fs.readFileSync(output))
        );
        if (upToDate) {
          cached.push({ input, output });
        }
        continue;
      }
      if (
        cacheEntry &&
        cacheEntry.inputHash === inputHash &&
        cacheEntry.output === output &&
        fs.existsSync(output) &&
        cacheEntry.outputHash === hashContent(fs.readFileSync(output))
      ) {
        cached.push({ input, output });
        newCache[input] = cacheEntry;
        continue;
      }
      const schema = parseSchemaFile(input);
      const v = new Validator(schema);
      const src = v.toStandaloneModule({ format, abortEarly: !!opts.abortEarly });
      if (!src) {
        skipped.push({ input, reason: 'schema is not AOT-compatible (toStandaloneModule returned null)' });
        continue;
      }
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, src);
      const outBytes = Buffer.byteLength(src, 'utf8');
      compiled.push({ input, output, bytes: outBytes });
      newCache[input] = {
        inputHash,
        output,
        outputHash: hashContent(Buffer.from(src, 'utf8')),
      };
    } catch (e) {
      failed.push({ input, error: e.message });
    }
  }

  if (opts.check) {
    const staleCount = inputs.length - cached.length;
    return { compiled: [], cached, skipped, failed, staleCount };
  }

  writeCache(opts.cacheFile, newCache);

  return { compiled, cached, skipped, failed };
}

module.exports = { build, expandGlobs, parseSchemaFile, outputPathFor };
