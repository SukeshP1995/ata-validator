import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  for (const item of x) {
    const id: number = item.id
    const name: string = item.name
  }
}
