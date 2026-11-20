<script setup>
import { t } from '@shooting-line/i18n'
import { computed } from 'vue'
import { dayOfMonth } from '../services/dateFormat'
import { displayChoice, formatDates, formatMonth, greetingFor, today } from '../services/display'
import { runUnlessSelecting } from '../services/selection'
import { firstDay } from '../services/tournamentDates'
import { findNextTournament, sortByFirstDay } from '../services/tournamentList'
import NavIcon from './NavIcon.vue'

const props = defineProps({
  userName: { type: String, default: '' },
  tournaments: { type: Array, required: true },
  clubs: { type: Array, required: true },
  archerCount: { type: Number, default: 0 },
  selectedTournamentId: { type: String, default: '' },
  canManage: { type: Boolean, default: false },
  canManageParticipants: { type: Boolean, default: false },
  canCreateTournament: { type: Boolean, default: false },
  showPlanNotice: { type: Boolean, default: false },
})
const emit = defineEmits(['navigate', 'create', 'open-tournament', 'open-club', 'toggle-club'])

const greeting = computed(() => greetingFor(props.userName, new Date().getHours()))
const upcomingTournaments = computed(() => sortByFirstDay(props.tournaments))
const nextTournament = computed(() => findNextTournament(upcomingTournaments.value, today()))

/**
 * @param {string} id
 * @returns {string} The name of the club with that id, or a label for an independent event.
 */
function hostName(id) {
  return props.clubs.find((club) => club.id === id)?.name || t('Independent event')
}

/** @returns {void} Opens the selected tournament on its scores tab, or the list when none is selected. */
function enterScores() {
  if (props.selectedTournamentId) emit('open-tournament', props.selectedTournamentId, 'scores')
  else emit('navigate', 'tournaments')
}
</script>

<template>
  <section>
    <div class="page-heading heading-row">
      <div>
        <p class="eyebrow">{{ t('OVERVIEW') }}</p>
        <h1>{{ greeting }} <span class="wave">✳</span></h1>
        <p class="page-subtitle">{{ t('Here’s what’s happening across your archery community.') }}</p>
      </div>
      <button v-if="canCreateTournament" class="button button-primary" @click="emit('create', 'tournament')">
        <span>＋</span> {{ t('Create tournament') }}
      </button>
    </div>

    <p v-if="showPlanNotice" class="privacy-note">
      {{ t('Your club needs an active plan to create tournaments or change anything. Contact a manager to get one.') }}
    </p>

    <div class="stats-grid">
      <article class="stat-card clickable-card" @click="runUnlessSelecting(() => emit('navigate', 'tournaments'))">
        <div class="stat-top">
          <span class="stat-icon olive"><NavIcon name="tournaments" /></span
          ><span class="stat-caption">{{ t('ALL TIME') }}</span>
        </div>
        <button
          class="stat-value stat-value-button"
          :aria-label="t('Open tournaments')"
          @click="emit('navigate', 'tournaments')"
        >
          {{ tournaments.length }}
        </button>
        <span class="stat-label">{{ t('Total tournaments') }}</span>
        <div class="stat-foot"><span class="stat-dot green"></span> {{ t('Open event calendar') }}</div>
      </article>
      <article class="stat-card clickable-card" @click="runUnlessSelecting(() => emit('navigate', 'clubs'))">
        <div class="stat-top">
          <span class="stat-icon sand"><NavIcon name="clubs" /></span
          ><span class="stat-caption">{{ t('REGISTERED') }}</span>
        </div>
        <button class="stat-value stat-value-button" :aria-label="t('Open clubs')" @click="emit('navigate', 'clubs')">
          {{ clubs.length }}
        </button>
        <span class="stat-label">{{ t('Clubs') }}</span>
        <div class="stat-foot"><span class="stat-dot green"></span> {{ t('Open club directory') }}</div>
      </article>
      <article class="stat-card clickable-card" @click="runUnlessSelecting(() => emit('navigate', 'participants'))">
        <div class="stat-top">
          <span class="stat-icon blue"><NavIcon name="archers" /></span
          ><span class="stat-caption">{{ t('DATABASE') }}</span>
        </div>
        <button
          class="stat-value stat-value-button"
          :aria-label="t('Open archers')"
          @click="emit('navigate', 'participants')"
        >
          {{ archerCount }}
        </button>
        <span class="stat-label">{{ t('Archers') }}</span>
        <div class="stat-foot">{{ t('Open archer directory') }}</div>
      </article>
      <article
        class="stat-card next-stat"
        :class="{ 'clickable-card': nextTournament }"
        @click="nextTournament && runUnlessSelecting(() => emit('open-tournament', nextTournament.id))"
      >
        <div class="stat-top">
          <span class="stat-icon peach">◷</span><span class="stat-caption">{{ t('UP NEXT') }}</span>
        </div>
        <strong class="next-event">{{ nextTournament?.name || t('No upcoming events') }}</strong>
        <span class="stat-label">{{ nextTournament ? formatDates(nextTournament) : t('No event scheduled') }}</span>
        <button v-if="nextTournament" class="text-link" @click="emit('open-tournament', nextTournament.id)">
          {{ t('View tournament') }} <span>→</span>
        </button>
      </article>
    </div>

    <div class="content-grid">
      <section class="panel events-panel">
        <div class="panel-heading">
          <div>
            <h2>{{ t('Upcoming tournaments') }}</h2>
            <p>{{ t('Your next events at a glance') }}</p>
          </div>
          <button class="text-link" @click="emit('navigate', 'tournaments')">{{ t('View all') }} <span>→</span></button>
        </div>
        <div v-if="upcomingTournaments.length" class="event-list">
          <article
            v-for="event in upcomingTournaments.slice(0, 4)"
            :key="event.id"
            class="event-row clickable-card"
            role="button"
            tabindex="0"
            :aria-label="event.name"
            @click="runUnlessSelecting(() => emit('open-tournament', event.id))"
            @keydown.enter.space.self.prevent="emit('open-tournament', event.id)"
          >
            <div class="date-tile">
              <span>{{ formatMonth(firstDay(event)) }}</span><strong>{{ dayOfMonth(firstDay(event)) }}</strong>
            </div>
            <div class="event-info">
              <strong>{{ event.name }}</strong><span
                >{{ hostName(event.clubId) }} · {{ displayChoice(event.discipline) }}</span
              >
            </div>
            <span class="event-attendees"
              >{{ event.participantIds.length }} <small>{{ t('archers') }}</small></span
            >
            <span class="row-arrow" aria-hidden="true">↗</span>
          </article>
        </div>
        <div v-else class="empty-state">
          <div class="empty-icon"><NavIcon name="tournaments" /></div>
          <strong>{{ t('No tournaments yet') }}</strong>
          <p>{{ canManage ? t('Create an event to get started.') : t('Upcoming events will appear here.') }}</p>
          <button v-if="canCreateTournament" class="button button-outline" @click="emit('create', 'tournament')">
            {{ t('Create tournament') }}
          </button>
        </div>
      </section>
      <section class="panel quick-panel">
        <div class="panel-heading">
          <div>
            <h2>{{ t('Quick actions') }}</h2>
            <p>{{ t('Keep things moving') }}</p>
          </div>
        </div>
        <button v-if="canManageParticipants" class="quick-action" @click="emit('create', 'participant')">
          <span class="quick-icon lavender"><NavIcon name="archers" /></span
          ><span
            ><strong>{{ t('Add archer') }}</strong
            ><small>{{ t('Grow your archer directory') }}</small></span
          ><b>→</b>
        </button>
        <button v-if="canManage" class="quick-action" @click="emit('create', 'club')">
          <span class="quick-icon peach"><NavIcon name="clubs" /></span
          ><span
            ><strong>{{ t('Add a club') }}</strong
            ><small>{{ t('Register a new archery club') }}</small></span
          ><b>→</b>
        </button>
        <button v-if="canManage" class="quick-action" @click="enterScores">
          <span class="quick-icon mint">▤</span
          ><span
            ><strong>{{ t('Enter scores') }}</strong
            ><small>{{ t('Record a tournament round') }}</small></span
          ><b>→</b>
        </button>
        <div class="tip-box">
          <span>✦</span>
          <p>
            <strong>{{ t('Good to know') }}</strong><br />{{ t('Archers can be reused across multiple tournaments.') }}
          </p>
        </div>
      </section>
    </div>
    <section class="panel clubs-preview">
      <div class="panel-heading">
        <div>
          <h2>{{ t('Your clubs') }}</h2>
          <p>{{ t('Club accounts and representatives') }}</p>
        </div>
        <button class="text-link" @click="emit('navigate', 'clubs')">{{ t('Manage clubs') }} <span>→</span></button>
      </div>
      <div class="club-preview-list">
        <div
          v-for="club in clubs.slice(0, 3)"
          :key="club.id"
          class="club-preview-item clickable-card"
          @click="runUnlessSelecting(() => emit('open-club', club))"
        >
          <span class="club-avatar">{{ club.name.charAt(0) }}</span><span class="club-preview-name"
            ><strong>{{ club.name }}</strong
            ><small>{{ club.representative }}</small></span
          >
          <button
            type="button"
            class="status-pill status-pill-button details-control"
            :title="t('Open club details')"
            @click.stop="runUnlessSelecting(() => emit('open-club', club))"
          >
            {{ t('Details') }}
          </button>
          <button
            v-if="canManage"
            type="button"
            class="status-pill status-pill-button"
            :class="club.userEnabled ? 'status-active' : 'status-disabled'"
            :title="club.userEnabled ? t('Disable') : t('Enable')"
            @click.stop="emit('toggle-club', club)"
          >
            <i></i>{{ club.userEnabled ? t('Enabled') : t('Disabled') }}
          </button>
          <span v-else class="status-pill" :class="club.userEnabled ? 'status-active' : 'status-disabled'"
            ><i></i>{{ club.userEnabled ? t('Enabled') : t('Disabled') }}</span
          >
        </div>
      </div>
    </section>
  </section>
</template>
