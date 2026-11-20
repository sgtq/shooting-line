import { afterEach } from 'vitest'

/**
 * Node 25 and later ship an experimental `localStorage` global that is unusable without
 * `--localstorage-file` and hides the jsdom one. Pointing the global at jsdom's storage keeps
 * the tests the same on every Node version.
 * @returns {void}
 */
function useJsdomLocalStorage() {
  const storage = globalThis.jsdom?.window?.localStorage
  if (!storage) return
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
}

useJsdomLocalStorage()

// Stored values must not leak between tests, since storage lives for the whole file.
afterEach(() => {
  globalThis.localStorage?.clear()
})
