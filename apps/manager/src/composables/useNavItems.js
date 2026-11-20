import { t } from '@shooting-line/i18n'
import { computed } from 'vue'

const ALL_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'tournaments', label: 'Tournaments', icon: 'tournaments' },
  { id: 'tournament-types', label: 'Tournament types', icon: 'tournament-types' },
  { id: 'categories', label: 'Categories', icon: 'categories' },
  { id: 'clubs', label: 'Clubs', icon: 'clubs' },
  { id: 'participants', label: 'Archers', icon: 'archers' },
  { id: 'requests', label: 'Requests', icon: 'requests' },
  { id: 'user-access', label: 'User access', icon: 'user-access' },
  { id: 'plans', label: 'Plans', icon: 'plans' },
]

/**
 * @param {import('vue').Ref<boolean>} canManage True for managers and admins.
 * @param {import('vue').Ref<boolean>} isClubUser True for club users.
 * @returns {import('vue').ComputedRef<{ id: string, label: string, icon: string }[]>} The sidebar items the
 * user may open, with translated labels.
 */
export function useNavItems(canManage, isClubUser) {
  return computed(() =>
    ALL_NAV_ITEMS.filter((item) => !['user-access', 'plans'].includes(item.id) || canManage.value)
      .filter((item) => item.id !== 'requests' || canManage.value || isClubUser.value)
      .map((item) => ({ ...item, label: t(item.label) })),
  )
}
