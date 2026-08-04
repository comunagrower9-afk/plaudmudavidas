import type { Database } from './database.types'

export type PaymentStatus = Database['public']['Enums']['payment_status_enum']
export type FulfillmentStatus = Database['public']['Enums']['fulfillment_status_enum']

// ============================================================================
// Claim Customer Account RPC Types
// ============================================================================
export type ClaimCustomerStatus =
  | 'claimed'
  | 'already_claimed'
  | 'not_found'
  | 'conflict'
  | 'missing_email'
  | 'unconfirmed_email'
  | 'unauthenticated'

export interface ClaimCustomerResult {
  success: boolean
  status: ClaimCustomerStatus
  customer_id?: string
  message: string
}

export function isClaimCustomerResult(val: unknown): val is ClaimCustomerResult {
  if (typeof val !== 'object' || val === null) return false
  const r = val as Record<string, unknown>
  return typeof r.success === 'boolean' && typeof r.status === 'string'
}

// ============================================================================
// Admin Search Orders RPC Types
// ============================================================================
export interface AdminSearchOrderItem {
  order_id: string
  order_number: string | null
  vega_order_id: string
  customer_name: string | null
  customer_email: string
  payment_status: PaymentStatus
  fulfillment_status: FulfillmentStatus
  total: number
  currency: string
  tracking_code: string | null
  carrier: string | null
  created_at: string
}

export interface AdminSearchOrdersResult {
  orders: AdminSearchOrderItem[]
  total_count: number
  limit: number
  offset: number
}

export function isAdminSearchOrdersResult(val: unknown): val is AdminSearchOrdersResult {
  if (typeof val !== 'object' || val === null) return false
  const r = val as Record<string, unknown>
  return Array.isArray(r.orders) && typeof r.total_count === 'number'
}

// ============================================================================
// Admin Get Order Details RPC Types
// ============================================================================
export interface AdminOrderDetailOrder {
  id: string
  order_number: string | null
  vega_order_id: string
  payment_status: PaymentStatus
  fulfillment_status: FulfillmentStatus
  subtotal: number
  total: number
  currency: string
  tracking_code: string | null
  tracking_url: string | null
  carrier: string | null
  shipped_at: string | null
  created_at: string
  updated_at: string
}

export interface AdminOrderDetailCustomer {
  id: string
  full_name: string | null
  email: string
}

export interface AdminOrderDetailItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  sku: string | null
  external_product_id: string | null
}

export interface AdminOrderDetailTrackingEvent {
  id: string
  status: FulfillmentStatus
  source: string
  description: string | null
  occurred_at: string
}

export interface AdminOrderDetailEmailEvent {
  id: string
  template_key: string
  status: Database['public']['Enums']['email_status_enum']
  attempt_count: number
  sent_at: string | null
  created_at: string
}

export interface AdminGetOrderSuccessResult {
  status: 'success'
  order: AdminOrderDetailOrder
  customer: AdminOrderDetailCustomer
  shipping_address: {
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
    zip_code?: string
    country?: string
    [key: string]: unknown
  }
  items: AdminOrderDetailItem[]
  tracking_events: AdminOrderDetailTrackingEvent[]
  email_events: AdminOrderDetailEmailEvent[]
}

export interface AdminGetOrderNotFoundResult {
  status: 'not_found'
  message: string
}

export type AdminGetOrderResult = AdminGetOrderSuccessResult | AdminGetOrderNotFoundResult

export function isAdminGetOrderResult(val: unknown): val is AdminGetOrderResult {
  if (typeof val !== 'object' || val === null) return false
  const r = val as Record<string, unknown>
  return r.status === 'success' || r.status === 'not_found'
}

// ============================================================================
// Admin Register Order Shipment RPC Types
// ============================================================================
export type AdminShipmentStatus =
  | 'registered'
  | 'replaced'
  | 'already_registered'
  | 'tracking_conflict'
  | 'not_paid'
  | 'conflict'
  | 'not_found'
  | 'error'

export interface AdminRegisterShipmentResult {
  status: AdminShipmentStatus
  order_id?: string
  order_number?: string | null
  tracking_code?: string
  tracking_url?: string
  carrier?: string | null
  message?: string
  existing_tracking_code?: string | null
  email_event_id?: string
}

export function isAdminRegisterShipmentResult(val: unknown): val is AdminRegisterShipmentResult {
  if (typeof val !== 'object' || val === null) return false
  const r = val as Record<string, unknown>
  return typeof r.status === 'string'
}

// ============================================================================
// Customer Portal Orders Direct Query Types (RLS)
// ============================================================================
export interface CustomerOrderSummary {
  id: string
  order_number: string | null
  payment_status: PaymentStatus
  fulfillment_status: FulfillmentStatus
  total: number
  currency: string
  tracking_code: string | null
  carrier: string | null
  created_at: string
}

export interface CustomerOrderItemSummary {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  image_url: string | null
}

export interface CustomerTrackingEventSummary {
  id: string
  status: FulfillmentStatus
  description: string | null
  occurred_at: string
}

export interface CustomerOrderDetailData {
  id: string
  order_number: string | null
  payment_status: PaymentStatus
  fulfillment_status: FulfillmentStatus
  subtotal: number
  total: number
  currency: string
  tracking_code: string | null
  tracking_url: string | null
  carrier: string | null
  shipped_at: string | null
  shipping_address: {
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
    zip_code?: string
    country?: string
    [key: string]: unknown
  } | null
  created_at: string
  items: CustomerOrderItemSummary[]
  tracking_events: CustomerTrackingEventSummary[]
}
