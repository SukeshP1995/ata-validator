import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const name: string = x.name
  const extra: string | undefined = x['anyOther']
}
