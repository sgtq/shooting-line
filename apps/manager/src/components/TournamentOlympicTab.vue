<script setup>
import { t } from '@shooting-line/i18n'
import { fullName } from '../services/display'

const props = defineProps({
  tournament: { type: Object, required: true },
  categories: { type: Array, required: true },
  participants: { type: Array, required: true },
  matches: { type: Array, required: true },
  round: { type: String, default: '' },
  canManage: { type: Boolean, default: false },
})
const emit = defineEmits(['generate', 'record-score', 'view-scores'])
const categoryId = defineModel('categoryId', { type: String, default: '' })

/**
 * @param {string} id
 * @returns {string} The archer's name, or a label when the archer is not in the list.
 */
function archerName(id) {
  const person = props.participants.find((item) => item.id === id) || { firstName: t('Unknown'), lastName: '' }
  return fullName(person)
}

/**
 * @param {string} id
 * @returns {string} The category name for the picker.
 */
function categoryName(id) {
  return props.categories.find((category) => category.id === id)?.name
}
</script>

<template>
  <section>
    <div class="olympic-toolbar">
      <label class="select-field"
        ><span>{{ t('CATEGORY') }}</span
        ><select v-model="categoryId" :disabled="!canManage">
          <option value="">{{ t('All archers') }}</option>
          <option v-for="id in tournament.categoryIds" :key="id" :value="id">{{ categoryName(id) }}</option>
        </select></label
      >
      <div>
        <span class="contact-label">{{ t('SEEDING SCORES FROM') }}</span><strong class="round-label">{{
          round
        }}</strong>
      </div>
      <span class="seed-note"><span>↕</span> {{ t('1st place vs. last place · 2nd vs. second-last') }}</span>
      <button v-if="canManage" class="button button-primary" @click="emit('generate')">
        <span>✦</span> {{ t('Seed from round scores') }}
      </button>
    </div>
    <div v-if="matches.length" class="matches-grid">
      <section v-for="(match, index) in matches" :key="match.id" class="match-card">
        <div class="match-head">
          <span>{{ match.round }}</span><span class="match-number"
            >{{ t('MATCH') }} {{ String(index + 1).padStart(2, '0') }}</span
          >
        </div>
        <div class="match-archer">
          <span class="seed-badge">{{ match.seed1 }}</span><strong>{{ archerName(match.seed1Id) }}</strong
          ><input
            class="sl-score"
            type="number"
            min="0"
            :value="match.score1"
            placeholder="—"
            :disabled="!canManage"
            @change="emit('record-score', match, 'score1', $event.target.value)"
          />
        </div>
        <div class="match-divider">
          <span>{{ t('VS') }}</span>
        </div>
        <div class="match-archer">
          <span class="seed-badge">{{ match.seed2 }}</span><strong>{{ archerName(match.seed2Id) }}</strong
          ><input
            class="sl-score"
            type="number"
            min="0"
            :value="match.score2"
            placeholder="—"
            :disabled="!canManage"
            @change="emit('record-score', match, 'score2', $event.target.value)"
          />
        </div>
        <div class="match-foot">
          <span>{{
            match.score1 !== '' && match.score2 !== '' ? 'Scores recorded' : 'Enter both match scores'
          }}</span><i :class="{ complete: match.score1 !== '' && match.score2 !== '' }"></i>
        </div>
      </section>
    </div>
    <section v-else class="panel empty-state bracket-empty">
      <div class="empty-icon">⌁</div>
      <strong>{{ t('No matches seeded yet') }}</strong>
      <p>{{ t('Record at least two scores for this tournament round. Highest seed faces lowest seed.') }}</p>
      <button class="button button-outline" @click="emit('view-scores')">{{ t('Enter round scores') }}</button>
    </section>
    <p class="bracket-note">
      {{ t('First-round pairings belong to this tournament. Re-seeding replaces its current first-round matches.') }}
    </p>
  </section>
</template>
