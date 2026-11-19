<script setup>
import { t } from '@shooting-line/i18n'
import { computed } from 'vue'
import { displayChoice, formatDates, venueFor } from '../services/display'

const props = defineProps({
  tournament: { type: Object, default: undefined },
  clubs: { type: Array, required: true },
  tournamentTypes: { type: Array, required: true },
  canManage: { type: Boolean, default: false },
  canEditTournament: { type: Boolean, default: false },
  canStartTournament: { type: Boolean, default: false },
})
const emit = defineEmits(['back', 'edit-dates', 'toggle-started'])
const tab = defineModel('tab', { type: String, default: 'participants' })

const TABS = [
  { id: 'participants', label: 'Archers' },
  { id: 'categories', label: 'Categories' },
  { id: 'scores', label: 'Rounds & scores' },
  { id: 'olympic', label: 'Olympic matches' },
]

const hostClub = computed(() => props.clubs.find((club) => club.id === props.tournament?.clubId))
const tournamentType = computed(() =>
  props.tournamentTypes.find((type) => type.id === props.tournament?.tournamentTypeId),
)
const mapUrl = computed(() => (props.tournament?.venueMode === 'club' ? hostClub.value?.mapUrl : ''))
</script>

<template>
  <section>
    <template v-if="tournament">
      <div class="page-heading heading-row">
        <div>
          <button class="text-link back-link" @click="emit('back')">{{ t('← All tournaments') }}</button>
          <p class="eyebrow">{{ t('TOURNAMENT DETAILS') }}</p>
          <h1>{{ tournament.name }}</h1>
          <p class="page-subtitle">{{ formatDates(tournament) }} · {{ displayChoice(tournament.discipline) }}</p>
          <p v-if="tournament.startedAt" class="page-subtitle">
            {{
              canManage
                ? t('This tournament is started.')
                : t('This tournament is started and locked. Ask a manager to reopen it.')
            }}
          </p>
        </div>
        <div class="heading-actions">
          <button v-if="canEditTournament" class="button button-outline" @click="emit('edit-dates', tournament)">
            {{ t('Edit dates') }}
          </button>
          <button v-if="canStartTournament" class="button button-outline" @click="emit('toggle-started', tournament)">
            {{ t('Start tournament') }}
          </button>
          <button
            v-else-if="canManage && tournament.startedAt"
            class="button button-outline"
            @click="emit('toggle-started', tournament)"
          >
            {{ t('Reopen tournament') }}
          </button>
        </div>
      </div>
      <section class="tournament-summary">
        <div>
          <span>{{ t('HOST CLUB') }}</span><strong>{{ hostClub?.name || t('Independent event') }}</strong>
        </div>
        <div>
          <span>{{ t('LOCATION') }}</span><strong>{{ venueFor(tournament, clubs) }}</strong>
        </div>
        <div>
          <span>{{ t('ARCHERS') }}</span><strong>{{ tournament.participantIds.length }}</strong>
        </div>
        <div>
          <span>{{ t('CATEGORIES') }}</span><strong>{{ tournament.categoryIds.length }}</strong>
        </div>
        <div v-if="tournamentType" class="format-summary">
          <span>{{ t('FORMAT') }}</span><strong
            >{{ tournamentType.distance }} {{ tournamentType.distanceUnit }} · {{ tournamentType.targetType }} ·
            {{ tournamentType.ends }} × {{ tournamentType.arrowsPerEnd }}</strong
          >
        </div>
        <a v-if="mapUrl" :href="mapUrl" target="_blank" rel="noreferrer" class="button button-small button-outline">{{
          t('Open map ↗')
        }}</a>
      </section>
      <div class="tournament-tabs" role="tablist" :aria-label="t('Tournament sections')">
        <button v-for="item in TABS" :key="item.id" :class="{ active: tab === item.id }" @click="tab = item.id">
          {{ t(item.label) }}
        </button>
      </div>
      <slot />
    </template>
    <div v-else class="panel empty-state">
      <slot name="empty" />
    </div>
  </section>
</template>
