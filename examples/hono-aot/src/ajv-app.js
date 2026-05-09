import { Hono } from 'hono'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import userSchema from '../schemas/user.schema.json' with { type: 'json' }
import orderSchema from '../schemas/order.schema.json' with { type: 'json' }

const ajv = new Ajv()
addFormats(ajv)
const validateUser = ajv.compile(userSchema)
const validateOrder = ajv.compile(orderSchema)

const app = new Hono()

app.post('/users', async (c) => {
  const body = await c.req.json()
  if (!validateUser(body)) return c.json({ error: 'invalid user' }, 400)
  return c.json({ ok: true, user: body })
})

app.post('/orders', async (c) => {
  const body = await c.req.json()
  if (!validateOrder(body)) return c.json({ error: 'invalid order' }, 400)
  return c.json({ ok: true, order: body })
})

export default app
