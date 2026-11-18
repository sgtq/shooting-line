import { t } from '@shooting-line/i18n'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Where a failed save shows its message. */
export const ERROR_TARGETS = { page: 'page', modal: 'modal', targetType: 'targetType' }

export const useManagerStore = defineStore('manager', () => {
  const data = ref({})
  const databaseError = ref('')
  const modalError = ref('')
  const targetTypeError = ref('')

  /**
   * @param {object} initialData The workspace loaded from the repository.
   * @returns {void}
   */
  function load(initialData) {
    data.value = initialData
  }

  /** @returns {void} */
  function clearErrors() {
    databaseError.value = ''
    modalError.value = ''
    targetTypeError.value = ''
  }

  /**
   * Runs a save, and only changes local state when it worked, so the screen never shows data the
   * database refused.
   * @param {() => Promise<unknown>} operation The call to the repository.
   * @param {() => void} updateLocalState Applied after the operation succeeds.
   * @param {string} [errorTarget] Where a failure message goes, one of ERROR_TARGETS.
   * @returns {Promise<boolean>} True when the save worked.
   */
  async function persistChange(operation, updateLocalState, errorTarget = ERROR_TARGETS.page) {
    try {
      await operation()
      updateLocalState()
      clearErrors()
      return true
    } catch (error) {
      const message = `${t('Save failed')}: ${error.message}`
      if (errorTarget === ERROR_TARGETS.modal) modalError.value = message
      else if (errorTarget === ERROR_TARGETS.targetType) targetTypeError.value = message
      else databaseError.value = message
      return false
    }
  }

  /**
   * @param {string} id
   * @returns {object|undefined} The club with that id.
   */
  function clubFor(id) {
    return data.value.clubs.find((club) => club.id === id)
  }

  /**
   * @param {string} id
   * @returns {object|undefined} The tournament type with that id.
   */
  function tournamentTypeFor(id) {
    return data.value.tournamentTypes.find((type) => type.id === id)
  }

  /**
   * @param {string} id
   * @returns {object|undefined} The category with that id.
   */
  function categoryFor(id) {
    return data.value.categories.find((category) => category.id === id)
  }

  /**
   * @param {string} id
   * @returns {object|undefined} The archer with that id.
   */
  function participantById(id) {
    return data.value.participants.find((person) => person.id === id)
  }

  return {
    data,
    databaseError,
    modalError,
    targetTypeError,
    load,
    clearErrors,
    persistChange,
    clubFor,
    tournamentTypeFor,
    categoryFor,
    participantById,
  }
})
