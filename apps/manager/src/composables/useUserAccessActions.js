import { storeToRefs } from 'pinia'
import { useManagerStore } from '../stores/managerStore'

/**
 * Saves on the User access page.
 * @param {{ repository: object, notify: (message: string) => void }} context
 * @returns {object} `removeUserRole` and `sendRolePasswordReset`, the functions the page calls.
 */
export function useUserAccessActions({ repository, notify }) {
  const store = useManagerStore()
  const { data } = storeToRefs(store)

  /** @returns {Promise<void>} */
  async function removeUserRole(role) {
    if (
      !(await store.persistChange(
        () => repository.removeUserRole(role.userId, role.role),
        () => {
          data.value.userRoles = data.value.userRoles.filter(
            (item) => item.userId !== role.userId || item.role !== role.role,
          )
        },
      ))
    )
      return
    notify('User role removed')
  }

  /** @returns {Promise<void>} */
  async function sendRolePasswordReset(role) {
    if (
      !(await store.persistChange(
        () => repository.sendAdminPasswordReset(role.email),
        () => {},
      ))
    )
      return

    notify('If the account exists, a password reset email will be sent')
  }

  return { removeUserRole, sendRolePasswordReset }
}
