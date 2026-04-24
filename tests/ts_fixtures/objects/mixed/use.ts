import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const id: number = x.id
  const role: 'admin' | 'user' | 'guest' = x.role
  const active: boolean | undefined = x.active
}
