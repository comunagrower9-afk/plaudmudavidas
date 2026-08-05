import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OtpAuthForm } from '../../components/auth/OtpAuthForm'
import { supabase } from '../../lib/supabase'
import { isClaimCustomerResult } from '../../types/portal.types'
import '../../styles/portal.css'

export const CustomerLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const [claimError, setClaimError] = useState<string | null>(null)

  const handleLoginSuccess = async () => {
    try {
      // Invoca a RPC atômica claim_customer_account sem parâmetros
      const { data, error } = await supabase.rpc('claim_customer_account')

      if (error) {
        // Redireciona para /minha-conta mesmo com erro transitório na RPC (RLS gerencia acessos)
        navigate('/minha-conta')
        return
      }

      if (isClaimCustomerResult(data)) {
        if (data.status === 'conflict') {
          setClaimError('Houve um conflito na vinculação da sua conta. Por favor, responda ao e-mail de confirmação do pedido para obter suporte.')
          return
        }
      }

      navigate('/minha-conta')
    } catch {
      navigate('/minha-conta')
    }
  }

  return (
    <div className="portal-page-wrapper">
      <div className="portal-container">
        {claimError && (
          <div className="portal-alert portal-alert-error" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
            <span>⚠️ {claimError}</span>
          </div>
        )}

        <OtpAuthForm
          title="Acompanhar seus pedidos"
          subtitle="Informe o mesmo e-mail utilizado na sua compra do Plaud Note para consultar status e rastreamento."
          badgeText="PORTAL DO CLIENTE"
          shouldCreateUser={true}
          onSuccess={handleLoginSuccess}
          footerLink={{
            label: '← Voltar para a loja',
            href: '/',
          }}
        />
      </div>
    </div>
  )
}
