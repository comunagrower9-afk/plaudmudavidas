import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Automatically clean up DOM after each test
afterEach(() => {
  cleanup()
})

// Polyfill window.scrollTo and IntersectionObserver if needed in jsdom
if (typeof window !== 'undefined') {
  window.scrollTo = () => {}
  class MockIntersectionObserver {
    observe = () => null
    unobserve = () => null
    disconnect = () => null
  }
  window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
}
