import { isValid, type Boolean } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const b: boolean = x
  const _neg: boolean = !b
}
