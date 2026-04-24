import { isValid } from './validator.mjs'
function handle(input: unknown) {
  if (!isValid(input)) return { ok: false }
  const id: number = input.id
  const name: string = input.name
  const role: 'admin' | 'user' | 'guest' = input.role
  const active: boolean | undefined = input.active
  return { ok: true, id, name, role, active }
}
export { handle }
