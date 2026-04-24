import { isValid, type Integer_bounded } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const n: number = x
  n.toFixed(0)
}
const _type: Integer_bounded = 42
