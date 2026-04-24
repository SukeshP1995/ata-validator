// prefixItems is not yet represented as a TS tuple; we only assert the .d.ts
// compiles. Stronger tuple typing is a planned follow-up.
import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  // array fallback expected, not a strict tuple
  const first = x[0]
}
