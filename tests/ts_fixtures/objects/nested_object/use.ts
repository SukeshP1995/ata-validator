import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const id: number = x.user.id
  const email: string = x.user.email
}
