<script setup>
import { t } from '@shooting-line/i18n'
import { categoryBlockReason as categoryBlockReasonFor } from '../services/categoryEligibility'
import { displayChoice } from '../services/display'

const props = defineProps({
  selectedMatch: { type: Object, default: null },
  archerMatches: { type: Array, required: true },
  assignNewParticipant: { type: Boolean, default: false },
  editingParticipantId: { type: String, default: '' },
  selectedTournament: { type: Object, default: undefined },
  clubs: { type: Array, required: true },
  categories: { type: Array, required: true },
  tournaments: { type: Array, required: true },
  clubId: { type: String, default: '' },
  canManage: { type: Boolean, default: false },
})
const emit = defineEmits(['clear'])
const form = defineModel('form', { type: Object, required: true })
// A picked match is sent as a one-time token, never a database id.
const matchToken = defineModel('matchToken', { type: String, default: '' })

/**
 * @param {string} id
 * @returns {object|undefined} The category with that id.
 */
function categoryFor(id) {
  return props.categories.find((category) => category.id === id)
}

/**
 * @param {object} tournament
 * @returns {string[]} The bow types of the categories the tournament offers.
 */
function tournamentBowTypes(tournament) {
  return [...new Set(tournament.categoryIds.map((categoryId) => categoryFor(categoryId)?.bowType ?? ''))]
}

/**
 * @param {object} tournament
 * @param {object} participant The form values or an archer.
 * @param {object} category
 * @returns {string} Why the archer cannot enter the category, or an empty string.
 */
function categoryBlockReason(tournament, participant, category) {
  return categoryBlockReasonFor(tournament, participant, category, {
    tournaments: props.tournaments,
    categories: props.categories,
  })
}

/** @returns {string} Tooltip for category pickers, which disable options the archer cannot enter. */
function categoryLimitHint() {
  return t("Limited by the archer's age and the categories they have already entered")
}
</script>

<template>
  <div class="form-grid">
    <label class="form-field"
      ><span
        >{{ t('WORLD ARCHERY ID') }} <small>{{ t('OPTIONAL') }}</small></span
      ><input v-model="form.waId" autocomplete="off" :placeholder="t('Affiliation number')"
    /></label>
    <label class="form-field"
      ><span
        >{{ t('AETAY ID') }} <small>{{ t('OPTIONAL') }}</small></span
      ><input v-model="form.aetayId" autocomplete="off" :placeholder="t('Affiliation number')"
    /></label>
    <label class="form-field full"
      ><span
        >{{ t('EMAIL') }} <small>{{ t('OPTIONAL') }}</small></span
      ><input v-model="form.email" type="email" autocomplete="off" :placeholder="t('Needed to request a login')"
    /></label>
    <label class="form-field"
      ><span>{{ t('LAST NAME') }} <b v-if="!selectedMatch">*</b></span
      ><input
        v-model="form.lastName"
        :required="!selectedMatch"
        autocomplete="family-name"
        :placeholder="t('Last name')"
    /></label>
    <label class="form-field"
      ><span>{{ t('FIRST NAME') }} <b v-if="!selectedMatch">*</b></span
      ><input
        v-model="form.firstName"
        :required="!selectedMatch"
        autocomplete="given-name"
        :placeholder="t('First name')"
    /></label>
    <div v-if="archerMatches.length" class="archer-pick-list full" role="radiogroup" :aria-label="t('Archers found')">
      <p class="privacy-note">
        {{
          assignNewParticipant
            ? t('Archers already in the database. Click one to add them instead of creating a new archer.')
            : t('Archers already in the database. Check that you are not creating a duplicate.')
        }}
      </p>
      <label v-for="match in archerMatches" :key="match.token" class="archer-pick">
        <input
          v-model="matchToken"
          type="radio"
          name="archer-match"
          :value="match.token"
          :disabled="!assignNewParticipant"
        />
        <span class="roster-name"
          ><strong>{{ match.lastName }}, {{ match.firstName }}</strong
          ><small>{{ clubs.find((club) => club.id === match.clubId)?.name || t('No club') }}</small></span
        >
      </label>
    </div>
    <div v-if="!editingParticipantId" class="full">
      <button type="button" class="text-link" @click="emit('clear')">{{ t('Clear form') }}</button>
    </div>
    <p v-if="selectedMatch" class="address-preview full">
      {{
        t('Adding {name}. Their record stays private to their own club.', {
          name: `${selectedMatch.firstName} ${selectedMatch.lastName}`,
        })
      }}
      <button type="button" class="text-link" @click="matchToken = ''">
        {{ t('Create a new archer instead') }}
      </button>
    </p>
    <template v-if="!selectedMatch">
      <label class="form-field full"
        ><span>{{ t('BIRTH DATE') }} <b>*</b></span
        ><input v-model="form.birthDate" required type="date"
      /></label>
      <label class="form-field full">
        <span
          >{{ t('CLUB') }} <small v-if="canManage">{{ t('OPTIONAL') }}</small><b v-else>*</b></span
        >
        <select v-model="form.clubId" :disabled="!canManage">
          <option v-if="canManage" value="">{{ t('No club / independent archer') }}</option>
          <option
            v-for="club in canManage ? clubs : clubs.filter((item) => item.id === clubId)"
            :key="club.id"
            :value="club.id"
          >
            {{ club.name }}
          </option>
        </select>
      </label>
    </template>
    <template v-if="assignNewParticipant && !editingParticipantId && selectedTournament?.categoryIds.length">
      <label class="form-field"
        ><span>{{ t('BOW TYPE') }} <b>*</b></span
        ><select v-model="form.bowType" required aria-label="Bow type" @change="form.categoryId = ''">
          <option value="" disabled>{{ t('Choose bow type') }}</option>
          <option v-for="bowType in tournamentBowTypes(selectedTournament)" :key="bowType" :value="bowType">
            {{ bowType ? displayChoice(bowType) : t('Any bow type') }}
          </option>
        </select></label
      >
      <label class="form-field"
        ><span>{{ t('CATEGORY') }} <b>*</b></span
        ><select v-model="form.categoryId" required aria-label="Category" :title="categoryLimitHint()">
          <option value="" disabled>{{ t('Choose category') }}</option>
          <option
            v-for="categoryId in selectedTournament.categoryIds.filter(
              (id) => categoryFor(id)?.bowType === form.bowType,
            )"
            :key="categoryId"
            :value="categoryId"
            :disabled="Boolean(categoryBlockReason(selectedTournament, form, categoryFor(categoryId)))"
          >
            {{ categoryFor(categoryId)?.name }}
          </option>
        </select></label
      >
    </template>
    <p v-if="!selectedMatch" class="privacy-note full">
      {{ t('Archer details are stored in the shared manager database.') }}
    </p>
  </div>
</template>
