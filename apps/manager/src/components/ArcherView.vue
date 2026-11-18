<script setup>
import { t } from '@shooting-line/i18n'
import LanguageSwitcher from '@shooting-line/i18n/LanguageSwitcher.vue'
import { computed, ref } from 'vue'
import { averageByEnds, buildScoreRows, formatDays } from '../services/archerView'
import { todayString } from '../services/planRules'

const props = defineProps({
  // The archer's own rows, as the database lets them read.
  data: { type: Object, required: true },
  // Tournaments for the calendar, from the upcoming_tournaments database function.
  upcoming: { type: Array, required: true },
  participantId: { type: String, default: '' },
  userName: { type: String, default: '' },
  today: { type: String, default: () => todayString() },
})

const activeTab = ref('tournaments')
const fromDate = ref('')
const toDate = ref('')

const scoreRows = computed(() =>
  buildScoreRows({
    data: props.data,
    participantId: props.participantId,
    today: props.today,
    from: fromDate.value,
    to: toDate.value,
  }),
)
const averages = computed(() => averageByEnds(scoreRows.value))

/** @returns {void} */
function clearRange() {
  fromDate.value = ''
  toDate.value = ''
}
</script>

<template>
  <main class="archer-view">
    <header class="archer-view-header">
      <div>
        <p class="archer-view-eyebrow">{{ t('ShootingLine access') }}</p>
        <h1>{{ userName ? t('Hello, {name}', { name: userName }) : t('Your archer view') }}</h1>
      </div>
      <div class="archer-view-actions">
        <LanguageSwitcher />
        <a href="../">{{ t('Return to main menu') }}</a>
      </div>
    </header>

    <div class="archer-view-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'tournaments'"
        :class="{ active: activeTab === 'tournaments' }"
        @click="activeTab = 'tournaments'"
      >
        {{ t('Upcoming tournaments') }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'scores'"
        :class="{ active: activeTab === 'scores' }"
        @click="activeTab = 'scores'"
      >
        {{ t('Scores') }}
      </button>
    </div>

    <section v-if="activeTab === 'tournaments'" class="panel table-panel" data-testid="upcoming-list">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('TOURNAMENT') }}</th>
              <th>{{ t('DATES') }}</th>
              <th>{{ t('TYPE') }}</th>
              <th>{{ t('HOSTED BY') }}</th>
              <th>{{ t('LOCATION') }}</th>
              <th>{{ t('CATEGORIES') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tournament in upcoming" :key="tournament.id">
              <td>
                <strong>{{ tournament.name }}</strong>
                <small v-if="tournament.isEntered"> · {{ t('You are entered') }}</small>
              </td>
              <td>{{ formatDays(tournament.days) }}</td>
              <td>{{ tournament.tournamentType || '—' }}</td>
              <td>{{ tournament.hostClub || '—' }}</td>
              <td>{{ tournament.address || '—' }}</td>
              <td>{{ tournament.categories.join(', ') || '—' }}</td>
            </tr>
            <tr v-if="!upcoming.length">
              <td colspan="6">
                <div class="table-empty">{{ t('No upcoming tournaments.') }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else class="panel table-panel" data-testid="scores">
      <div class="archer-view-filter">
        <label>
          {{ t('From') }}
          <input v-model="fromDate" type="date" :max="toDate || undefined" />
        </label>
        <label>
          {{ t('Until') }}
          <input v-model="toDate" type="date" :min="fromDate || undefined" />
        </label>
        <button v-if="fromDate || toDate" type="button" class="text-link" @click="clearRange">
          {{ t('Clear dates') }}
        </button>
      </div>

      <ul v-if="averages.length" class="archer-view-averages" data-testid="averages">
        <li v-for="group in averages" :key="group.ends">
          {{ t('Average round score, {ends} ends', { ends: group.ends }) }}:
          <strong>{{ group.average }}</strong>
          ({{ t('{count} rounds', { count: group.rounds }) }})
        </li>
      </ul>

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
    </section>
  </main>
</template>

<style scoped>
.archer-view {
  min-height: 100vh;
  padding: 24px;
  background: #f3f6fa;
  color: #172033;
  font-family: system-ui, sans-serif;
}

.archer-view-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.archer-view-eyebrow {
  color: #9a7223;
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.archer-view-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.archer-view-actions a {
  color: #1e293b;
  font-weight: 700;
}

.archer-view-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.archer-view-tabs button {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid #d7dee7;
  border-radius: 8px;
  color: #344054;
  background: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.archer-view-tabs button.active {
  border-color: #1e293b;
  color: #fff;
  background: #1e293b;
}

.archer-view-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  padding: 16px;
}

.archer-view-filter label {
  display: grid;
  gap: 4px;
  font-size: 13px;
  font-weight: 650;
}

.archer-view-averages {
  margin: 0;
  padding: 0 16px 12px 32px;
}
</style>
