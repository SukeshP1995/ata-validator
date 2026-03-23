const native = require("node-gyp-build")(__dirname);

function parsePointerPath(path) {
  if (!path) return [];
  return path
    .split("/")
    .filter(Boolean)
    .map((seg) => ({
      key: seg.replace(/~1/g, "/").replace(/~0/g, "~"),
    }));
}

class Validator {
  constructor(schema) {
    const schemaStr =
      typeof schema === "string" ? schema : JSON.stringify(schema);
    this._compiled = new native.CompiledSchema(schemaStr);

    const self = this;
    Object.defineProperty(this, "~standard", {
      value: Object.freeze({
        version: 1,
        vendor: "ata-validator",
        validate(value) {
          const result = self._compiled.validate(value);
          if (result.valid) {
            return { value };
          }
          return {
            issues: result.errors.map((err) => ({
              message: err.message,
              path: parsePointerPath(err.path),
            })),
          };
        },
      }),
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  validate(data) {
    return this._compiled.validate(data);
  }

  validateJSON(jsonStr) {
    return this._compiled.validateJSON(jsonStr);
  }

  isValidJSON(jsonStr) {
    return this._compiled.isValidJSON(jsonStr);
  }
}

function validate(schema, data) {
  const schemaStr =
    typeof schema === "string" ? schema : JSON.stringify(schema);
  return native.validate(schemaStr, data);
}

function version() {
  return native.version();
}

module.exports = { Validator, validate, version };
