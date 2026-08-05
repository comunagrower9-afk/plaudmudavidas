import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { CustomerOrderSummary } from '../../types/portal.types'
import {
  extractFirstName,
  formatCurrencyBRL,
  formatDateBRL,
  getFulfillmentStatusLabel,
  getPaymentStatusLabel,
} from '../../lib/portal-utils'
import '../../styles/portal.css'

export const CustomerOrdersPage: React.FC = () => {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [customerName, setCustomerName] = useState<string | null>(null)
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchCustomerData = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    try {
      // 1. Busca perfil do cliente via RLS (apenas nome e e-mail)
      const { data: customerData } = await supabase
        .from('customers')
        .select('full_name')
        .maybeSingle()

      if (customerData?.full_name) {
        setCustomerName(customerData.full_name)
      }

      // 2. Busca pedidos via RLS (somente campos estritamente necessários)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, payment_status, fulfillment_status, total, currency, tracking_code, carrier, created_at')
        .order('created_at', { ascending: false })

      if (ordersError) {
        setErrorMessage('Não foi possível carregar seus pedidos no momento. Tente novamente.')
        return
      }

      setOrders(ordersData || [])
    } catch {
      setErrorMessage('Erro de conexão ao carregar seus pedidos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomerData()
  }, [fetchCustomerData])

  const handleLogout = async () => {
    await signOut()
    navigate('/entrar')
  }

  const firstName = extractFirstName(customerName)

  return (
    <div className="portal-page-wrapper">
      <div className="portal-container">

        {/* Top Header Card */}
        <header className="portal-header-card">
          <div className="portal-header-left">
            <div className="portal-brand-mini">PLAUD</div>
            <h1 className="portal-greeting">Olá, {firstName}</h1>
            <p className="portal-user-email">{user?.email}</p>
          </div>
          <div className="portal-header-actions">
            <button
              type="button"
              onClick={handleLogout}
              className="portal-btn portal-btn-secondary portal-btn-sm"
            >
              Sair da conta
            </button>
          </div>
        </header>

        {/* Feedback de Erro com Retry */}
        {errorMessage && (
          <div className="portal-alert portal-alert-error" style={{ marginBottom: 24 }}>
            <span>⚠️ {errorMessage}</span>
            <button
              type="button"
              onClick={fetchCustomerData}
              className="portal-btn-link"
              style={{ marginLeft: 12 }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* ESTADO DE CARREGAMENTO (SKELETON) */}
        {loading ? (
          <div className="portal-orders-list">
            {[1, 2].map((i) => (
              <div key={i} className="portal-order-card portal-skeleton-card">
                <div className="portal-skeleton-line" style={{ width: '40%', height: 20 }} />
                <div className="portal-skeleton-line" style={{ width: '70%', height: 16, marginTop: 12 }} />
                <div className="portal-skeleton-line" style={{ width: '30%', height: 16, marginTop: 12 }} />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          /* ESTADO VAZIO (SEM PEDIDOS) */
          <div className="portal-empty-card">
            <div className="portal-empty-icon">📦</div>
            <h2 className="portal-empty-title">Nenhum pedido encontrado</h2>
            <p className="portal-empty-text">
              Não encontramos pedidos associados ao e-mail <strong>{user?.email}</strong>. Se você realizou uma compra recentemente, aguarde alguns minutos ou verifique se utilizou outro e-mail.
            </p>
            <a href="/" className="portal-btn portal-btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Ir para a loja
            </a>
          </div>
        ) : (
          /* LISTA DE PEDIDOS */
          <div className="portal-orders-list">
            <h2 className="portal-section-title">Seus Pedidos ({orders.length})</h2>

            {orders.map((order) => {
              const displayOrderNumber = order.order_number || `#${order.id.slice(0, 8)}`
              const isShipped = Boolean(order.tracking_code)

              return (
                <div key={order.id} className="portal-order-card">
                  <div className="portal-order-card-header">
                    <div>
                      <span className="portal-order-number">{displayOrderNumber}</span>
                      <span className="portal-order-date">{formatDateBRL(order.created_at)}</span>
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

                  <div className="portal-order-card-body">
                    <div className="portal-order-meta-item">
                      <span className="portal-meta-label">Total</span>
                      <span className="portal-meta-value portal-meta-price">
                        {formatCurrencyBRL(order.total)}
                      </span>
                    </div>

                    {isShipped && (
                      <div className="portal-order-meta-item">
                        <span className="portal-meta-label">Rastreamento</span>
                        <span className="portal-meta-value portal-tracking-pill">
                          🚚 {order.tracking_code}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="portal-order-card-footer">
                    <button
                      type="button"
                      onClick={() => navigate(`/minha-conta/pedidos/${order.id}`)}
                      className="portal-btn portal-btn-primary portal-btn-sm"
                    >
                      Ver detalhes do pedido →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
