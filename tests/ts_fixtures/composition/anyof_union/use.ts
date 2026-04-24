import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const v: string | number = x
}
