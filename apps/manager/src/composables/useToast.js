import { t } from '@shooting-line/i18n'
import { ref } from 'vue'

const TOAST_MILLISECONDS = 2800

/**
 * @returns {{ toast: import('vue').Ref<string>, notify: (message: string, values?: object) => void }}
 * A short message that clears itself.
 */
export function useToast() {
  const toast = ref('')

  /**
   * @param {string} message A translation key.
   * @param {object} [values] Values for the placeholders in the message.
   * @returns {void}
   */
  function notify(message, values) {
    const translated = t(message, values)
    toast.value = translated
    window.setTimeout(() => {
      // A newer message may have replaced this one. Only clear our own.
      if (toast.value === translated) toast.value = ''
    }, TOAST_MILLISECONDS)
  }

  return { toast, notify }
}
