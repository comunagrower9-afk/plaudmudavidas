import { renderOrderConfirmedEmail, type OrderConfirmedEmailData } from "./order-confirmed.ts"
import { renderOrderShippedEmail, type OrderShippedEmailData } from "./order-shipped.ts"
import {
  generateResendIdempotencyKey,
  normalizeTrackingCode,
} from "../email-utils.ts"

export * from "./email-theme.ts"
export * from "./email-layout.ts"
export * from "./order-confirmed.ts"
export * from "./order-shipped.ts"

export interface TemplateRenderResult {
  subject: string
  html: string
  text: string
  resendIdempotencyKey: string
}

export interface OrderEmailContext {
  order: {
    id: string
    order_number?: string | null
    total?: number | string | null
    subtotal?: number | string | null
    currency?: string | null
    shipping_address?: Record<string, unknown> | null
    tracking_code?: string | null
    tracking_url?: string | null
    carrier?: string | null
    shipped_at?: string | Date | null
    estimated_delivery_start?: string | Date | null
    estimated_delivery_end?: string | Date | null
    created_at?: string | Date | null
    metadata?: Record<string, unknown> | null
    customers?: {
      id?: string
      email?: string
      full_name?: string | null
    } | null
    order_items?: Array<{
      id?: string
      product_name: string
      quantity: number
      unit_price?: number | string | null
      sku?: string | null
      external_product_id?: string | null
    }> | null
  }
  recipientEmail: string
}

export type TemplateRenderer = (context: OrderEmailContext) => TemplateRenderResult

/**
 * Registry de templates transacionais fortemente tipado
 */
export const EMAIL_TEMPLATE_REGISTRY: Record<string, TemplateRenderer> = {
  order_confirmed: (context: OrderEmailContext): TemplateRenderResult => {
    const { order, recipientEmail } = context
    const customerName = order.customers?.full_name || null
    const orderMetadata = (order.metadata && typeof order.metadata === "object") ? order.metadata : {}
    const paymentMethod = typeof orderMetadata.payment_method === "string" ? orderMetadata.payment_method : null
    const rawItems = Array.isArray(order.order_items) ? order.order_items : []

    const rendered = renderOrderConfirmedEmail({
      order_number: order.order_number || order.id,
      customer_name: customerName,
      customer_email: recipientEmail,
      total: Number(order.total) || 0,
      subtotal: order.subtotal != null ? Number(order.subtotal) : null,
      shipping_address: order.shipping_address || null,
      created_at: order.created_at || null,
      payment_method: paymentMethod,
      items: rawItems.map((item) => ({
        product_name: item.product_name,
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        sku: item.sku || null,
        external_product_id: item.external_product_id || null,
      })),
    })

    const resendIdempotencyKey = generateResendIdempotencyKey(order.id, "order_confirmed")

    return {
      ...rendered,
      resendIdempotencyKey,
    }
  },

  order_shipped: (context: OrderEmailContext): TemplateRenderResult => {
    const { order, recipientEmail } = context
    const customerName = order.customers?.full_name || null
    const rawItems = Array.isArray(order.order_items) ? order.order_items : []

    const trackingCode = order.tracking_code
    if (!trackingCode || !normalizeTrackingCode(trackingCode)) {
      throw new Error(`Order '${order.id}' is missing valid tracking_code for order_shipped template`)
    }

    const rendered = renderOrderShippedEmail({
      order_number: order.order_number || order.id,
      customer_name: customerName,
      customer_email: recipientEmail,
      tracking_code: trackingCode,
      tracking_url: order.tracking_url || null,
      carrier: order.carrier || null,
      shipped_at: order.shipped_at || null,
      estimated_delivery_start: order.estimated_delivery_start || null,
      estimated_delivery_end: order.estimated_delivery_end || null,
      shipping_address: order.shipping_address || null,
      items: rawItems.map((item) => ({
        product_name: item.product_name,
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        sku: item.sku || null,
        external_product_id: item.external_product_id || null,
      })),
    })

    const resendIdempotencyKey = generateResendIdempotencyKey(order.id, "order_shipped", trackingCode)

    return {
      ...rendered,
      resendIdempotencyKey,
    }
  },
}

/**
 * Obtém o renderizador de template a partir da chave tipada
 */
export function getEmailRenderer(templateKey: string): TemplateRenderer | null {
  return EMAIL_TEMPLATE_REGISTRY[templateKey] || null
}
