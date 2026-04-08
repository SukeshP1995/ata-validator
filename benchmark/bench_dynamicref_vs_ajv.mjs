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

// --- Schema 4: $dynamicRef with override (the real power) ---
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

// --- Compile ATA ---
const ataNormal = new Validator(normalSchema);
const ataTree = new Validator(treeSchema);
const ataAnchor = new Validator(anchorSchema);
const ataStringList = new Validator(stringListSchema, { schemas: [baseListSchema] });

// --- Compile AJV ---
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

summary(() => {
  group("normal schema - valid", () => {
    bench("ata", () => do_not_optimize(ataNormal.validate(normalValid)));
    bench("ajv", () => do_not_optimize(ajvNormal(normalValid)));
  });

  group("normal schema - invalid", () => {
    bench("ata", () => do_not_optimize(ataNormal.validate(normalInvalid)));
    bench("ajv", () => do_not_optimize(ajvNormal(normalInvalid)));
  });

  group("$dynamicRef tree - valid", () => {
    bench("ata", () => do_not_optimize(ataTree.validate(treeValid)));
    bench("ajv", () => do_not_optimize(ajvTree(treeValid)));
  });

  group("$dynamicRef tree - invalid", () => {
    bench("ata", () => do_not_optimize(ataTree.validate(treeInvalid)));
    bench("ajv", () => do_not_optimize(ajvTree(treeInvalid)));
  });

  group("$anchor array - valid", () => {
    bench("ata", () => do_not_optimize(ataAnchor.validate(anchorValid)));
    bench("ajv", () => do_not_optimize(ajvAnchor(anchorValid)));
  });

  group("$dynamicRef override (string list) - valid", () => {
    bench("ata", () => do_not_optimize(ataStringList.validate(stringListValid)));
    bench("ajv", () => do_not_optimize(ajvStringList(stringListValid)));
  });

  group("$dynamicRef override (string list) - invalid", () => {
    bench("ata", () => do_not_optimize(ataStringList.validate(stringListInvalid)));
    bench("ajv", () => do_not_optimize(ajvStringList(stringListInvalid)));
  });
});

run();
