import { isValid, type Tag } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const t: 'a' | 'b' | 'c' = x.tag
}
const _tag: Tag = 'a'
