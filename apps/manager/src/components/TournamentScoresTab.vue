<script setup>
import { t } from '@shooting-line/i18n'
import NavIcon from './NavIcon.vue'

const props = defineProps({
  tournament: { type: Object, required: true },
  rows: { type: Array, required: true },
  categories: { type: Array, required: true },
  scoredCount: { type: Number, default: 0 },
  archerCount: { type: Number, default: 0 },
  canManage: { type: Boolean, default: false },
  canEditTournament: { type: Boolean, default: false },
})
const emit = defineEmits(['add-round', 'save-score', 'view-archers'])
const round = defineModel('round', { type: String, default: '' })
const newRoundName = defineModel('newRoundName', { type: String, default: '' })

/**
 * @param {string} categoryId
 * @returns {string} The category name, or a label when the archer has none.
 */
function categoryName(categoryId) {
  return props.categories.find((category) => category.id === categoryId)?.name || t('Unassigned')
}
</script>

<template>
  <section class="panel score-workspace">
    <div class="score-toolbar">
      <label class="select-field"
        ><span>{{ t('TOURNAMENT ROUND') }}</span
        ><select v-model="round">
          <option v-for="name in tournament.rounds" :key="name">{{ name }}</option>
        </select></label
      >
      <form v-if="canEditTournament" class="add-round-form" @submit.prevent="emit('add-round')">
        <input v-model="newRoundName" :placeholder="t('Add a round...')" :aria-label="t('New round name')" /><button
          class="button button-small button-outline"
          type="submit"
        >
          {{ t('＋ Add round') }}
        </button>
      </form>
      <div class="score-completion">
        <strong
          >{{ scoredCount }}<small> / {{ archerCount }}</small></strong
        ><span>{{ t('scores entered') }}</span>
      </div>
    </div>
    <div v-if="rows.length" class="table-wrap">
      <table class="score-table">
        <thead>
          <tr>
            <th>{{ t('ARCHER') }}</th>
            <th>{{ t('CATEGORY') }}</th>
            <th>{{ t('WORLD ARCHERY ID') }}</th>
            <th>{{ t('ROUND SCORE') }}</th>
            <th>{{ t('STATUS') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.participant.id">
            <td>
              <div class="person-cell">
                <span class="person-avatar"
                  >{{ row.participant.firstName.charAt(0) }}{{ row.participant.lastName.charAt(0) }}</span
                ><strong>{{ row.participant.lastName }}, {{ row.participant.firstName }}</strong>
              </div>
            </td>
            <td>{{ categoryName(row.categoryId) }}</td>
            <td>{{ row.participant.waId || '—' }}</td>
            <td>
              <input
                class="score-input sl-score"
                type="number"
                min="0"
                :value="row.score"
                :placeholder="t('Enter score')"
                :disabled="!canManage"
                @change="emit('save-score', row.participant.id, $event.target.value)"
              />
            </td>
            <td>
              <span class="status-pill" :class="row.score !== '' ? 'status-active' : 'status-pending'"
                ><i></i>{{ row.score !== '' ? 'Recorded' : 'Pending' }}</span
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty-state">
      <div class="empty-icon"><NavIcon name="archers" /></div>
      <strong>{{ t('No archers added') }}</strong>
      <p>{{ t('Add archers in the Archers section of this tournament before recording scores.') }}</p>
      <button class="button button-outline" @click="emit('view-archers')">{{ t('View archers') }}</button>
    </div>
    <div v-if="canManage && rows.length" class="score-footnote">
      {{ t('Enter or update an archer’s score; changes save against this tournament and round.') }}
    </div>
  </section>
</template>
