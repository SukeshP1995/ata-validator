import { isValid, type Number } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const n: number = x
  Math.abs(n)
}
