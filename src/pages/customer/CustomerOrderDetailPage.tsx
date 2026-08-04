import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { CustomerOrderDetailData } from '../../types/portal.types'
import {
  build17TrackUrl,
  formatCurrencyBRL,
  formatDateBRL,
  getFulfillmentStatusLabel,
  getPaymentStatusLabel,
  isValid17TrackUrl,
  validateShippingAddress,
  formatAddressNumber,
} from '../../lib/portal-utils'

const TIMELINE_STEPS = [
  { key: 'unfulfilled', label: 'Pedido confirmado' },
  { key: 'processing', label: 'Em preparação' },
  { key: 'shipped', label: 'Enviado' },
  { key: 'in_transit', label: 'Em trânsito' },
  { key: 'out_for_delivery', label: 'Saiu para entrega' },
  { key: 'delivered', label: 'Entregue' },
]

export const CustomerOrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()

  const [order, setOrder] = useState<CustomerOrderDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchOrderDetail = useCallback(async () => {
    if (!orderId) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage(null)
    setNotFound(false)

    try {
      // 1. Busca o pedido pelo ID (Filtrado estritamente pelas políticas RLS do cliente autenticado)
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          payment_status,
          fulfillment_status,
          subtotal,
          total,
          currency,
          tracking_code,
          tracking_url,
          carrier,
          shipped_at,
          shipping_address,
          created_at
        `)
        .eq('id', orderId)
        .maybeSingle()

      if (orderError || !orderData) {
        setNotFound(true)
        return
      }

      // 2. Busca itens do pedido via RLS
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('id, product_name, quantity, unit_price, image_url')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })

      // 3. Busca eventos de rastreamento via RLS
      const { data: trackingData } = await supabase
        .from('tracking_events')
        .select('id, status, description, occurred_at')
        .eq('order_id', orderId)
        .order('occurred_at', { ascending: false })

      setOrder({
        ...orderData,
        shipping_address: (orderData.shipping_address as Record<string, unknown>) || null,
        items: (itemsData as any[]) || [],
        tracking_events: (trackingData as any[]) || [],
      })
    } catch {
      setErrorMessage('Erro de conexão ao consultar os detalhes do pedido.')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchOrderDetail()
  }, [fetchOrderDetail])

  if (loading) {
    return (
      <div className="portal-page-wrapper">
        <div className="portal-container">
          <div className="portal-skeleton-card" style={{ height: 320 }} />
        </div>
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div className="portal-page-wrapper">
        <div className="portal-container">
          <div className="portal-card portal-empty-card" style={{ maxWidth: 520, margin: '40px auto' }}>
            <div className="portal-empty-icon">🔍</div>
            <h1 className="portal-empty-title">Pedido não encontrado</h1>
            <p className="portal-empty-text">
              Não localizamos este pedido na sua conta. Ele pode não existir ou não pertencer a este e-mail.
            </p>
            <Link to="/minha-conta" className="portal-btn portal-btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
              ← Voltar para Meus Pedidos
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const displayOrderNumber = order.order_number || `#${order.id.slice(0, 8)}`
  const hasTracking = Boolean(order.tracking_code)
  const official17TrackUrl = order.tracking_code ? build17TrackUrl(order.tracking_code) : null
  const is17TrackValid = official17TrackUrl && isValid17TrackUrl(official17TrackUrl, order.tracking_code || undefined)

  // Determina o índice de progresso na timeline
  const stepKeys = TIMELINE_STEPS.map((s) => s.key)
  const currentStepIndex = stepKeys.indexOf(order.fulfillment_status)

  return (
    <div className="portal-page-wrapper">
      <div className="portal-container">

        {/* Navegação Superior */}
        <div style={{ marginBottom: 20 }}>
          <Link to="/minha-conta" className="portal-back-link">
            ← Voltar para Meus Pedidos
          </Link>
        </div>

        {errorMessage && (
          <div className="portal-alert portal-alert-error" style={{ marginBottom: 24 }}>
            <span>⚠️ {errorMessage}</span>
          </div>
        )}

        {/* Card Principal do Pedido */}
        <div className="portal-card portal-order-detail-header">
          <div className="portal-detail-top">
            <div>
              <span className="portal-label-muted">PEDIDO</span>
              <h1 className="portal-detail-title">{displayOrderNumber}</h1>
              <span className="portal-detail-date">Realizado em {formatDateBRL(order.created_at)}</span>
            </div>
            <div className="portal-badge-group">
              <span className={`portal-status-badge portal-status-${order.payment_status}`}>
                {getPaymentStatusLabel(order.payment_status)}
              </span>
              <span className={`portal-status-badge portal-status-${order.fulfillment_status}`}>
                {getFulfillmentStatusLabel(order.fulfillment_status)}
              </span>
            </div>
          </div>

          {/* Timeline de Entrega */}
          <div className="portal-timeline-container">
            <h3 className="portal-timeline-title">Status da Entrega</h3>
            <div className="portal-timeline-track">
              {TIMELINE_STEPS.map((step, idx) => {
                const isPassed = currentStepIndex !== -1 && idx <= currentStepIndex
                const isCurrent = idx === currentStepIndex

                return (
                  <div
                    key={step.key}
                    className={`portal-timeline-step ${isPassed ? 'is-passed' : ''} ${isCurrent ? 'is-current' : ''}`}
                  >
                    <div className="portal-timeline-dot">
                      {isPassed ? '✓' : idx + 1}
                    </div>
                    <span className="portal-timeline-label">{step.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Seção de Rastreamento */}
          {hasTracking && (
            <div className="portal-tracking-box">
              <div className="portal-tracking-info">
                <span className="portal-tracking-icon">🚚</span>
                <div>
                  <span className="portal-tracking-label">Código de Rastreamento</span>
                  <span className="portal-tracking-code-val">{order.tracking_code}</span>
                  {order.carrier && (
                    <span className="portal-carrier-tag">Transportadora: {order.carrier}</span>
                  )}
                </div>
              </div>

              {is17TrackValid && (
                <a
                  href={official17TrackUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="portal-btn portal-btn-track"
                >
                  Rastrear na 17TRACK ↗
                </a>
              )}
            </div>
          )}
        </div>

        {/* Grade de Detalhes: Itens e Endereço */}
        <div className="portal-detail-grid">

          {/* Card de Produtos */}
          <div className="portal-card">
            <h2 className="portal-card-heading">Itens do Pedido</h2>
            <div className="portal-items-list">
              {order.items.map((item) => (
                <div key={item.id} className="portal-item-row">
                  <div className="portal-item-info">
                    <span className="portal-item-name">{item.product_name}</span>
                    <span className="portal-item-qty">Qtd: {item.quantity}</span>
                  </div>
                  <span className="portal-item-price">
                    {formatCurrencyBRL(item.unit_price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="portal-total-row">
              <span>Total Pago</span>
              <span className="portal-total-price">{formatCurrencyBRL(order.total)}</span>
            </div>
          </div>

          {/* Card de Endereço de Entrega */}
          <div className="portal-card">
            <h2 className="portal-card-heading">Endereço de Entrega</h2>
            {order.shipping_address ? (() => {
              const addrCheck = validateShippingAddress(order.shipping_address)
              const street = typeof order.shipping_address.street === 'string' ? order.shipping_address.street : ''
              const comp = typeof order.shipping_address.complement === 'string' ? order.shipping_address.complement : ''
              const neighborhood = typeof order.shipping_address.neighborhood === 'string' ? order.shipping_address.neighborhood : ''
              const city = typeof order.shipping_address.city === 'string' ? order.shipping_address.city : ''
              const state = typeof order.shipping_address.state === 'string' ? order.shipping_address.state : ''
              const zip = typeof order.shipping_address.zip_code === 'string' ? order.shipping_address.zip_code : ''

              return (
                <div className="portal-address-box">
                  <p className="portal-address-line">
                    <strong>{street || <span style={{ color: '#ef4444' }}>Logradouro não informado</span>}</strong>
                    {', '}
                    {addrCheck.isMissingNumber ? (
                      <span style={{ color: '#ef4444', fontWeight: 600, background: '#fee2e2', padding: '2px 6px', borderRadius: 4 }}>
                        Número não informado
                      </span>
                    ) : (
                      formatAddressNumber(order.shipping_address.number)
                    )}
                    {comp ? ` - ${comp}` : ''}
                  </p>
                  {neighborhood && (
                    <p className="portal-address-line">{neighborhood}</p>
                  )}
                  <p className="portal-address-line">
                    {city || <span style={{ color: '#ef4444' }}>Cidade não informada</span>}
                    {' - '}
                    {state || <span style={{ color: '#ef4444' }}>UF não informada</span>}
                  </p>
                  <p className="portal-address-line">
                    {zip ? `CEP: ${zip}` : <span style={{ color: '#ef4444' }}>CEP não informado</span>}
                  </p>

                  <div style={{ marginTop: 16, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5, color: '#64748b', lineHeight: 1.4 }}>
                    ℹ️ Caso algum dado do seu endereço esteja incorreto ou incompleto, por favor responda diretamente ao seu e-mail de confirmação do pedido para que nossa equipe atualize o envio antes do despacho.
                  </div>
                </div>
              )
            })() : (
              <div className="portal-address-box">
                <p className="portal-address-line" style={{ color: '#ef4444' }}>Endereço de entrega não cadastrado no pedido.</p>
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5, color: '#64748b', lineHeight: 1.4 }}>
                  ℹ️ Por favor, entre em contato respondendo ao seu e-mail de confirmação para informar o endereço de envio.
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Histórico de Atualizações de Rastreio */}
        {order.tracking_events.length > 0 && (
          <div className="portal-card" style={{ marginTop: 24 }}>
            <h2 className="portal-card-heading">Histórico de Movimentações</h2>
            <div className="portal-events-list">
              {order.tracking_events.map((evt) => (
                <div key={evt.id} className="portal-event-item">
                  <div className="portal-event-dot" />
                  <div className="portal-event-content">
                    <span className="portal-event-status">
                      {getFulfillmentStatusLabel(evt.status)}
                    </span>
                    {evt.description && (
                      <p className="portal-event-desc">{evt.description}</p>
                    )}
                    <span className="portal-event-date">{formatDateBRL(evt.occurred_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
