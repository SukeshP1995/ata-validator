import { isValid } from './validator.mjs'
declare const x: unknown
if (isValid(x)) {
  const id: string = x.orderId
  const total: number = x.total
  for (const item of x.items) {
    const sku: string = item.sku
    const qty: number = item.qty
  }
}
