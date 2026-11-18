import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useNavItems } from './useNavItems'

function ids(canManage, isClubUser) {
  return useNavItems(ref(canManage), ref(isClubUser)).value.map((item) => item.id)
}

describe('useNavItems', () => {
  it('shows managers every item', () => {
    expect(ids(true, false)).toEqual([
      'dashboard',
      'tournaments',
      'tournament-types',
      'categories',
      'clubs',
      'participants',
      'requests',
      'user-access',
      'plans',
    ])
  })

  it('hides user access and plans from clubs but keeps requests', () => {
    const list = ids(false, true)
    expect(list).toContain('requests')
    expect(list).not.toContain('user-access')
    expect(list).not.toContain('plans')
  })

  it('hides requests, user access and plans from anyone else', () => {
    const list = ids(false, false)
    expect(list).not.toContain('requests')
    expect(list).not.toContain('user-access')
    expect(list).not.toContain('plans')
  })
})
