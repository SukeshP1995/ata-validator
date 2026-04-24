import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const id: number = x.id
}
