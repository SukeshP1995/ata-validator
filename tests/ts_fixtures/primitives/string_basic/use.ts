import { isValid, type String_basic } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const s: string = x
  s.toUpperCase()
}
const _type: String_basic = 'hello'
