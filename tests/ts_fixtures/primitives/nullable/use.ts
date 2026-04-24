import { isValid, type Nullable } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const s: string | null = x
  if (s !== null) s.length
}
