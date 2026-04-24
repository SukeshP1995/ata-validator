// patternProperties isn't mapped to a precise TS type. Accept the fallback
// (Record<string, unknown>) and verify the .d.ts still compiles cleanly.
import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  // object shape, no field-level narrowing claims
  const keys = Object.keys(x)
}
