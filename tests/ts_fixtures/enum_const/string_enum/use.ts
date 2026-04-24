import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const c: 'red' | 'green' | 'blue' = x
}
