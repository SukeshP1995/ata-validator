import { Hono } from 'hono'
import { isValid as isValidUser } from '../build/user.compiled.mjs'
import { isValid as isValidOrder } from '../build/order.compiled.mjs'

const app = new Hono()

app.post('/users', async (c) => {
  const body = await c.req.json()
  if (!isValidUser(body)) return c.json({ error: 'invalid user' }, 400)
  return c.json({ ok: true, user: body })
})

app.post('/orders', async (c) => {
  const body = await c.req.json()
  if (!isValidOrder(body)) return c.json({ error: 'invalid order' }, 400)
  return c.json({ ok: true, order: body })
})

export default app
