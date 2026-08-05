import React from 'react'
import { Link } from 'react-router-dom'
import '../styles/portal.css'

export const NotFoundPage: React.FC = () => {
  return (
    <div className="portal-page-wrapper">
      <div className="portal-container">
        <div className="portal-card portal-empty-card" style={{ maxWidth: 500, margin: '60px auto' }}>
          <div className="portal-brand-mini" style={{ marginBottom: 16 }}>PLAUD</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>404</div>
          <h1 className="portal-empty-title">Página não encontrada</h1>
          <p className="portal-empty-text">
            O endereço que você tentou acessar não existe ou foi movido.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
            <Link to="/" className="portal-btn portal-btn-primary" style={{ textDecoration: 'none' }}>
              Ir para a loja
            </Link>
            <Link to="/minha-conta" className="portal-btn portal-btn-secondary" style={{ textDecoration: 'none' }}>
              Acessar meus pedidos
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
