import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { setLanguage } from '@shooting-line/i18n'
import UserAccessPage from './UserAccessPage.vue'

const roles = [
  { userId: 'a1', email: 'admin@x.test', role: 'admin' },
  { userId: 'm1', email: 'manager@x.test', role: 'manager' },
  { userId: 'c1', email: 'club@x.test', role: 'club' },
]

function mountPage(props = {}) {
  return mount(UserAccessPage, { props: { userRoles: roles, userId: 'a1', isAdmin: true, ...props } })
}

afterEach(() => setLanguage('en'))

describe('UserAccessPage', () => {
  it('lists only admins and managers', () => {
    const rows = mountPage().findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('admin@x.test')
    expect(rows[1].text()).toContain('manager@x.test')
    expect(mountPage().text()).not.toContain('club@x.test')
  })

  it('says so when there are no manager assignments', () => {
    const wrapper = mountPage({ userRoles: [roles[2]] })
    expect(wrapper.find('.table-empty').exists()).toBe(true)
  })

  it('asks to send a password reset for the chosen account', async () => {
    const wrapper = mountPage()
    await wrapper.findAll('tbody tr')[1].findAll('.text-link')[0].trigger('click')
    expect(wrapper.emitted('reset-password')[0]).toEqual([roles[1]])
  })

  it('asks to remove the chosen role', async () => {
    const wrapper = mountPage()
    await wrapper.findAll('tbody tr')[1].findAll('.text-link')[1].trigger('click')
    expect(wrapper.emitted('remove')[0]).toEqual([roles[1]])
  })

  it('stops the only admin from removing their own role', () => {
    const buttons = mountPage().findAll('tbody tr')[0].findAll('.text-link')
    expect(buttons[1].attributes('disabled')).toBeDefined()
  })

  it('lets an admin remove their own role when another admin exists', () => {
    const userRoles = [...roles, { userId: 'a2', email: 'second@x.test', role: 'admin' }]
    const buttons = mountPage({ userRoles }).findAll('tbody tr')[0].findAll('.text-link')
    expect(buttons[1].attributes('disabled')).toBeUndefined()
  })

  it('lets an admin remove another admin even when they are the only other one', () => {
    const wrapper = mountPage({ userId: 'm1' })
    expect(wrapper.findAll('tbody tr')[0].findAll('.text-link')[1].attributes('disabled')).toBeUndefined()
  })

  it('offers Add manager and Remove role only to admins', async () => {
    const asAdmin = mountPage()
    await asAdmin.find('.button-primary').trigger('click')
    expect(asAdmin.emitted('add')).toHaveLength(1)

    const asManager = mountPage({ isAdmin: false })
    expect(asManager.find('.button-primary').exists()).toBe(false)
    expect(asManager.findAll('tbody tr')[0].findAll('.text-link')).toHaveLength(1)
  })
})
