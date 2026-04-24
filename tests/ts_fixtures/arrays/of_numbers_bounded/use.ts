import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const nums: number[] = x
  const total = nums.reduce((a, b) => a + b, 0)
}
