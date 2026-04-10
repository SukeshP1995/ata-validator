import { createRequire } from "module";
const require = createRequire(import.meta.url);

import { bench, group, run, summary, do_not_optimize } from "mitata";

const { Validator } = require("../index.js");
const Ajv2020 = require("../benchmark/node_modules/ajv/dist/2020.js").default;
const addFormats = require("../benchmark/node_modules/ajv-formats");

// --- Schema 1: Normal (no dynamic features) ---
const normalSchema = {
  type: "object",
  properties: {
    id: { type: "integer", minimum: 1 },
    name: { type: "string", minLength: 1, maxLength: 100 },
    email: { type: "string", format: "email" },
    age: { type: "integer", minimum: 0, maximum: 150 },
    active: { type: "boolean" },
  },
  required: ["id", "name", "email", "age", "active"],
};

// --- Schema 2: $dynamicRef recursive tree ---
const treeSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  $dynamicAnchor: "node",
  properties: {
    data: true,
    children: {
      type: "array",
      items: { $dynamicRef: "#node" },
    },
  },
};

// --- Schema 3: $anchor + $ref ---
const anchorSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "array",
  items: { $ref: "#item" },
  $defs: {
    foo: {
      $anchor: "item",
      type: "string",
    },
  },
};

// --- Schema 4: $dynamicRef with override ---
const baseListSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://example.com/list",
  type: "array",
  items: { $dynamicRef: "#itemType" },
  $defs: {
    itemType: {
      $dynamicAnchor: "itemType",
    },
  },
};

const stringListSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://example.com/string-list",
  $dynamicAnchor: "itemType",
  $ref: "https://example.com/list",
  $defs: {
    itemType: {
      $dynamicAnchor: "itemType",
      type: "string",
    },
  },
};

// --- Data ---
const normalValid = { id: 42, name: "Mert", email: "mert@example.com", age: 26, active: true };
const normalInvalid = { id: -1, name: "", email: "bad", age: 200, active: "yes" };
const treeValid = { data: 1, children: [{ data: 2, children: [] }, { data: 3, children: [{ data: 4, children: [] }] }] };
const treeInvalid = { data: 1, children: [{ data: 2, children: [42] }] };
const anchorValid = ["foo", "bar", "baz"];
const anchorInvalid = ["foo", 42, "baz"];
const stringListValid = ["hello", "world", "test"];
const stringListInvalid = ["hello", 42, "test"];

// --- Compile ---
const ataNormal = new Validator(normalSchema);
const ataTree = new Validator(treeSchema);
const ataAnchor = new Validator(anchorSchema);
const ataStringList = new Validator(stringListSchema, { schemas: [baseListSchema] });

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const ajvNormal = ajv.compile(normalSchema);
const ajvTree = ajv.compile(treeSchema);
const ajvAnchor = ajv.compile(anchorSchema);
ajv.addSchema(baseListSchema);
const ajvStringList = ajv.compile(stringListSchema);

// --- Correctness ---
console.log("correctness:");
console.log("  normal  ata:", ataNormal.validate(normalValid).valid, "/", ataNormal.validate(normalInvalid).valid);
console.log("  normal  ajv:", ajvNormal(normalValid), "/", ajvNormal(normalInvalid));
console.log("  tree    ata:", ataTree.validate(treeValid).valid, "/", ataTree.validate(treeInvalid).valid);
console.log("  tree    ajv:", ajvTree(treeValid), "/", ajvTree(treeInvalid));
console.log("  anchor  ata:", ataAnchor.validate(anchorValid).valid, "/", ataAnchor.validate(anchorInvalid).valid);
console.log("  anchor  ajv:", ajvAnchor(anchorValid), "/", ajvAnchor(anchorInvalid));
console.log("  strlist ata:", ataStringList.validate(stringListValid).valid, "/", ataStringList.validate(stringListInvalid).valid);
console.log("  strlist ajv:", ajvStringList(stringListValid), "/", ajvStringList(stringListInvalid));
console.log();

// Using yield pattern to prevent LICM (Loop Invariant Code Motion)
// See: https://github.com/evanwashere/mitata?tab=readme-ov-file#loop-invariant-code-motion-optimization

summary(() => {
  group("normal schema - valid", () => {
    bench("ata", function* () { yield { 0: () => normalValid, bench: (d) => do_not_optimize(ataNormal.validate(d)) }; });
    bench("ajv", function* () { yield { 0: () => normalValid, bench: (d) => do_not_optimize(ajvNormal(d)) }; });
  });

  group("normal schema - invalid", () => {
    bench("ata", function* () { yield { 0: () => normalInvalid, bench: (d) => do_not_optimize(ataNormal.validate(d)) }; });
    bench("ajv", function* () { yield { 0: () => normalInvalid, bench: (d) => do_not_optimize(ajvNormal(d)) }; });
  });

  group("$dynamicRef tree - valid", () => {
    bench("ata", function* () { yield { 0: () => treeValid, bench: (d) => do_not_optimize(ataTree.validate(d)) }; });
    bench("ajv", function* () { yield { 0: () => treeValid, bench: (d) => do_not_optimize(ajvTree(d)) }; });
  });

  group("$dynamicRef tree - invalid", () => {
    bench("ata", function* () { yield { 0: () => treeInvalid, bench: (d) => do_not_optimize(ataTree.validate(d)) }; });
    bench("ajv", function* () { yield { 0: () => treeInvalid, bench: (d) => do_not_optimize(ajvTree(d)) }; });
  });

  group("$anchor array - valid", () => {
    bench("ata", function* () { yield { 0: () => anchorValid, bench: (d) => do_not_optimize(ataAnchor.validate(d)) }; });
    bench("ajv", function* () { yield { 0: () => anchorValid, bench: (d) => do_not_optimize(ajvAnchor(d)) }; });
  });

  group("$dynamicRef override (string list) - valid", () => {
    bench("ata", function* () { yield { 0: () => stringListValid, bench: (d) => do_not_optimize(ataStringList.validate(d)) }; });
    bench("ajv", function* () { yield { 0: () => stringListValid, bench: (d) => do_not_optimize(ajvStringList(d)) }; });
  });

  group("$dynamicRef override (string list) - invalid", () => {
    bench("ata", function* () { yield { 0: () => stringListInvalid, bench: (d) => do_not_optimize(ataStringList.validate(d)) }; });
    bench("ajv", function* () { yield { 0: () => stringListInvalid, bench: (d) => do_not_optimize(ajvStringList(d)) }; });
  });
});

run();
