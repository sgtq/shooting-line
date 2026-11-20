<script setup>
import { language, t } from '@shooting-line/i18n'
import LanguageSwitcher from '@shooting-line/i18n/LanguageSwitcher.vue'
import { computed, ref } from 'vue'
import { useTheme } from '../composables/useTheme'
import { dayOfMonth, formatMonth } from '../services/dateFormat'
import { averageByCategory, buildScoreRows, formatDays, groupCategoriesByBow, safeMapUrl } from '../services/archerView'
import { todayString } from '../services/planRules'
import AppSidebar from './AppSidebar.vue'
import NavIcon from './NavIcon.vue'

const props = defineProps({
  // The archer's own rows, as the database lets them read.
  data: { type: Object, required: true },
  // Tournaments for the calendar, from the upcoming_tournaments database function.
  upcoming: { type: Array, required: true },
  participantId: { type: String, default: '' },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  today: { type: String, default: () => todayString() },
})

const isDevelopmentPreview = import.meta.env.VITE_APP_ENV === 'development'
const { theme, toggleTheme } = useTheme()

const navItems = computed(() => [
  { id: 'upcoming', label: t('Upcoming tournaments'), icon: 'tournaments' },
  { id: 'scores', label: t('Scores'), icon: 'scores' },
])
const activePage = ref('upcoming')
const fromDate = ref('')
const toDate = ref('')

const pageTitle = computed(() => navItems.value.find((item) => item.id === activePage.value).label)
const scoreRows = computed(() =>
  buildScoreRows({
    data: props.data,
    participantId: props.participantId,
    today: props.today,
    from: fromDate.value,
    to: toDate.value,
  }),
)
const averages = computed(() => averageByCategory(scoreRows.value))

const expandedIds = ref(new Set())

/** @returns {void} */
function toggleDetails(id) {
  const next = new Set(expandedIds.value)
  if (!next.delete(id)) next.add(id)
  expandedIds.value = next
}

/** @returns {string} The distance, target, and ends of a tournament type on one line. */
function describeType(details) {
  if (!details) return ''
  return t('{distance} {unit}, {target}, {ends} ends of {arrows} arrows', {
    distance: details.distance,
    unit: details.distanceUnit,
    target: details.target,
    ends: details.ends,
    arrows: details.arrowsPerEnd,
  })
}

/** @returns {void} */
function clearRange() {
  fromDate.value = ''
  toDate.value = ''
}
</script>

<template>
  <div class="app-shell">
    <AppSidebar
      :active-page="activePage"
      :nav-items="navItems"
      :tournament-count="0"
      :user-email="userEmail"
      :user-name="userName"
      :role-summary="t('Archer')"
      :can-edit-profile="false"
      @navigate="activePage = $event"
    />

    <main class="main-content">
      <header class="topbar">
        <div class="breadcrumbs">
          <span>{{ t('Main menu') }}</span><span class="crumb-slash">/</span><strong>{{ pageTitle }}</strong>
        </div>
        <div class="topbar-actions">
          <span v-if="isDevelopmentPreview" class="environment-badge">{{ t('DEVELOPMENT / QA') }}</span>
          <a class="portal-link" href="../">{{ t('App launcher') }}</a>
          <LanguageSwitcher />
          <button
            class="theme-toggle"
            type="button"
            :aria-pressed="theme === 'dark'"
            :aria-label="theme === 'dark' ? t('Switch to light theme') : t('Switch to dark theme')"
            @click="toggleTheme"
          >
            <span aria-hidden="true">{{ theme === 'dark' ? '☀' : '☾' }}</span>
            <span class="theme-toggle-label">{{ theme === 'dark' ? t('Light theme') : t('Dark theme') }}</span>
          </button>
        </div>
      </header>

      <div class="page-container">
        <section v-if="activePage === 'upcoming'" data-testid="upcoming-list">
          <div class="page-heading">
            <p class="eyebrow">{{ t('MY ARCHERY') }}</p>
            <h1>{{ t('Upcoming tournaments') }}</h1>
            <p class="page-subtitle">{{ t('Tournaments that have not started, and the ones you are entered in.') }}</p>
          </div>
          <section class="panel events-panel">
            <div v-if="upcoming.length" class="event-list">
              <article v-for="tournament in upcoming" :key="tournament.id" class="archer-event">
                <button
                  type="button"
                  class="event-row clickable-card archer-tournament-toggle"
                  :aria-expanded="expandedIds.has(tournament.id)"
                  :aria-controls="`details-${tournament.id}`"
                  @click="toggleDetails(tournament.id)"
                >
                  <div class="date-tile">
                    <span>{{ formatMonth(tournament.days[0], language) }}</span><strong>{{
                      dayOfMonth(tournament.days[0])
                    }}</strong>
                  </div>
                  <div class="event-info">
                    <strong>{{ tournament.name }}</strong>
                    <span>{{
                      [tournament.tournamentType, formatDays(tournament.days)].filter(Boolean).join(' · ')
                    }}</span>
                  </div>
                  <span v-if="tournament.isEntered" class="event-attendees">{{ t('You are entered') }}</span>
                  <span class="row-arrow" aria-hidden="true">{{ expandedIds.has(tournament.id) ? '▾' : '▸' }}</span>
                </button>
                <dl v-if="expandedIds.has(tournament.id)" :id="`details-${tournament.id}`" class="archer-details">
                  <div>
                    <dt>{{ t('Hosted by') }}</dt>
                    <dd>{{ tournament.hostClub || '—' }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('Location') }}</dt>
                    <dd>
                      {{ tournament.address || '—' }}
                      <a
                        v-if="safeMapUrl(tournament.mapUrl)"
                        :href="safeMapUrl(tournament.mapUrl)"
                        target="_blank"
                        rel="noopener noreferrer"
                        >{{ t('Open map') }}</a
                      >
                    </dd>
                  </div>
                  <div v-if="tournament.typeDetails">
                    <dt>{{ t('Format') }}</dt>
                    <dd>{{ describeType(tournament.typeDetails) }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('Categories') }}</dt>
                    <dd>
                      <span v-if="!tournament.categories.length">—</span>
                      <div v-for="group in groupCategoriesByBow(tournament.categories)" :key="group.bowType">
                        <strong v-if="group.bowType">{{ group.bowType }}:</strong> {{ group.names.join(', ') }}
                      </div>
                    </dd>
                  </div>
                </dl>
              </article>
            </div>
            <div v-else class="empty-state">
              <div class="empty-icon"><NavIcon name="tournaments" /></div>
              <strong>{{ t('No upcoming tournaments.') }}</strong>
            </div>
          </section>
        </section>

        <section v-else data-testid="scores">
          <div class="page-heading">
            <p class="eyebrow">{{ t('MY ARCHERY') }}</p>
            <h1>{{ t('Scores') }}</h1>
            <p class="page-subtitle">{{ t('Your own scores in the tournaments you are entered in.') }}</p>
          </div>

          <div class="panel archer-filter">
            <label class="form-field">
              <span>{{ t('From') }}</span>
              <input v-model="fromDate" type="date" :max="toDate || undefined" />
            </label>
            <label class="form-field">
              <span>{{ t('Until') }}</span>
              <input v-model="toDate" type="date" :min="fromDate || undefined" />
            </label>
            <button v-if="fromDate || toDate" type="button" class="text-link" @click="clearRange">
              {{ t('Clear dates') }}
            </button>
            <div v-if="averages.length" class="archer-averages" data-testid="averages">
              <h2>{{ t('Average round score by category') }}</h2>
              <ul>
                <li v-for="group in averages" :key="`${group.category}-${group.ends}`">
                  {{ group.category || t('No category')
                  }}<template v-if="group.showEnds"> , {{ t('{ends} ends', { ends: group.ends }) }}</template
                  >:
                  <strong>{{ group.average }}</strong>
                  ({{ t('{count} rounds', { count: group.rounds }) }})
                </li>
              </ul>
            </div>
          </div>

          <div class="panel table-panel">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{{ t('TOURNAMENT') }}</th>
                    <th>{{ t('DATES') }}</th>
                    <th>{{ t('CATEGORY') }}</th>
                    <th>{{ t('SCORE PER ROUND') }}</th>
                    <th>{{ t('KNOCKOUT MATCHES') }}</th>
                    <th>{{ t('TOTAL') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in scoreRows" :key="row.id">
                    <td>
                      <strong>{{ row.name }}</strong>
                    </td>
                    <td>{{ formatDays(row.dates) }}</td>
                    <td>{{ row.category || '—' }}</td>
                    <td>
                      <div v-for="round in row.rounds" :key="round.name">{{ round.name }}: {{ round.score }}</div>
                      <span v-if="!row.rounds.length">—</span>
                    </td>
                    <td>
                      <div v-for="match in row.matches" :key="match.round">
                        {{ match.round }}: {{ match.score === '' ? '—' : match.score }}
                      </div>
                      <span v-if="!row.matches.length">—</span>
                    </td>
                    <td>
                      <strong>{{ row.total }}</strong>
                    </td>
                  </tr>
                  <tr v-if="!scoreRows.length">
                    <td colspan="6">
                      <div class="table-empty">{{ t('No scores yet.') }}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.archer-tournament-toggle {
  width: 100%;
  padding: 0;
  border: 0;
  border-bottom: 1px solid #f1f2f0;
  color: inherit;
  background: none;
  font: inherit;
  text-align: left;
}

.archer-details {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 12px 0 14px 44px;
  border-bottom: 1px solid #f1f2f0;
}

.archer-details dt {
  color: var(--muted, #647184);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.archer-details dd {
  margin: 2px 0 0;
}

.archer-details a {
  margin-left: 8px;
}

.archer-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 18px;
  padding: 16px 20px;
}

.archer-averages {
  flex-basis: 100%;
}

.archer-averages h2 {
  margin: 0 0 6px;
  font-size: 16px;
}

.archer-averages ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
