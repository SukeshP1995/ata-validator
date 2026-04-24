import { isValid, type Address } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const name: string = x.name
  const city: string = x.address.city
}
const _addr: Address = { city: 'Istanbul' }
