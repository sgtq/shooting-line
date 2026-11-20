<script setup>
import { t } from '@shooting-line/i18n'
import { computed, ref } from 'vue'
import { categoryBlockReason, categoryChangeOptions } from '../services/categoryEligibility'
import { ageAtTournament, fullName } from '../services/display'
import { filterRoster, rosterSearchOptions } from '../services/rosterFilter'
import NavIcon from './NavIcon.vue'

const props = defineProps({
  tournament: { type: Object, required: true },
  participants: { type: Array, required: true },
  clubs: { type: Array, required: true },
  categories: { type: Array, required: true },
  tournaments: { type: Array, required: true },
  canEditTournament: { type: Boolean, default: false },
})
const emit = defineEmits(['add-archer', 'choose-category', 'change-category', 'clear-category', 'remove'])
// The filters live in the parent so they survive switching tabs.
const clubFilter = defineModel('clubFilter', { type: String, default: '' })
const search = defineModel('search', { type: String, default: '' })
// Only one archer's change-category picker is open at a time.
const changingId = ref('')

const eligibilityData = computed(() => ({ tournaments: props.tournaments, categories: props.categories }))
const roster = computed(() =>
  filterRoster(props.participants, props.tournament.participantIds, {
    clubId: clubFilter.value,
    query: search.value,
  }),
)
const searchOptions = computed(() =>
  rosterSearchOptions(props.participants, props.tournament.participantIds, clubFilter.value),
)

/**
 * @param {string} id
 * @returns {object|undefined} The category with that id.
 */
function categoryFor(id) {
  return props.categories.find((category) => category.id === id)
}

/**
 * @param {{ id: string }} person
 * @returns {object[]} The categories the archer may move to.
 */
function changeOptions(person) {
  return categoryChangeOptions(props.tournament, person, eligibilityData.value)
}

/**
 * @param {{ id: string }} person
 * @param {string} categoryId
 * @returns {string} Why the archer cannot enter the category, or an empty string.
 */
function blockReason(person, categoryId) {
  return categoryBlockReason(props.tournament, person, categoryFor(categoryId), eligibilityData.value)
}

/**
 * @param {{ id: string }} person
 * @param {Event} event The change event of the picker.
 * @returns {void}
 */
function changeCategory(person, event) {
  emit('change-category', props.tournament, person, event)
  changingId.value = ''
}

/** @returns {string} Tooltip for category pickers, which disable options the archer cannot enter. */
function categoryLimitHint() {
  return t("Limited by the archer's age and the categories they have already entered")
}
</script>

<template>
  <section class="panel roster-panel">
    <div class="panel-heading">
      <div>
        <h2>{{ t('Tournament archers') }}</h2>
        <p>{{ t('Archers entered in this tournament.') }}</p>
      </div>
      <button v-if="canEditTournament" class="button button-small button-outline" @click="emit('add-archer')">
        {{ t('＋ Add archer') }}
      </button>
    </div>
    <div class="participant-directory-filter">
      <label class="select-field"
        ><span>{{ t('FILTER BY CLUB') }}</span
        ><select v-model="clubFilter" :aria-label="t('Filter archers by club')">
          <option value="">{{ t('All clubs') }}</option>
          <option value="__unassigned__">{{ t('No club assigned') }}</option>
          <option v-for="club in clubs" :key="club.id" :value="club.id">{{ club.name }}</option>
        </select></label
      >
      <label class="select-field"
        ><span>{{ t('SEARCH LAST NAME OR AFFILIATION') }}</span
        ><input
          v-model="search"
          list="archer-search-options"
          :aria-label="t('Search archers by last name or affiliation')"
          :placeholder="t('Type a last name or ID')"
      /></label>
      <datalist id="archer-search-options">
        <option v-for="value in searchOptions" :key="value" :value="value" />
      </datalist>
    </div>
    <div v-if="roster.length" class="roster-list">
      <div class="roster-row roster-head">
        <span>{{ t('ARCHER') }}</span>
        <span>{{ t('CATEGORY') }}</span>
        <span v-if="canEditTournament">{{ t('ACTIONS') }}</span>
      </div>
      <div v-for="person in roster" :key="person.id" class="roster-row">
        <span class="roster-person">
          <span class="person-avatar">{{ person.firstName.charAt(0) }}{{ person.lastName.charAt(0) }}</span>
          <span class="roster-name"
            ><strong>{{ person.lastName }}, {{ person.firstName }}</strong
            ><small
              >{{ person.waId ? `World Archery ${person.waId}` : person.aetayId || t('No affiliation number') }} ·
              {{ clubs.find((club) => club.id === person.clubId)?.name || t('No club') }} ·
              {{ ageAtTournament(person, tournament) ?? t('Age unknown') }} {{ t('at event') }}</small
            ></span
          >
        </span>
        <span class="roster-category-cell">
          <template v-if="changingId === person.id">
            <select
              class="category-select"
              :title="categoryLimitHint()"
              :aria-label="t('Change category of {name}', { name: fullName(person) })"
              value=""
              @change="changeCategory(person, $event)"
            >
              <option value="">{{ t('Change category') }}</option>
              <option v-for="category in changeOptions(person)" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
            <button
              class="button"
              :aria-label="t('Cancel changing the category of {name}', { name: fullName(person) })"
              @click="changingId = ''"
            >
              {{ t('Cancel') }}
            </button>
          </template>
          <template v-else-if="tournament.categoryAssignments[person.id]">
            <span class="roster-category">{{
              categoryFor(tournament.categoryAssignments[person.id])?.name || '—'
            }}</span>
            <template v-if="canEditTournament">
              <button
                v-if="changeOptions(person).length"
                class="button button-icon"
                :aria-label="t('Change category of {name}', { name: fullName(person) })"
                :title="t('Change category')"
                @click="changingId = person.id"
              >
                <NavIcon name="pencil" />
              </button>
              <button
                class="button button-icon"
                :aria-label="t('Remove the category of {name}', { name: fullName(person) })"
                :title="t('Remove category')"
                @click="emit('clear-category', tournament, person)"
              >
                <NavIcon name="close" />
              </button>
            </template>
          </template>
          <select
            v-else-if="canEditTournament && tournament.categoryIds.length"
            class="category-select"
            :title="categoryLimitHint()"
            :aria-label="t('Choose category of {name}', { name: fullName(person) })"
            value=""
            @change="emit('choose-category', tournament, person, $event)"
          >
            <option value="">{{ t('Choose category') }}</option>
            <option
              v-for="categoryId in tournament.categoryIds"
              :key="categoryId"
              :value="categoryId"
              :disabled="Boolean(blockReason(person, categoryId))"
              :title="blockReason(person, categoryId)"
            >
              {{ categoryFor(categoryId)?.name }}
            </option>
          </select>
          <span v-else class="roster-category">—</span>
        </span>
        <span v-if="canEditTournament" class="roster-actions">
          <button
            class="button button-soft-danger"
            :aria-label="t('Remove {name} from tournament', { name: fullName(person) })"
            @click="emit('remove', tournament, person)"
          >
            {{ t('Remove from tournament') }}
          </button>
        </span>
      </div>
    </div>
    <div v-else class="empty-state">
      <strong>{{
        tournament.participantIds.length ? t('No archers match these filters') : t('No archers in this tournament')
      }}</strong>
      <p>
        {{
          tournament.participantIds.length
            ? t('Choose another club or clear the search.')
            : canEditTournament
              ? t('Add an archer from the database or create a new one.')
              : t('Archers entered in this tournament will appear here.')
        }}
      </p>
      <button
        v-if="canEditTournament && !tournament.participantIds.length"
        class="button button-primary"
        @click="emit('add-archer')"
      >
        {{ t('Add archer') }}
      </button>
    </div>
  </section>
</template>
