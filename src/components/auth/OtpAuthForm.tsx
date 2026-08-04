import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface OtpAuthFormProps {
  title: string
  subtitle: string
  badgeText?: string
  shouldCreateUser: boolean
  onSuccess: () => Promise<void> | void
  footerLink?: {
    label: string
    href: string
  }
}

export const OtpAuthForm: React.FC<OtpAuthFormProps> = ({
  title,
  subtitle,
  badgeText = 'ACESSO SEGURO',
  shouldCreateUser,
  onSuccess,
  footerLink,
}) => {
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [resendSeconds, setResendSeconds] = useState(0)

  // Recupera e-mail do sessionStorage caso a página seja recarregada na etapa 2
  useEffect(() => {
    const savedEmail = sessionStorage.getItem('plaud_auth_email')
    if (savedEmail) {
      setEmail(savedEmail)
    }
  }, [])

  // Contador regressivo de 60 segundos para reenvio
  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendSeconds])

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrorMessage('Por favor, informe um endereço de e-mail válido.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser,
        },
      })

      if (error) {
        if (error.message?.includes('Signups not allowed') || error.message?.includes('User not found')) {
          setErrorMessage('Conta de operador não encontrada. Verifique o e-mail informado.')
        } else if (error.message?.includes('rate limit')) {
          setErrorMessage('Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.')
        } else {
          setErrorMessage('Não foi possível enviar o código. Tente novamente em instantes.')
        }
        return
      }

      sessionStorage.setItem('plaud_auth_email', normalizedEmail)
      setStep('otp')
      setResendSeconds(60)
      setInfoMessage('Código de 6 dígitos enviado para seu e-mail.')
    } catch {
      setErrorMessage('Erro inesperado ao conectar ao servidor. Verifique sua conexão.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)

    const cleanToken = otpToken.trim()
    if (!/^\d{6}$/.test(cleanToken)) {
      setErrorMessage('O código deve conter exatamente 6 dígitos numéricos.')
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    setLoading(true)

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: cleanToken,
        type: 'email',
      })

      if (error) {
        if (error.message?.includes('Token has expired') || error.message?.includes('expired')) {
          setErrorMessage('O código expirou. Solicite um novo código abaixo.')
        } else if (error.message?.includes('invalid') || error.message?.includes('Token')) {
          setErrorMessage('Código inválido ou incorreto. Confira os 6 dígitos recebidos.')
        } else {
          setErrorMessage('Falha na verificação. Tente novamente.')
        }
        return
      }

      // Limpa dados temporários e aciona o callback de sucesso
      sessionStorage.removeItem('plaud_auth_email')
      await onSuccess()
    } catch {
      setErrorMessage('Erro ao autenticar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetEmail = () => {
    setStep('email')
    setOtpToken('')
    setErrorMessage(null)
    setInfoMessage(null)
  }

  return (
    <div className="portal-auth-card">
      {/* Badge Superior */}
      <div className="portal-badge-container">
        <span className="portal-badge">{badgeText}</span>
      </div>

      <h1 className="portal-title">{title}</h1>
      <p className="portal-subtitle">{subtitle}</p>

      {/* Mensagens de Feedback */}
      {errorMessage && (
        <div className="portal-alert portal-alert-error" role="alert">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      {infoMessage && (
        <div className="portal-alert portal-alert-info" role="status">
          <span>✉️ {infoMessage}</span>
        </div>
      )}

      {/* ETAPA 1: E-MAIL */}
      {step === 'email' ? (
        <form onSubmit={handleSendOtp} className="portal-form" noValidate>
          <div className="portal-form-group">
            <label htmlFor="portal-email-input" className="portal-label">
              E-mail de acesso
            </label>
            <input
              id="portal-email-input"
              type="email"
              className="portal-input"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="portal-btn portal-btn-primary"
            disabled={loading || !email.trim()}
          >
            {loading ? (
              <span className="portal-btn-loading">
                <span className="portal-spinner-sm" /> Enviando código...
              </span>
            ) : (
              'Enviar código de acesso'
            )}
          </button>
        </form>
      ) : (
        /* ETAPA 2: CÓDIGO OTP (6 DÍGITOS) */
        <form onSubmit={handleVerifyOtp} className="portal-form" noValidate>
          <div className="portal-email-preview">
            <span>Enviado para <strong>{email}</strong></span>
            <button
              type="button"
              className="portal-btn-link"
              onClick={handleResetEmail}
              disabled={loading}
            >
              Trocar e-mail
            </button>
          </div>

          <div className="portal-form-group">
            <label htmlFor="portal-otp-input" className="portal-label">
              Código de 6 dígitos
            </label>
            <input
              id="portal-otp-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              className="portal-input portal-input-otp"
              placeholder="000000"
              value={otpToken}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                setOtpToken(val)
              }}
              disabled={loading}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="portal-btn portal-btn-primary"
            disabled={loading || otpToken.length !== 6}
          >
            {loading ? (
              <span className="portal-btn-loading">
                <span className="portal-spinner-sm" /> Verificando...
              </span>
            ) : (
              'Acessar conta'
            )}
          </button>

          {/* Reenvio com Contador */}
          <div className="portal-resend-container">
            {resendSeconds > 0 ? (
              <span className="portal-resend-countdown">
                Reenviar código em {resendSeconds}s
              </span>
            ) : (
              <button
                type="button"
                className="portal-btn-link"
                onClick={handleSendOtp}
                disabled={loading}
              >
                Não recebeu? Reenviar código
              </button>
            )}
          </div>
        </form>
      )}

      {/* Link de Rodapé */}
      {footerLink && (
        <div className="portal-footer-link">
          <a href={footerLink.href}>{footerLink.label}</a>
        </div>
      )}
    </div>
  )
}
