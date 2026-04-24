import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  if (x.kind === 'a') {
    const v: string = x.value
  } else {
    const c: number = x.count
  }
}
