<script setup>
import { t } from '@shooting-line/i18n'
import { formatDates } from '../services/display'

defineProps({
  participant: { type: Object, default: undefined },
  rows: { type: Array, required: true },
})
const emit = defineEmits(['back'])
</script>

<template>
  <section>
    <div class="page-heading heading-row">
      <div>
        <button class="text-link back-link" @click="emit('back')">{{ t('← All archers') }}</button>
        <p class="eyebrow">{{ t('ARCHER RECORD') }}</p>
        <h1>
          {{ participant ? `${participant.lastName}, ${participant.firstName}` : t('Archer details') }}
        </h1>
        <p class="page-subtitle">{{ t('Tournament round and Olympic match scores for this archer.') }}</p>
      </div>
    </div>
    <section class="panel table-panel">
      <div v-if="participant && rows.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('TOURNAMENT') }}</th>
              <th>{{ t('DATE') }}</th>
              <th>{{ t('CATEGORY') }}</th>
              <th>{{ t('ENTRY') }}</th>
              <th>{{ t('ROUND / MATCH') }}</th>
              <th>{{ t('SCORE') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="`${row.tournamentId}-${row.round}-${index}`">
              <td>{{ row.tournament?.name || t('Tournament removed') }}</td>
              <td>{{ row.tournament ? formatDates(row.tournament) : '—' }}</td>
              <td>{{ row.category?.name || t('Unassigned') }}</td>
              <td>{{ row.scoreType }}</td>
              <td>{{ row.round }}</td>
              <td>
                <strong>{{ row.score }}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">▤</div>
        <strong>{{ t('No scores recorded yet') }}</strong>
        <p>{{ t('Scores for this archer will appear here after you record them in a tournament.') }}</p>
        <button class="button button-outline" @click="emit('back')">{{ t('Back to archers') }}</button>
      </div>
    </section>
  </section>
</template>
