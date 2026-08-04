import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Automatically clean up DOM after each test
afterEach(() => {
  cleanup()
})

// Polyfill window.scrollTo if needed in jsdom
if (typeof window !== 'undefined') {
  window.scrollTo = () => {}
}
