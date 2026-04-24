import { isValid, type User_required } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const id: number = x.id
  const name: string = x.name
}
const _type: User_required = { id: 1, name: 'alice' }
