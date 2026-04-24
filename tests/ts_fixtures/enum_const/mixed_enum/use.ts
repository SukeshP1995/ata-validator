import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const v: 'yes' | 'no' | true | false | null = x
}
