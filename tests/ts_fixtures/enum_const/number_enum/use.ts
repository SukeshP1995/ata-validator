import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const n: 1 | 2 | 3 = x
}
