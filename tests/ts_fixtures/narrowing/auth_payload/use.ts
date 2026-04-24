import { isValid } from './validator.mjs'
function authorize(payload: unknown): boolean {
  if (!isValid(payload)) return false
  if (payload.tier === 'free' && payload.scopes.length > 3) return false
  return payload.userId > 0
}
export { authorize }
