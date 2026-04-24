import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const arr: string[] = x
  for (const s of arr) s.length
}
