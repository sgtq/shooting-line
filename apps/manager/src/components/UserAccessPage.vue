<script setup>
import { t } from '@shooting-line/i18n'
import { computed } from 'vue'

const props = defineProps({
  userRoles: { type: Array, required: true },
  userId: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false },
})
const emit = defineEmits(['add', 'reset-password', 'remove'])

const managerRoles = computed(() => props.userRoles.filter((item) => ['admin', 'manager'].includes(item.role)))

/**
 * The last admin cannot remove their own role, or nobody could manage access afterwards.
 * @param {{ role: string, userId: string }} role
 * @returns {boolean} True when removing this role would leave no admin.
 */
function isLastAdmin(role) {
  const admins = props.userRoles.filter((item) => item.role === 'admin')
  return role.role === 'admin' && role.userId === props.userId && admins.length === 1
}
</script>

<template>
  <section>
    <div class="page-heading heading-row">
      <div>
        <p class="eyebrow">{{ t('ACCOUNT MANAGEMENT') }}</p>
        <h1>{{ t('User access') }}</h1>
        <p class="page-subtitle">{{ t('Assign manager roles and send password reset emails.') }}</p>
      </div>
      <div v-if="isAdmin" class="heading-actions">
        <button class="button button-primary" @click="emit('add')"><span>＋</span> {{ t('Add manager') }}</button>
      </div>
    </div>
    <section class="panel table-panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('ACCOUNT') }}</th>
              <th>{{ t('ROLE') }}</th>
              <th>{{ t('SCOPE') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in managerRoles" :key="`${role.userId}-${role.role}`">
              <td>{{ role.email }}</td>
              <td>{{ role.role === 'admin' ? t('System admin') : t('Manager') }}</td>
              <td>{{ t('All records') }}</td>
              <td class="row-actions">
                <button class="text-link" @click="emit('reset-password', role)">
                  {{ t('Send password reset') }}
                </button>
                <button v-if="isAdmin" class="text-link" :disabled="isLastAdmin(role)" @click="emit('remove', role)">
                  {{ t('Remove role') }}
                </button>
              </td>
            </tr>
            <tr v-if="!managerRoles.length">
              <td colspan="4">
                <div class="table-empty">{{ t('No manager assignments found.') }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <p class="privacy-note">
      {{
        t(
          'A reset email can only be requested by an admin or manager. The account must already exist in Supabase Auth.',
        )
      }}
    </p>
  </section>
</template>
