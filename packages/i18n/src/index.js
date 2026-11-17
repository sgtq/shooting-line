import { ref } from 'vue'
import { spanish } from './spanish.js'

const storageKey = 'shooting-line-language'

function storedLanguage() {
  try {
    return localStorage.getItem(storageKey) === 'es-419' ? 'es-419' : 'en'
  } catch (error) {
    console.warn('Unable to read the language preference:', error)
    return 'en'
  }
}

export const language = ref(storedLanguage())

function updateDocumentLanguage() {
  document.documentElement.lang = language.value
}

updateDocumentLanguage()

export function setLanguage(value) {
  if (value !== 'en' && value !== 'es-419') throw new Error('Unsupported language')
  language.value = value
  updateDocumentLanguage()
  try {
    localStorage.setItem(storageKey, value)
  } catch (error) {
    console.warn('Unable to save the language preference:', error)
  }
}

window.addEventListener('storage', (event) => {
  if (event.key === storageKey) {
    language.value = event.newValue === 'es-419' ? 'es-419' : 'en'
    updateDocumentLanguage()
  }
})

export function t(text, values = {}) {
  const translation = language.value === 'es-419' ? spanish[text.toLowerCase()] : text
  if (translation === undefined) {
    console.warn(`Missing Spanish translation: ${text}`)
    return text
  }
  const output = language.value === 'es-419' && text === text.toUpperCase() ? translation.toUpperCase() : translation
  return output.replace(/\{(\w+)\}/g, (match, key) => (Object.hasOwn(values, key) ? String(values[key]) : match))
}
