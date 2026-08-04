import { describe, it, expect } from 'vitest'
import {
  build17TrackUrl,
  isValid17TrackUrl,
  isValidTrackingCode,
  validateShippingAddress,
  formatAddressNumber,
  isMissingAddressNumber,
  isExplicitlyWithoutNumber,
} from '../lib/portal-utils'

describe('Utilitários e Verificações Estritas de Segurança do Portal', () => {
  describe('1. 17TRACK URL e Tracking Code Validation', () => {
    it('gera URL segura e válida da 17TRACK', () => {
      const url = build17TrackUrl('NL123456789BR')
      expect(url).toBe('https://www.17track.net/pt?nums=NL123456789BR')
      expect(isValid17TrackUrl(url, 'NL123456789BR')).toBe(true)
    })

    it('rejeita URLs inválidas, não-HTTPS ou de domínios maliciosos', () => {
      expect(isValid17TrackUrl('http://www.17track.net/pt?nums=NL123456789BR')).toBe(false)
      expect(isValid17TrackUrl('https://evil-17track.net/pt?nums=NL123456789BR')).toBe(false)
      expect(isValid17TrackUrl('https://www.17track.net/en?nums=NL123456789BR')).toBe(false)
      expect(isValid17TrackUrl('https://www.17track.net/pt?nums=OUTRO_CODIGO', 'NL123456789BR')).toBe(false)
      expect(isValid17TrackUrl('javascript:alert(1)')).toBe(false)
      expect(isValid17TrackUrl('')).toBe(false)
    })

    it('valida código de rastreamento com regex canônica (6 a 50 alfanuméricos)', () => {
      expect(isValidTrackingCode('NL123456789BR')).toBe(true)
      expect(isValidTrackingCode('123456789012')).toBe(true)
      expect(isValidTrackingCode('JAD123456789')).toBe(true)

      // Inválidos
      expect(isValidTrackingCode('ABC')).toBe(false) // < 6
      expect(isValidTrackingCode('NL-1234-BR')).toBe(false) // traços
      expect(isValidTrackingCode('NL 1234 BR')).toBe(false) // espaços
      expect(isValidTrackingCode('')).toBe(false)
    })
  })

  describe('2. Validação e Formatação de Endereço', () => {
    it('detecta número verdadeiramente ausente corretamente', () => {
      expect(isMissingAddressNumber(null)).toBe(true)
      expect(isMissingAddressNumber(undefined)).toBe(true)
      expect(isMissingAddressNumber('')).toBe(true)
      expect(isMissingAddressNumber('   ')).toBe(true)
      expect(isMissingAddressNumber('não informado')).toBe(true)
      expect(isMissingAddressNumber('n/a')).toBe(true)

      expect(isMissingAddressNumber('100')).toBe(false)
      expect(isMissingAddressNumber('100-A')).toBe(false)
      expect(isMissingAddressNumber(123)).toBe(false)
      expect(isMissingAddressNumber('S/N')).toBe(false)
      expect(isMissingAddressNumber('SN')).toBe(false)
      expect(isMissingAddressNumber('sem número')).toBe(false)
    })

    it('identifica variantes explícitas sem número (S/N, SN, sem número)', () => {
      expect(isExplicitlyWithoutNumber('S/N')).toBe(true)
      expect(isExplicitlyWithoutNumber('s/n')).toBe(true)
      expect(isExplicitlyWithoutNumber('SN')).toBe(true)
      expect(isExplicitlyWithoutNumber('sn')).toBe(true)
      expect(isExplicitlyWithoutNumber('sem numero')).toBe(true)
      expect(isExplicitlyWithoutNumber('sem número')).toBe(true)

      expect(isExplicitlyWithoutNumber('100')).toBe(false)
      expect(isExplicitlyWithoutNumber(null)).toBe(false)
      expect(isExplicitlyWithoutNumber('')).toBe(false)
    })

    it('formatAddressNumber normaliza S/N e exibe "Número não informado" para ausentes', () => {
      expect(formatAddressNumber(null)).toBe('Número não informado')
      expect(formatAddressNumber('')).toBe('Número não informado')
      expect(formatAddressNumber('   ')).toBe('Número não informado')
      expect(formatAddressNumber('não informado')).toBe('Número não informado')

      expect(formatAddressNumber('S/N')).toBe('S/N')
      expect(formatAddressNumber('SN')).toBe('S/N')
      expect(formatAddressNumber('sem número')).toBe('S/N')
      expect(formatAddressNumber('sem numero')).toBe('S/N')
      expect(formatAddressNumber('450')).toBe('450')
      expect(formatAddressNumber('102-B')).toBe('102-B')
    })

    it('validateShippingAddress aceita S/N como válido e não gera erro', () => {
      const validWithSn = {
        street: 'Avenida Paulista',
        number: 'S/N',
        city: 'São Paulo',
        state: 'SP',
        zip_code: '01310-100',
      }
      const res = validateShippingAddress(validWithSn)
      expect(res.isIncomplete).toBe(false)
      expect(res.isMissingNumber).toBe(false)
      expect(res.missingFields).toHaveLength(0)
    })

    it('validateShippingAddress detecta todos os campos obrigatórios pendentes', () => {
      const incompleteAddr = {
        street: '   ',
        number: null,
        city: 'São Paulo',
        state: '',
        zip_code: '01310-100',
      }
      const res = validateShippingAddress(incompleteAddr)
      expect(res.isIncomplete).toBe(true)
      expect(res.isMissingNumber).toBe(true)
      expect(res.missingFields).toContain('Logradouro/Rua')
      expect(res.missingFields).toContain('Número')
      expect(res.missingFields).toContain('Estado')
      expect(res.missingFields).not.toContain('Cidade')
      expect(res.missingFields).not.toContain('CEP')
    })
  })
})
