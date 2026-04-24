import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const n: null = x
}
