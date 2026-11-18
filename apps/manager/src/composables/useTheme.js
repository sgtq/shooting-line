import { ref, watch } from 'vue'

const THEME_STORAGE_KEY = 'shooting-line-theme'

/**
 * @returns {'light'|'dark'} The saved theme, or light when nothing usable is saved.
 */
function readSavedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    // Storage can be blocked, for example in a private window. The theme then lasts for the visit only.
    return 'light'
  }
}

/**
 * The light or dark theme, kept in step with the page and the browser storage.
 * @returns {{ theme: import('vue').Ref<'light'|'dark'>, toggleTheme: () => void }}
 */
export function useTheme() {
  const theme = ref(readSavedTheme())

  watch(
    theme,
    (value) => {
      document.documentElement.dataset.theme = value
      try {
        localStorage.setItem(THEME_STORAGE_KEY, value)
      } catch {
        // See readSavedTheme.
      }
    },
    { immediate: true },
  )

  /** @returns {void} */
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, toggleTheme }
}
