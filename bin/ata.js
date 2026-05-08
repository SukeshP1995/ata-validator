#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function usage() {
  process.stdout.write(`ata-validator CLI

Usage:
  ata compile <schema-file> [options]   Compile one schema to a standalone module.
  ata build   <glob>...    [options]    Compile a project's schemas (glob pattern) per file.

Compile options:
  -o, --output <file>     Output path. Default: <schema-file>.validator.mjs
  -f, --format <fmt>      Module format: esm | cjs. Default: esm
  --name <TypeName>       Name of the top-level type in .d.ts. Default: inferred from filename
  --no-types              Skip .d.ts generation
  --abort-early           Use stub errors (smallest bundle)

Build options:
  --out-dir <dir>         Write outputs into this directory instead of alongside sources
  --suffix <str>          Output filename suffix (default: ".compiled")
  -f, --format <fmt>      Module format: esm | cjs. Default: esm
  --abort-early           Use stub errors (smallest bundle)

  -h, --help              Show this message

Examples:
  ata compile schemas/user.json -o src/generated/user.validator.mjs
  ata build 'schemas/*.json'
  ata build 'src/**/*.schema.json' --out-dir build/validators
`);
}

function parseArgs(argv) {
  const out = { _: [], opts: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { out.opts.help = true; continue; }
    if (a === '-o' || a === '--output') { out.opts.output = argv[++i]; continue; }
    if (a === '-f' || a === '--format') { out.opts.format = argv[++i]; continue; }
    if (a === '--name') { out.opts.name = argv[++i]; continue; }
    if (a === '--no-types') { out.opts.types = false; continue; }
    if (a === '--abort-early') { out.opts.abortEarly = true; continue; }
    if (a === '--out-dir') { out.opts.outDir = argv[++i]; continue; }
    if (a === '--suffix') { out.opts.suffix = argv[++i]; continue; }
    if (a.startsWith('-')) { throw new Error(`Unknown option: ${a}`); }
    out._.push(a);
  }
  return out;
}

function inferOutput(inputPath, format) {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const ext = format === 'cjs' ? '.validator.cjs' : '.validator.mjs';
  return path.join(dir, base + ext);
}

function cmdCompile(args) {
  if (args._.length === 0) {
    process.stderr.write('error: missing <schema-file>\n\n');
    usage();
    process.exit(1);
  }
  const input = args._[0];
  const format = args.opts.format || 'esm';
  if (format !== 'esm' && format !== 'cjs') {
    process.stderr.write(`error: --format must be esm or cjs (got "${format}")\n`);
    process.exit(1);
  }
  const output = args.opts.output || inferOutput(input, format);
  const abortEarly = !!args.opts.abortEarly;

  let schemaStr;
  try {
    schemaStr = fs.readFileSync(input, 'utf8');
  } catch (e) {
    process.stderr.write(`error: cannot read ${input}: ${e.message}\n`);
    process.exit(1);
  }

  let schema;
  try {
    schema = JSON.parse(schemaStr);
  } catch (e) {
    process.stderr.write(`error: ${input} is not valid JSON: ${e.message}\n`);
    process.exit(1);
  }

  const { Validator } = require('..');
  const v = new Validator(schema);
  const src = v.toStandaloneModule({ format, abortEarly });
  if (!src) {
    process.stderr.write('error: schema is too complex for standalone compilation\n');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, src);

  const sizeBytes = Buffer.byteLength(src, 'utf8');
  process.stdout.write(`ata: compiled ${input} -> ${output} (${sizeBytes.toLocaleString()} bytes, ${format}${abortEarly ? ', abort-early' : ''})\n`);

  // Emit paired declaration file unless --no-types.
  // TypeScript resolution: .mjs -> .d.mts, .cjs -> .d.cts, .js -> .d.ts.
  const emitTypes = args.opts.types !== false;
  if (emitTypes) {
    const { toTypeScript } = require('../lib/ts-gen');
    const typeName = args.opts.name || path.basename(input, path.extname(input))
      .replace(/[^A-Za-z0-9_]/g, '_')
      .replace(/^([a-z])/, (m) => m.toUpperCase()) || 'Data';
    const dts = toTypeScript(schema, { name: typeName });
    const ext = path.extname(output);
    const dtsExt = ext === '.mjs' ? '.d.mts'
      : ext === '.cjs' ? '.d.cts'
      : '.d.ts';
    const dtsPath = output.slice(0, output.length - ext.length) + dtsExt;
    const finalDtsPath = dtsPath === output ? output + dtsExt : dtsPath;
    fs.writeFileSync(finalDtsPath, dts);
    process.stdout.write(`ata: wrote types       -> ${finalDtsPath}\n`);
  }
}

function cmdBuild(args) {
  if (args._.length === 0) {
    process.stderr.write('error: missing <glob>\n\n');
    usage();
    process.exit(1);
  }
  const { build } = require('../lib/aot-build');
  const format = args.opts.format || 'esm';
  if (format !== 'esm' && format !== 'cjs') {
    process.stderr.write(`error: --format must be esm or cjs (got "${format}")\n`);
    process.exit(1);
  }
  build({
    globs: args._,
    format,
    outDir: args.opts.outDir,
    suffix: args.opts.suffix,
    abortEarly: !!args.opts.abortEarly,
  }).then((report) => {
    for (const c of report.compiled) {
      process.stdout.write(`ata: ${c.input} -> ${c.output} (${c.bytes.toLocaleString()} bytes)\n`);
    }
    for (const s of report.skipped) {
      process.stdout.write(`ata: skipped ${s.input}: ${s.reason}\n`);
    }
    for (const f of report.failed) {
      process.stderr.write(`ata: failed  ${f.input}: ${f.error}\n`);
    }
    if (report.failed.length > 0) process.exit(1);
  }).catch((e) => {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  });
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) { usage(); process.exit(0); }

  const cmd = argv[0];
  if (cmd === '-h' || cmd === '--help' || cmd === 'help') { usage(); return; }

  const rest = argv.slice(1);
  let args;
  try {
    args = parseArgs(rest);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  }

  if (args.opts.help) { usage(); return; }

  if (cmd === 'compile') {
    cmdCompile(args);
    return;
  }

  if (cmd === 'build') {
    cmdBuild(args);
    return;
  }

  process.stderr.write(`error: unknown command "${cmd}"\n\n`);
  usage();
  process.exit(1);
}

main();
