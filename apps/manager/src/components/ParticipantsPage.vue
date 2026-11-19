<script setup>
import { t } from '@shooting-line/i18n'
import { computed } from 'vue'
import { countScores, filterArchers } from '../services/archerDirectory'
import { formatDate, fullName } from '../services/display'
import NavIcon from './NavIcon.vue'

const props = defineProps({
  participants: { type: Array, required: true },
  clubs: { type: Array, required: true },
  tournaments: { type: Array, required: true },
  scores: { type: Array, required: true },
  matches: { type: Array, required: true },
  canManage: { type: Boolean, default: false },
  canManageParticipants: { type: Boolean, default: false },
  canClubEdit: { type: Boolean, default: false },
  clubId: { type: String, default: '' },
})
const emit = defineEmits(['create', 'edit', 'set-club', 'view-scores'])
const search = defineModel('search', { type: String, default: '' })

const filteredParticipants = computed(() => filterArchers(props.participants, search.value))

/**
 * @param {{ id: string }} person
 * @returns {string} The name of the archer's club, or a dash.
 */
function clubName(person) {
  return props.clubs.find((club) => club.id === person.clubId)?.name || '—'
}

/**
 * @param {{ id: string }} person
 * @returns {number} How many tournaments the archer is entered in.
 */
function tournamentCount(person) {
  return props.tournaments.filter((event) => event.participantIds.includes(person.id)).length
}

/**
 * @param {{ id: string }} person
 * @returns {number|string} The number of scores, or a message when there are none.
 */
function scoreLabel(person) {
  return countScores(person.id, props.scores, props.matches) || t('No scores yet')
}

/**
 * @param {{ clubId: string }} person
 * @returns {boolean} True when the user may edit this archer.
 */
function canEdit(person) {
  return props.canManage || (props.canClubEdit && person.clubId === props.clubId)
}
</script>

<template>
  <section>
    <div class="page-heading heading-row">
      <div>
        <p class="eyebrow">{{ t('ARCHER DIRECTORY') }}</p>
        <h1>{{ t('Archers') }}</h1>
        <p class="page-subtitle">{{ t('A reusable directory of archers for your tournaments.') }}</p>
      </div>
      <button v-if="canManageParticipants" class="button button-primary" @click="emit('create')">
        <span>＋</span> {{ t('Add archer') }}
      </button>
    </div>
    <div class="section-toolbar">
      <div class="toolbar-count">
        {{ participants.length }} {{ t('archers') }} <span>·</span> {{ t('Saved for future events') }}
      </div>
      <div class="search-box">
        <span>⌕</span><input v-model="search" :placeholder="t('Search last name or affiliation...')" />
      </div>
    </div>
    <section class="panel table-panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('ARCHER') }}</th>
              <th>{{ t('BIRTH DATE') }}</th>
              <th>{{ t('WORLD ARCHERY ID') }}</th>
              <th>{{ t('AETAY ID') }}</th>
              <th>{{ t('CLUB') }}</th>
              <th>{{ t('TOURNAMENTS') }}</th>
              <th>{{ t('SCORES') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="person in filteredParticipants" :key="person.id">
              <td>
                <div class="person-cell">
                  <span class="person-avatar">{{ person.firstName.charAt(0) }}{{ person.lastName.charAt(0) }}</span
                  ><span
                    ><strong>{{ person.lastName }}, {{ person.firstName }}</strong
                    ><small>{{ t('Archer') }}</small></span
                  >
                </div>
              </td>
              <td>{{ formatDate(person.birthDate) }}</td>
              <td>{{ person.waId || '—' }}</td>
              <td>{{ person.aetayId || '—' }}</td>
              <td>
                <select
                  v-if="canManage"
                  class="category-select participant-club-select"
                  :aria-label="t('{name} club', { name: fullName(person) })"
                  :value="person.clubId || ''"
                  @change="emit('set-club', person, $event)"
                >
                  <option value="">{{ t('No club') }}</option>
                  <option v-for="club in clubs" :key="club.id" :value="club.id">
                    {{ club.name }}
                  </option></select
                ><span v-else>{{ clubName(person) }}</span>
              </td>
              <td>
                <span class="tournament-count">{{ tournamentCount(person) }} {{ t('events') }}</span>
              </td>
              <td>{{ scoreLabel(person) }}</td>
              <td>
                <div class="table-actions">
                  <button
                    v-if="canEdit(person)"
                    class="button button-icon"
                    :aria-label="t('Edit {name}', { name: fullName(person) })"
                    @click="emit('edit', person)"
                  >
                    <NavIcon name="pencil" />
                  </button>
                  <button
                    class="text-link"
                    :aria-label="t('View scores for {name}', { name: fullName(person) })"
                    @click="emit('view-scores', person.id)"
                  >
                    {{ t('View scores →') }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredParticipants.length">
              <td colspan="8">
                <div class="table-empty">{{ t('No archers found.') }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
