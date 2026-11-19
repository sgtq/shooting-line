<script setup>
import { t } from '@shooting-line/i18n'
import { categoryDescription } from '../services/display'

defineProps({
  tournament: { type: Object, required: true },
  categories: { type: Array, required: true },
  canManage: { type: Boolean, default: false },
  canEditTournament: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle', 'open-catalogue'])
</script>

<template>
  <section class="panel roster-panel">
    <div class="panel-heading">
      <div>
        <h2>{{ t('Tournament categories') }}</h2>
        <p>
          {{
            canEditTournament
              ? t('Choose the divisions available for this event. Assign each archer in Archers.')
              : t('Divisions available for this event.')
          }}
        </p>
      </div>
      <button v-if="canManage" class="text-link" @click="emit('open-catalogue')">
        {{ t('Manage category catalogue →') }}
      </button>
    </div>
    <div v-if="categories.length" class="roster-list">
      <label v-for="category in categories" :key="category.id" class="roster-row category-roster-row"
        ><input
          type="checkbox"
          :checked="tournament.categoryIds.includes(category.id)"
          :disabled="!canEditTournament"
          @change="emit('toggle', tournament, category.id)"
        /><span class="category-roster-copy"
          ><strong>{{ category.name }}</strong
          ><small>{{ categoryDescription(category) }}</small></span
        ><span class="roster-state">{{
          tournament.categoryIds.includes(category.id) ? t('Available') : t('Not added')
        }}</span></label
      >
    </div>
    <div v-else class="empty-state">
      <strong>{{ t('No categories in the catalogue') }}</strong>
      <p>
        {{
          canManage
            ? t('Create categories by age, bow type, or both.')
            : t('Categories will appear here when available.')
        }}
      </p>
      <button v-if="canManage" class="button button-primary" @click="emit('open-catalogue')">
        {{ t('Open category catalogue') }}
      </button>
    </div>
  </section>
</template>
