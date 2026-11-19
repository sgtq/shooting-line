import { t } from '@shooting-line/i18n'
import { storeToRefs } from 'pinia'
import { summarizeDecision } from '../services/archerRequests'
import { makeId } from '../services/ids'
import { useManagerStore } from '../stores/managerStore'

/**
 * Saves for archer login requests.
 * @param {{ repository: object, scope: { clubId?: string }, notify: (message: string) => void }} context
 * `scope` is the signed-in user's scope. A club's requests belong to its own club.
 * @returns {{
 *   createArcherRequest: (participantId: string) => Promise<void>,
 *   decideArcherRequests: (decision: { action: 'approve'|'reject', requestIds: string[] }) => Promise<void>,
 * }} The functions the Requests page calls.
 */
export function useArcherRequestActions({ repository, scope, notify }) {
  const store = useManagerStore()
  const { data, databaseError } = storeToRefs(store)

  /**
   * @param {string} participantId The archer the club asks a login for.
   * @returns {Promise<void>}
   */
  async function createArcherRequest(participantId) {
    const request = {
      id: makeId(),
      participantId,
      clubId: scope.clubId || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    const wasSaved = await store.persistChange(
      () => repository.createArcherRequest(request),
      () => {
        data.value.archerRequests ??= []
        data.value.archerRequests.push(request)
      },
    )
    if (wasSaved) notify('Request sent')
  }

  /**
   * Some requests in a batch can fail while others work, so each outcome is applied on its own.
   * @param {{ action: 'approve'|'reject', requestIds: string[] }} decision
   * @returns {Promise<void>}
   */
  async function decideArcherRequests({ action, requestIds }) {
    const status = action === 'approve' ? 'approved' : 'rejected'
    let results
    try {
      results = await repository.decideArcherRequests(action, requestIds)
    } catch (error) {
      databaseError.value = `${t('Save failed')}: ${error.message}`
      return
    }
    const { succeededIds, failures } = summarizeDecision(results)
    for (const request of data.value.archerRequests ?? []) {
      if (succeededIds.includes(request.id)) request.status = status
    }
    if (failures.length) {
      databaseError.value = `${t('Some requests could not be decided')}: ${failures.join('; ')}`
      return
    }
    databaseError.value = ''
    notify(action === 'approve' ? 'Requests approved' : 'Requests rejected')
  }

  return { createArcherRequest, decideArcherRequests }
}
