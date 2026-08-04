import { describe, it, expect } from 'vitest'
import {
  sanitizeCustomerName,
  sanitizeAndMaskEmail,
  isSanitizedCustomerContext,
  extractAndCleanUrlParams,
} from '../lib/thank-you-sanitizer'

describe('Módulo de Sanitização (/obrigado)', () => {
  describe('sanitizeCustomerName', () => {
    it('extrai corretamente o primeiro nome de um nome válido', () => {
      expect(sanitizeCustomerName('Carlos Silva')).toBe('Carlos')
      expect(sanitizeCustomerName('Maria Eduarda')).toBe('Maria')
      expect(sanitizeCustomerName('João-Pedro Santos')).toBe('João-Pedro')
      expect(sanitizeCustomerName("D'Angelo Souza")).toBe("D'Angelo")
      expect(sanitizeCustomerName('   Ana   Paula  ')).toBe('Ana')
    })

    it('aceita caracteres e acentuações Unicode legítimos', () => {
      expect(sanitizeCustomerName('Érica Valença')).toBe('Érica')
      expect(sanitizeCustomerName('Ícaro Nunes')).toBe('Ícaro')
      expect(sanitizeCustomerName('Ângela Ferreira')).toBe('Ângela')
    })

    it('rejeita tags HTML e vetores XSS retornando null', () => {
      expect(sanitizeCustomerName('<img src=x onerror=alert(1)>')).toBeNull()
      expect(sanitizeCustomerName('<script>alert(1)</script>')).toBeNull()
      expect(sanitizeCustomerName('Carlos<script>')).toBeNull()
      expect(sanitizeCustomerName('javascript:void(0)')).toBeNull()
      expect(sanitizeCustomerName('Robert"); DROP TABLE students;--')).toBeNull()
      expect(sanitizeCustomerName('alert(document.cookie)')).toBeNull()
    })

    it('rejeita números e símbolos não permitidos', () => {
      expect(sanitizeCustomerName('Carlos123')).toBeNull()
      expect(sanitizeCustomerName('Carlos@Silva')).toBeNull()
      expect(sanitizeCustomerName('$$$')).toBeNull()
      expect(sanitizeCustomerName('123456')).toBeNull()
    })

    it('remove caracteres de controle invisíveis', () => {
      expect(sanitizeCustomerName('Carlos\u0000\u001F Silva')).toBe('Carlos')
    })

    it('limita o tamanho a 40 caracteres', () => {
      const longName = 'A'.repeat(100) + ' Silva'
      const sanitized = sanitizeCustomerName(longName)
      expect(sanitized).toBe('A'.repeat(40))
      expect(sanitized?.length).toBe(40)
    })

    it('retorna null para valores vazios, indefinidos ou tipos inválidos', () => {
      expect(sanitizeCustomerName('')).toBeNull()
      expect(sanitizeCustomerName('   ')).toBeNull()
      expect(sanitizeCustomerName(null)).toBeNull()
      expect(sanitizeCustomerName(undefined)).toBeNull()
      expect(sanitizeCustomerName(123)).toBeNull()
      expect(sanitizeCustomerName({})).toBeNull()
    })
  })

  describe('sanitizeAndMaskEmail', () => {
    it('mascara corretamente e-mails válidos', () => {
      expect(sanitizeAndMaskEmail('carlos.silva@gmail.com')).toBe('c***@gmail.com')
      expect(sanitizeAndMaskEmail('contato@empresa.com.br')).toBe('c***@empresa.com.br')
      expect(sanitizeAndMaskEmail('ANA@OUTLOOK.COM')).toBe('a***@outlook.com')
      expect(sanitizeAndMaskEmail('usuario+tag@dominio.io')).toBe('u***@dominio.io')
    })

    it('rejeita e-mails malformados retornando null', () => {
      expect(sanitizeAndMaskEmail('invalido')).toBeNull()
      expect(sanitizeAndMaskEmail('@sem-local.com')).toBeNull()
      expect(sanitizeAndMaskEmail('sem-dominio@')).toBeNull()
      expect(sanitizeAndMaskEmail('espaco @dominio.com')).toBeNull()
      expect(sanitizeAndMaskEmail('usuario@semtld')).toBeNull()
      expect(sanitizeAndMaskEmail('<script>@dominio.com')).toBeNull()
    })

    it('rejeita e-mails que excedam 254 caracteres', () => {
      const longLocal = 'a'.repeat(250) + '@gmail.com'
      expect(sanitizeAndMaskEmail(longLocal)).toBeNull()
    })

    it('retorna null para valores nulos, vazios ou não strings', () => {
      expect(sanitizeAndMaskEmail('')).toBeNull()
      expect(sanitizeAndMaskEmail(null)).toBeNull()
      expect(sanitizeAndMaskEmail(undefined)).toBeNull()
      expect(sanitizeAndMaskEmail(12345)).toBeNull()
    })
  })

  describe('isSanitizedCustomerContext', () => {
    it('valida corretamente objetos válidos', () => {
      expect(
        isSanitizedCustomerContext({ firstName: 'Carlos', maskedEmail: 'c***@gmail.com' })
      ).toBe(true)
      expect(isSanitizedCustomerContext({ firstName: null, maskedEmail: null })).toBe(true)
      expect(
        isSanitizedCustomerContext({ firstName: 'Ana', maskedEmail: null })
      ).toBe(true)
    })

    it('rejeita objetos que contenham dados suspeitos ou tipos inválidos', () => {
      expect(
        isSanitizedCustomerContext({ firstName: '<script>', maskedEmail: 'c***@gmail.com' })
      ).toBe(false)
      expect(
        isSanitizedCustomerContext({ firstName: 'Carlos', maskedEmail: 'carlos@gmail.com' })
      ).toBe(false) // e-mail não mascarado é rejeitado pelo type guard
      expect(isSanitizedCustomerContext(null)).toBe(false)
      expect(isSanitizedCustomerContext('string')).toBe(false)
    })
  })

  describe('extractAndCleanUrlParams', () => {
    it('executa a limpeza de parâmetros da URL sem lançar exceções', () => {
      const result = extractAndCleanUrlParams()
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })
  })
})
