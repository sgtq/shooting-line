<script setup>
import { t } from '@shooting-line/i18n'
import { categoryDescription } from '../services/display'
import NavIcon from './NavIcon.vue'

const props = defineProps({
  categories: { type: Array, required: true },
  tournaments: { type: Array, required: true },
  canManage: { type: Boolean, default: false },
})
const emit = defineEmits(['create', 'edit'])

/**
 * @param {{ id: string }} category
 * @returns {number} How many tournaments offer this category.
 */
function usageCount(category) {
  return props.tournaments.filter((event) => event.categoryIds.includes(category.id)).length
}
</script>

<template>
  <section>
    <div class="page-heading heading-row">
      <div>
        <p class="eyebrow">{{ t('CATEGORY DIRECTORY') }}</p>
        <h1>{{ t('Categories') }}</h1>
        <p class="page-subtitle">
          {{ t('Create age and/or bow-type divisions, then add them to each tournament.') }}
        </p>
      </div>
      <button v-if="canManage" class="button button-primary" @click="emit('create')">
        <span>＋</span> {{ t('Create category') }}
      </button>
    </div>
    <div class="category-grid">
      <article v-for="category in categories" :key="category.id" class="category-card">
        <div class="format-card-head">
          <span class="quick-icon lavender"><NavIcon name="categories" /></span
          ><button
            v-if="canManage"
            class="button button-icon"
            :aria-label="t('Edit category')"
            :title="t('Edit category')"
            @click="emit('edit', category)"
          >
            <NavIcon name="pencil" />
          </button>
        </div>
        <h2>{{ category.name }}</h2>
        <p>{{ categoryDescription(category) }}</p>
        <div class="format-usage">{{ usageCount(category) }} {{ t('tournaments use this category') }}</div>
      </article>
      <button v-if="canManage" class="add-card format-add-card" @click="emit('create')">
        <span>＋</span><strong>{{ t('Create a category') }}</strong
        ><small>{{ t('Set an age range, bow type, or both') }}</small>
      </button>
    </div>
  </section>
</template>
