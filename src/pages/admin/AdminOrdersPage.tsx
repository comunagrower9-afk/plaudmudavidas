import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type {
  AdminSearchOrderItem,
  AdminGetOrderSuccessResult,
  AdminShipmentStatus,
} from '../../types/portal.types'
import {
  isAdminSearchOrdersResult,
  isAdminGetOrderResult,
  isAdminRegisterShipmentResult,
} from '../../types/portal.types'
import {
  formatCurrencyBRL,
  formatDateBRL,
  getFulfillmentStatusLabel,
  getPaymentStatusLabel,
  isValidTrackingCode,
  build17TrackUrl,
  validateShippingAddress,
  formatAddressNumber,
} from '../../lib/portal-utils'
import '../../styles/portal.css'

const PAGE_SIZE = 15

export const AdminOrdersPage: React.FC = () => {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  // Estado de Pesquisa
  const [searchQuery, setSearchQuery] = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [orders, setOrders] = useState<AdminSearchOrderItem[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [pageOffset, setPageOffset] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Estado do Pedido Selecionado
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<AdminGetOrderSuccessResult | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Estado do Formulário de Rastreamento
  const [inputTrackingCode, setInputTrackingCode] = useState('')
  const [inputCarrier, setInputCarrier] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const [shipmentLoading, setShipmentLoading] = useState(false)
  const [shipmentMessage, setShipmentMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null)

  // Executa busca via RPC admin_search_orders
  const executeSearch = async (query: string, offset = 0) => {
    const cleanQuery = query.trim()
    if (cleanQuery.length < 2) {
      setSearchError('Digite ao menos 2 caracteres para pesquisar.')
      return
    }

    setSearchLoading(true)
    setSearchError(null)
    setSearchedQuery(cleanQuery)
    setPageOffset(offset)

    try {
      const { data, error } = await supabase.rpc('admin_search_orders', {
        p_query: cleanQuery,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      })

      if (error) {
        if (error.code === '42501' || error.message?.includes('Administrator privileges required')) {
          setSearchError('Acesso negado: você não possui permissões administrativas ativas.')
        } else {
          setSearchError('Erro ao buscar pedidos. Tente novamente.')
        }
        setOrders([])
        setTotalCount(null)
        return
      }

      if (isAdminSearchOrdersResult(data)) {
        setOrders(data.orders)
        setTotalCount(data.total_count)
      } else {
        setOrders([])
        setTotalCount(0)
      }
    } catch {
      setSearchError('Erro de conexão ao buscar pedidos.')
    } finally {
      setSearchLoading(false)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSelectedOrderId(null)
    setSelectedOrder(null)
    executeSearch(searchQuery, 0)
  }

  // Carrega detalhes via RPC admin_get_order
  const handleSelectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId)
    setDetailLoading(true)
    setDetailError(null)
    setShipmentMessage(null)
    setInputTrackingCode('')
    setInputCarrier('')
    setReplaceExisting(false)
    setShowReplaceConfirm(false)

    try {
      const { data, error } = await supabase.rpc('admin_get_order', {
        p_order_id: orderId,
      })

      if (error) {
        setDetailError('Falha ao carregar detalhes do pedido.')
        setSelectedOrder(null)
        return
      }

      if (isAdminGetOrderResult(data) && data.status === 'success') {
        setSelectedOrder(data as AdminGetOrderSuccessResult)
        if (data.order.carrier) {
          setInputCarrier(data.order.carrier)
        }
      } else {
        setDetailError('Pedido não encontrado.')
        setSelectedOrder(null)
      }
    } catch {
      setDetailError('Erro de conexão ao consultar o pedido.')
    } finally {
      setDetailLoading(false)
    }
  }

  // Cadastro de Rastreamento via RPC admin_register_order_shipment
  const handleRegisterShipment = async (e?: React.FormEvent, forceReplace = false) => {
    if (e) e.preventDefault()
    if (!selectedOrder) return

    const normCode = inputTrackingCode.trim().toUpperCase()
    if (!isValidTrackingCode(normCode)) {
      setShipmentMessage({
        type: 'error',
        text: 'Código de rastreamento inválido. Use de 6 a 50 caracteres alfanuméricos.',
      })
      return
    }

    // Se já houver código diferente e não estiver confirmado, pede confirmação
    if (
      selectedOrder.order.tracking_code &&
      selectedOrder.order.tracking_code !== normCode &&
      !forceReplace &&
      !replaceExisting
    ) {
      setShowReplaceConfirm(true)
      setShipmentMessage({
        type: 'warning',
        text: `Este pedido já possui o código ${selectedOrder.order.tracking_code}. Confirme a substituição abaixo.`,
      })
      return
    }

    setShipmentLoading(true)
    setShipmentMessage(null)

    try {
      const identifier = selectedOrder.order.order_number || selectedOrder.order.id
      const shouldReplace = forceReplace || replaceExisting

      const { data, error } = await supabase.rpc('admin_register_order_shipment', {
        p_order_identifier: identifier,
        p_tracking_code: normCode,
        p_carrier: inputCarrier.trim() || 'Correios',
        p_replace_existing: shouldReplace,
      })

      if (error) {
        setShipmentMessage({
          type: 'error',
          text: error.message || 'Erro ao registrar rastreamento.',
        })
        return
      }

      if (isAdminRegisterShipmentResult(data)) {
        const st: AdminShipmentStatus = data.status
        if (st === 'registered' || st === 'replaced') {
          setShipmentMessage({
            type: 'success',
            text: 'Código cadastrado com sucesso! O e-mail de notificação foi enfileirado para envio automático.',
          })
          setShowReplaceConfirm(false)
          setReplaceExisting(false)
          // Recarrega os detalhes do pedido e a busca
          await handleSelectOrder(selectedOrder.order.id)
          if (searchedQuery) {
            executeSearch(searchedQuery, pageOffset)
          }
        } else if (st === 'already_registered') {
          setShipmentMessage({
            type: 'warning',
            text: 'Este mesmo código já está registrado para este pedido.',
          })
        } else if (st === 'tracking_conflict') {
          setShowReplaceConfirm(true)
          setShipmentMessage({
            type: 'warning',
            text: `Conflito: o pedido já possui o código ${data.existing_tracking_code}. Marque a confirmação para substituir.`,
          })
        } else if (st === 'not_paid') {
          setShipmentMessage({
            type: 'error',
            text: 'Não é possível despachar um pedido que não esteja marcado como pago.',
          })
        } else {
          setShipmentMessage({
            type: 'error',
            text: data.message || 'Não foi possível registrar o rastreamento.',
          })
        }
      }
    } catch {
      setShipmentMessage({
        type: 'error',
        text: 'Erro inesperado ao cadastrar rastreamento.',
      })
    } finally {
      setShipmentLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/admin/login')
  }

  return (
    <div className="portal-page-wrapper portal-admin-bg">
      <div className="portal-container portal-admin-container">

        {/* Header do Painel */}
        <header className="portal-header-card portal-admin-header">
          <div className="portal-header-left">
            <div className="portal-badge" style={{ marginBottom: 8, background: '#1e293b' }}>
              PAINEL DE OPERAÇÕES
            </div>
            <h1 className="portal-greeting" style={{ fontSize: 24 }}>Gerenciamento de Pedidos</h1>
            <p className="portal-user-email">Operador: {user?.email}</p>
          </div>
          <div className="portal-header-actions">
            <button
              type="button"
              onClick={handleLogout}
              className="portal-btn portal-btn-secondary portal-btn-sm"
            >
              Sair do painel
            </button>
          </div>
        </header>

        {/* Formulário de Busca */}
        <div className="portal-card" style={{ marginBottom: 24 }}>
          <form onSubmit={handleSearchSubmit} className="portal-admin-search-form">
            <div className="portal-search-input-wrap">
              <input
                type="text"
                className="portal-input"
                placeholder="Buscar por número do pedido (ex: VCS1001), ID Vega, nome ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={searchLoading}
              />
            </div>
            <button
              type="submit"
              className="portal-btn portal-btn-primary"
              disabled={searchLoading || searchQuery.trim().length < 2}
            >
              {searchLoading ? 'Buscando...' : '🔍 Pesquisar'}
            </button>
          </form>

          {searchError && (
            <div className="portal-alert portal-alert-error" style={{ marginTop: 16 }}>
              <span>⚠️ {searchError}</span>
            </div>
          )}
        </div>

        {/* Layout Principal: Lista de Resultados + Painel de Detalhes */}
        <div className="portal-admin-grid">

          {/* Coluna da Esquerda: Resultados */}
          <div className="portal-card portal-admin-orders-col">
            <div className="portal-admin-col-header">
              <h2 className="portal-card-heading" style={{ margin: 0 }}>
                {totalCount !== null ? `Resultados (${totalCount})` : 'Busca de Pedidos'}
              </h2>
            </div>

            {searchLoading ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <div className="portal-spinner" style={{ margin: '0 auto 12px' }} />
                <p className="portal-text-muted">Localizando pedidos...</p>
              </div>
            ) : totalCount === 0 ? (
              <div className="portal-empty-card" style={{ padding: 32 }}>
                <p className="portal-empty-text">Nenhum pedido encontrado para "{searchedQuery}".</p>
              </div>
            ) : orders.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <p className="portal-text-muted">Utilize o campo acima para buscar pedidos de clientes.</p>
              </div>
            ) : (
              <div className="portal-admin-list">
                {orders.map((ord) => {
                  const isSelected = selectedOrderId === ord.order_id
                  return (
                    <div
                      key={ord.order_id}
                      className={`portal-admin-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectOrder(ord.order_id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="portal-admin-item-top">
                        <span className="portal-admin-item-num">
                          {ord.order_number || ord.vega_order_id}
                        </span>
                        <span className="portal-admin-item-date">
                          {formatDateBRL(ord.created_at)}
                        </span>
                      </div>

                      <div className="portal-admin-item-customer">
                        <strong>{ord.customer_name || 'Cliente'}</strong>
                        <span className="portal-text-muted"> ({ord.customer_email})</span>
                      </div>

                      <div className="portal-admin-item-bottom">
                        <span className="portal-meta-price">{formatCurrencyBRL(ord.total)}</span>
                        <div className="portal-badge-group">
                          <span className={`portal-status-badge portal-status-${ord.fulfillment_status}`}>
                            {getFulfillmentStatusLabel(ord.fulfillment_status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Paginação Simples */}
                {totalCount && totalCount > PAGE_SIZE && (
                  <div className="portal-pagination">
                    <button
                      type="button"
                      className="portal-btn portal-btn-secondary portal-btn-sm"
                      disabled={pageOffset === 0 || searchLoading}
                      onClick={() => executeSearch(searchedQuery, Math.max(0, pageOffset - PAGE_SIZE))}
                    >
                      ← Anterior
                    </button>
                    <span className="portal-text-muted">
                      {pageOffset + 1} - {Math.min(pageOffset + PAGE_SIZE, totalCount)} de {totalCount}
                    </span>
                    <button
                      type="button"
                      className="portal-btn portal-btn-secondary portal-btn-sm"
                      disabled={pageOffset + PAGE_SIZE >= totalCount || searchLoading}
                      onClick={() => executeSearch(searchedQuery, pageOffset + PAGE_SIZE)}
                    >
                      Próxima →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Coluna da Direita: Detalhes e Cadastro de Rastreamento */}
          <div className="portal-card portal-admin-detail-col">
            {detailLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div className="portal-spinner" style={{ margin: '0 auto 12px' }} />
                <p className="portal-text-muted">Carregando detalhes do pedido...</p>
              </div>
            ) : detailError ? (
              <div className="portal-alert portal-alert-error" style={{ margin: 24 }}>
                <span>⚠️ {detailError}</span>
              </div>
            ) : !selectedOrder ? (
              <div className="portal-empty-card" style={{ padding: 48 }}>
                <div className="portal-empty-icon">👈</div>
                <h3 className="portal-empty-title">Nenhum pedido selecionado</h3>
                <p className="portal-empty-text">
                  Selecione um pedido na coluna ao lado para visualizar os detalhes e cadastrar o código de rastreamento.
                </p>
              </div>
            ) : (
              <div className="portal-admin-detail-content">

                {/* Cabeçalho do Pedido */}
                <div className="portal-admin-detail-header">
                  <div>
                    <span className="portal-label-muted">PEDIDO SELECIONADO</span>
                    <h2 className="portal-detail-title" style={{ fontSize: 22, margin: '4px 0' }}>
                      {selectedOrder.order.order_number || selectedOrder.order.vega_order_id}
                    </h2>
                    <span className="portal-text-muted" style={{ fontSize: 13 }}>
                      ID Vega: {selectedOrder.order.vega_order_id}
                    </span>
                  </div>
                  <div className="portal-badge-group">
                    <span className={`portal-status-badge portal-status-${selectedOrder.order.payment_status}`}>
                      {getPaymentStatusLabel(selectedOrder.order.payment_status)}
                    </span>
                    <span className={`portal-status-badge portal-status-${selectedOrder.order.fulfillment_status}`}>
                      {getFulfillmentStatusLabel(selectedOrder.order.fulfillment_status)}
                    </span>
                  </div>
                </div>

                {/* Dados do Cliente e Endereço */}
                <div className="portal-admin-info-grid">
                  <div className="portal-admin-info-box">
                    <h4 className="portal-admin-box-title">Cliente</h4>
                    <p className="portal-admin-info-line"><strong>{selectedOrder.customer.full_name || 'Não informado'}</strong></p>
                    <p className="portal-admin-info-line">{selectedOrder.customer.email}</p>
                  </div>

                  <div className="portal-admin-info-box">
                    <h4 className="portal-admin-box-title">Endereço de Envio</h4>
                    <p className="portal-admin-info-line">
                      {selectedOrder.shipping_address.street || <span style={{ color: '#ef4444' }}>Logradouro não informado</span>}
                      {', '}
                      {validateShippingAddress(selectedOrder.shipping_address).isMissingNumber ? (
                        <strong style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 6px', borderRadius: 4 }}>
                          Número não informado
                        </strong>
                      ) : (
                        formatAddressNumber(selectedOrder.shipping_address.number)
                      )}
                    </p>
                    <p className="portal-admin-info-line">
                      {selectedOrder.shipping_address.city || <span style={{ color: '#ef4444' }}>Cidade não informada</span>}
                      {' - '}
                      {selectedOrder.shipping_address.state || <span style={{ color: '#ef4444' }}>UF não informada</span>}
                      {selectedOrder.shipping_address.zip_code ? ` (CEP: ${selectedOrder.shipping_address.zip_code})` : ' (CEP não informado)'}
                    </p>
                  </div>
                </div>

                {/* ALERTA DE ENDEREÇO INCOMPLETO (DEVE APARECER ANTES DO FORMULÁRIO DE RASTREAMENTO) */}
                {(() => {
                  const addrCheck = validateShippingAddress(selectedOrder.shipping_address)
                  if (!addrCheck.isIncomplete) return null
                  return (
                    <div
                      className="portal-alert portal-alert-warning"
                      style={{
                        marginBottom: 20,
                        borderLeft: '4px solid #f59e0b',
                        background: 'rgba(245, 158, 11, 0.12)',
                        color: '#fbbf24',
                        padding: '14px 18px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <strong style={{ fontSize: 14 }}>⚠️ Endereço de entrega incompleto</strong>
                        <span style={{ fontSize: 13, color: '#fde68a' }}>
                          Atenção: Os seguintes campos estão pendentes ou ausentes: {addrCheck.missingFields.join(', ')}.
                          Verifique com o cliente antes de despachar o pedido.
                        </span>
                      </div>
                    </div>
                  )
                })()}

                {/* FORMULÁRIO DE CADASTRO DE RASTREAMENTO */}
                <div className="portal-admin-shipment-card">
                  <h3 className="portal-card-heading" style={{ fontSize: 16, marginBottom: 12 }}>
                    📦 Despacho e Rastreamento
                  </h3>

                  {selectedOrder.order.tracking_code && (
                    <div className="portal-current-tracking-box">
                      <span>Rastreio atual: <strong>{selectedOrder.order.tracking_code}</strong> ({selectedOrder.order.carrier || 'Correios'})</span>
                      <a
                        href={build17TrackUrl(selectedOrder.order.tracking_code)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="portal-btn-link"
                      >
                        17TRACK ↗
                      </a>
                    </div>
                  )}

                  {shipmentMessage && (
                    <div className={`portal-alert portal-alert-${shipmentMessage.type}`} style={{ marginBottom: 16 }}>
                      <span>{shipmentMessage.text}</span>
                    </div>
                  )}

                  <form onSubmit={(e) => handleRegisterShipment(e, false)}>
                    <div className="portal-form-group">
                      <label htmlFor="admin-tracking-input" className="portal-label">
                        Código de Rastreamento
                      </label>
                      <input
                        id="admin-tracking-input"
                        type="text"
                        className="portal-input"
                        placeholder="Ex: NL123456789BR"
                        value={inputTrackingCode}
                        onChange={(e) => setInputTrackingCode(e.target.value.toUpperCase())}
                        disabled={shipmentLoading}
                        required
                      />
                    </div>

                    <div className="portal-form-group">
                      <label htmlFor="admin-carrier-input" className="portal-label">
                        Transportadora (Opcional)
                      </label>
                      <input
                        id="admin-carrier-input"
                        type="text"
                        className="portal-input"
                        placeholder="Correios"
                        value={inputCarrier}
                        onChange={(e) => setInputCarrier(e.target.value)}
                        disabled={shipmentLoading}
                      />
                    </div>

                    {showReplaceConfirm && (
                      <div className="portal-replace-confirm-box">
                        <label className="portal-checkbox-label">
                          <input
                            type="checkbox"
                            checked={replaceExisting}
                            onChange={(e) => setReplaceExisting(e.target.checked)}
                          />
                          <span>Confirmar substituição do código existente</span>
                        </label>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="portal-btn portal-btn-primary"
                      disabled={shipmentLoading || !inputTrackingCode.trim() || (showReplaceConfirm && !replaceExisting)}
                      style={{ width: '100%' }}
                    >
                      {shipmentLoading
                        ? 'Registrando e enfileirando e-mail...'
                        : selectedOrder.order.tracking_code
                        ? 'Atualizar Rastreamento'
                        : 'Cadastrar Rastreamento'}
                    </button>
                  </form>
                </div>

                {/* Itens do Pedido */}
                <div style={{ marginTop: 24 }}>
                  <h4 className="portal-admin-box-title">Itens Comprados ({selectedOrder.items.length})</h4>
                  <div className="portal-items-list">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="portal-item-row">
                        <div className="portal-item-info">
                          <span className="portal-item-name">{item.product_name}</span>
                          <span className="portal-item-qty">Qtd: {item.quantity} | SKU: {item.sku || 'N/A'}</span>
                        </div>
                        <span className="portal-item-price">{formatCurrencyBRL(item.unit_price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Eventos de Rastreio */}
                {selectedOrder.tracking_events.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <h4 className="portal-admin-box-title">Eventos de Rastreamento ({selectedOrder.tracking_events.length})</h4>
                    <div className="portal-events-list">
                      {selectedOrder.tracking_events.map((te) => (
                        <div key={te.id} className="portal-event-item">
                          <div className="portal-event-dot" />
                          <div className="portal-event-content">
                            <span className="portal-event-status">{getFulfillmentStatusLabel(te.status)}</span>
                            <span className="portal-event-date">{formatDateBRL(te.occurred_at)} (Origem: {te.source})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resumo da Outbox de E-mails */}
                {selectedOrder.email_events.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <h4 className="portal-admin-box-title">Status da Fila de E-mails ({selectedOrder.email_events.length})</h4>
                    <div className="portal-admin-email-events">
                      {selectedOrder.email_events.map((ee) => (
                        <div key={ee.id} className="portal-email-event-row">
                          <span className="portal-email-template">{ee.template_key}</span>
                          <span className={`portal-status-badge portal-status-${ee.status}`}>{ee.status}</span>
                          <span className="portal-text-muted" style={{ fontSize: 12 }}>
                            Tentativas: {ee.attempt_count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
