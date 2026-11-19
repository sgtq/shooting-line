<script setup>
import { t } from '@shooting-line/i18n'
import NavIcon from './NavIcon.vue'

const props = defineProps({
  tournamentTypes: { type: Array, required: true },
  tournaments: { type: Array, required: true },
  canManage: { type: Boolean, default: false },
})
const emit = defineEmits(['create', 'edit'])

/**
 * @param {{ id: string }} type
 * @returns {number} How many tournaments use this type.
 */
function usageCount(type) {
  return props.tournaments.filter((event) => event.tournamentTypeId === type.id).length
}
</script>

<template>
  <section>
    <div class="page-heading heading-row">
      <div>
        <p class="eyebrow">{{ t('EVENT FORMATS') }}</p>
        <h1>{{ t('Tournament types') }}</h1>
        <p class="page-subtitle">
          {{ t('Create reusable formats with a distance, target, ends, and arrows per end.') }}
        </p>
      </div>
      <button v-if="canManage" class="button button-primary" @click="emit('create')">
        <span>＋</span> {{ t('Create tournament type') }}
      </button>
    </div>
    <div class="format-grid">
      <article v-for="type in tournamentTypes" :key="type.id" class="format-card">
        <div class="format-card-head">
          <span class="quick-icon mint"><NavIcon name="tournament-types" /></span
          ><button
            v-if="canManage"
            class="button button-icon"
            :aria-label="t('Edit type')"
            :title="t('Edit type')"
            @click="emit('edit', type)"
          >
            <NavIcon name="pencil" />
          </button>
        </div>
        <h2>{{ type.name }}</h2>
        <div class="format-distance">
          <strong>{{ type.distance }}</strong><span>{{ type.distanceUnit }}</span
          ><small>{{ t('distance') }}</small>
        </div>
        <div class="format-details">
          <div>
            <span>{{ t('TARGET') }}</span><strong>{{ type.targetType }}</strong>
          </div>
          <div>
            <span>{{ t('ENDS') }}</span><strong>{{ type.ends }}</strong>
          </div>
          <div>
            <span>{{ t('ARROWS / END') }}</span><strong>{{ type.arrowsPerEnd }}</strong>
          </div>
        </div>
        <div class="format-total">
          {{ t('Total arrows per archer') }} <strong>{{ Number(type.ends) * Number(type.arrowsPerEnd) }}</strong>
        </div>
        <div class="format-usage">{{ usageCount(type) }} {{ t('tournaments use this type') }}</div>
      </article>
      <button v-if="canManage" class="add-card format-add-card" @click="emit('create')">
        <span>＋</span><strong>{{ t('Create a tournament type') }}</strong
        ><small>{{ t('Set a reusable shooting format') }}</small>
      </button>
    </div>
  </section>
</template>
