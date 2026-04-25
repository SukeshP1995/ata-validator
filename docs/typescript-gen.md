# TypeScript type generation

`ata compile` emits a self-contained validator module plus a `.d.mts`
declaration. This page documents what the generator captures in the type
system, what stays runtime-only, and the design choices that come up when
JSON Schema and TypeScript do not have a one-to-one correspondence.

## What the type captures

The generator turns these schema features into static type information:

- `type`: `string`, `number`, `integer`, `boolean`, `null`, `array`, `object`
- `properties` plus `required`: object shape with optional and required keys
- `enum`: literal union (`'admin' | 'user'`)
- `const`: literal type
- `oneOf`, `anyOf`: emitted as a union of the alternative shapes
- `items`: array element type
- `prefixItems`: tuple, with elements beyond `minItems` made optional
- `additionalProperties`: index signature widened to be compatible with
  the named property types
- `$ref` to local `$defs` or `definitions`: resolved to the named alias
- `description`, `default`, `examples`, `deprecated`: rendered into the
  JSDoc block on the property or type

`isValid` is emitted as a TypeScript type predicate, so a successful check
narrows the value at the call site:

```ts
import { isValid, type User } from './schemas/user.validator.mjs'

if (isValid(body)) {
  // `body` is typed as User from here on
  return body.id
}
```

## What stays runtime-only

TypeScript cannot enforce most of the value-level constraints JSON Schema
expresses. The generator preserves them as JSDoc tags so editors and
TypeDoc surface them on hover, and so reviewers can see the contract even
when `tsc` cannot:

| Schema keyword                       | JSDoc tag           | Enforced by |
|--------------------------------------|---------------------|-------------|
| `minLength`, `maxLength`             | `@minLength`, `@maxLength` | Runtime |
| `minItems`, `maxItems`               | `@minItems`, `@maxItems` | Runtime |
| `minProperties`, `maxProperties`     | same name           | Runtime |
| `minimum`, `maximum`                 | `@minimum`, `@maximum` | Runtime |
| `exclusiveMinimum`, `exclusiveMaximum` | same name         | Runtime |
| `multipleOf`                         | `@multipleOf`       | Runtime |
| `pattern`                            | `@pattern`          | Runtime |
| `format` (`email`, `date`, ...)      | `@format`           | Runtime |
| `uniqueItems`                        | `@uniqueItems`      | Runtime |

Conditional schemas (`if` / `then` / `else`, `dependentSchemas`) are also
runtime-only: the generator emits the static union of the branches when
their shape is statically determinable, but the conditional discriminator
itself is not represented in the type.

## Design choices

### Excess properties

When a schema declares `properties` without setting
`additionalProperties: false`, JSON Schema accepts any extra keys. The
emitted interface includes a permissive index signature so `tsc` does not
reject excess properties the runtime would consider valid:

```ts
// Schema: { type: 'object', properties: { id: { type: 'integer' } } }
export interface T {
  id: number
  [key: string]: unknown
}
```

Set `additionalProperties: false` in the schema to opt into a closed
shape; the index signature is then omitted.

### Optional tuple elements

`prefixItems` does not require its entries to be present unless `minItems`
forces them. The generator marks tuple elements at indices `>= minItems`
as optional:

```ts
// Schema: { type: 'array', prefixItems: [{type:'string'}, {type:'number'}], items: false }
export type T = [string?, number?]
```

Setting `minItems` tightens this:

```ts
// Same schema with minItems: 2
export type T = [string, number]
```

### Schemas without `type`

A schema that uses `properties` or `required` but does not declare
`type: 'object'` technically passes non-object values at runtime. The
generator still emits an object type because that matches schema author
intent in practice. If you genuinely want a permissive schema, omit
`properties` and `required` so the generator falls back to `unknown`.

### Anonymous `$defs` keys

JSON Schema permits empty-string keys in `$defs`, which would produce an
unnamed type alias. The generator emits `_Anon` (or `_AnonN` for nested
anonymous entries) so the `.d.mts` stays valid TypeScript.

### Object property names that collide with `Object` prototype

Schemas with property names like `toString`, `constructor`, or
`__proto__` produce interfaces whose members shadow built-in
`Object.prototype` declarations. `tsc` flags this when a built-in type is
narrower than the property type. The generator does not work around this
because the schema author has explicitly chosen these names; the runtime
validator handles them correctly regardless.

## Verifying generator output

Three test runners ship with the project:

- `npm run test:ts`: hand-written fixtures covering specific edge cases.
- `npm run test:ts-corpus`: every schema in the JSON Schema Test Suite is
  passed through the generator and `tsc`. Failures here mean the emitted
  `.d.mts` does not parse or does not type-check.
- `npm run test:ts-differential`: data the runtime marks as valid is
  asserted assignable to the emitted type. Failures here mean the type
  is strictly narrower than the runtime contract.

Both corpus runners accept `CORPUS_DRAFT=draft7` to switch from the
default `draft2020-12`. CI runs all five (fixtures, corpus 2020-12, corpus
draft 7, differential 2020-12, differential draft 7) on every push and
pull request.
