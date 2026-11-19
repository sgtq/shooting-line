<script setup>
import { t } from '@shooting-line/i18n'
import { computed } from 'vue'
import { dayOfMonth } from '../services/dateFormat'
import { displayChoice, formatMonth, today, venueFor } from '../services/display'
import { runUnlessSelecting } from '../services/selection'
import { firstDay } from '../services/tournamentDates'
import { filterTournaments, sortByFirstDay } from '../services/tournamentList'
import NavIcon from './NavIcon.vue'

const props = defineProps({
  tournaments: { type: Array, required: true },
  tournamentTypes: { type: Array, required: true },
  clubs: { type: Array, required: true },
  canManage: { type: Boolean, default: false },
  canCreateTournament: { type: Boolean, default: false },
  showPlanNotice: { type: Boolean, default: false },
})
const emit = defineEmits(['create', 'open-tournament', 'open-types'])
// The filter and the search text live in the parent so they survive leaving and returning to this page.
const status = defineModel('status', { type: String, default: 'upcoming' })
const query = defineModel('query', { type: String, default: '' })

const filteredTournaments = computed(() =>
  filterTournaments(sortByFirstDay(props.tournaments), {
    query: query.value,
    status: status.value,
    today: today(),
  }),
)

/**
 * @param {{ tournamentTypeId: string, discipline: string }} event
 * @returns {string} The tournament type name, or the discipline when there is no type.
 */
function tagFor(event) {
  return (
    props.tournamentTypes.find((type) => type.id === event.tournamentTypeId)?.name || displayChoice(event.discipline)
  )
}

/**
 * @param {{ clubId: string }} event
 * @returns {string} The hosting club name, or a label for an independent event.
 */
function hostName(event) {
  return props.clubs.find((club) => club.id === event.clubId)?.name || t('Independent')
}
</script>

<template>
  <section>
    <div class="page-heading heading-row">
      <div>
        <p class="eyebrow">{{ t('EVENT MANAGEMENT') }}</p>
        <h1>{{ t('Tournaments') }}</h1>
        <p class="page-subtitle">{{ t('Create events, select archers, and manage event details.') }}</p>
      </div>
      <button v-if="canCreateTournament" class="button button-primary" @click="emit('create')">
        <span>＋</span> {{ t('Create tournament') }}
      </button>
    </div>
    <p v-if="showPlanNotice" class="privacy-note">
      {{ t('Your club needs an active plan to create tournaments or change anything. Contact a manager to get one.') }}
    </p>
    <div v-if="canManage" class="type-shortcut">
      <span>{{ t('Need a different event format?') }}</span><button class="text-link" @click="emit('open-types')">
        {{ t('Manage tournament types →') }}
      </button>
    </div>
    <div class="section-toolbar">
      <div class="toolbar-count">{{ filteredTournaments.length }} {{ t(status) }} {{ t('tournaments') }}</div>
      <div class="tournament-filters" role="group" :aria-label="t('Filter tournaments by date')">
        <button
          :class="{ active: status === 'upcoming' }"
          :aria-pressed="status === 'upcoming'"
          @click="status = 'upcoming'"
        >
          {{ t('Upcoming') }}
        </button>
        <button :class="{ active: status === 'past' }" :aria-pressed="status === 'past'" @click="status = 'past'">
          {{ t('Past') }}
        </button>
      </div>
      <div class="search-box"><span>⌕</span><input v-model="query" :placeholder="t('Search tournaments...')" /></div>
    </div>
    <div class="tournament-list">
      <article
        v-for="event in filteredTournaments"
        :key="event.id"
        class="tournament-card clickable-card"
        role="button"
        tabindex="0"
        :aria-label="event.name"
        @click="runUnlessSelecting(() => emit('open-tournament', event.id))"
        @keydown.enter.space.self.prevent="emit('open-tournament', event.id)"
      >
        <div class="tournament-date">
          <span>{{ formatMonth(firstDay(event)) }}</span><strong>{{ dayOfMonth(firstDay(event)) }}</strong
          ><small>{{ firstDay(event).slice(0, 4) }}</small>
        </div>
        <div class="tournament-details">
          <span class="event-tag">{{ tagFor(event) }}</span>
          <h3>{{ event.name }}</h3>
          <div class="tournament-meta">
            <span>⌖ {{ venueFor(event, clubs) }}</span
            ><span><NavIcon name="archers" /> {{ event.participantIds.length }} {{ t('archers') }}</span
            ><span><NavIcon name="categories" /> {{ event.categoryIds.length }} {{ t('categories') }}</span
            ><span><NavIcon name="clubs" /> {{ hostName(event) }}</span>
          </div>
        </div>
      </article>
      <div v-if="!filteredTournaments.length" class="empty-state panel">
        <div class="empty-icon"><NavIcon name="tournaments" /></div>
        <strong>{{ t('No tournaments found') }}</strong>
        <p>{{ t('Try a different search or create a tournament.') }}</p>
      </div>
    </div>
  </section>
</template>
