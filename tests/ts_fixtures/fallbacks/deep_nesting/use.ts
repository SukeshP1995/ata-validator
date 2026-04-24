import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const d: string = x.a.b.c.d
}
