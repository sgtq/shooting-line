<script setup>
import { t } from '@shooting-line/i18n'
import { MAX_TOURNAMENT_DAYS } from '../services/tournamentDates'

defineProps({
  modalType: { type: String, required: true },
  tournamentTypes: { type: Array, required: true },
  clubs: { type: Array, required: true },
  clubId: { type: String, default: '' },
  canManage: { type: Boolean, default: false },
})
const emit = defineEmits(['add-type', 'add-club'])
const form = defineModel('form', { type: Object, required: true })
</script>

<template>
  <div class="form-grid">
    <label v-if="modalType === 'tournament'" class="form-field full"
      ><span>{{ t('TOURNAMENT NAME') }} <b>*</b></span
      ><input v-model="form.name" required :placeholder="t('e.g. Spring Championship')"
    /></label>
    <div class="form-field full">
      <span>{{ t('DATES') }} <b>*</b></span>
      <select v-model="form.dateMode" :aria-label="t('How to enter the dates')">
        <option value="range">{{ t('Date range') }}</option>
        <option value="days">{{ t('Separate dates') }}</option>
      </select>
    </div>
    <template v-if="form.dateMode === 'range'">
      <label class="form-field"
        ><span>{{ t('START DATE') }} <b>*</b></span
        ><input v-model="form.startDate" required type="date"
      /></label>
      <label class="form-field"
        ><span>{{ t('END DATE') }} <b>*</b></span
        ><input v-model="form.endDate" required type="date" :min="form.startDate || undefined"
      /></label>
    </template>
    <div v-else class="form-field full">
      <div v-for="(day, index) in form.days" :key="index" class="field-with-button">
        <input
          v-model="form.days[index]"
          required
          type="date"
          :aria-label="t('Tournament date {number}', { number: index + 1 })"
        />
        <button
          v-if="form.days.length > 1"
          type="button"
          class="button button-outline"
          @click="form.days.splice(index, 1)"
        >
          {{ t('Remove date') }}
        </button>
      </div>
      <button
        type="button"
        class="button button-outline"
        :disabled="form.days.length >= MAX_TOURNAMENT_DAYS"
        @click="form.days.push('')"
      >
        {{ t('Add date') }}
      </button>
    </div>
    <template v-if="modalType === 'tournament'">
      <label class="form-field"
        ><span>{{ t('DISCIPLINE') }}</span
        ><select v-model="form.discipline">
          <option value="Outdoor target">{{ t('Outdoor target') }}</option>
          <option value="Indoor target">{{ t('Indoor target') }}</option>
          <option value="Field">{{ t('Field') }}</option>
          <option>3D</option>
          <option value="Other">{{ t('Other') }}</option>
        </select></label
      >
      <div class="form-field full">
        <span>{{ t('TOURNAMENT TYPE') }} <b>*</b></span>
        <div class="field-with-button">
          <select v-model="form.tournamentTypeId" required :aria-label="t('Tournament type')">
            <option value="" disabled>{{ t('Select a tournament type') }}</option>
            <option v-for="type in tournamentTypes" :key="type.id" :value="type.id">
              {{ type.name }} — {{ type.distance }} {{ type.distanceUnit }}, {{ type.targetType }}
            </option>
          </select>
          <button
            v-if="canManage"
            type="button"
            class="icon-button target-type-add"
            :aria-label="t('Add tournament type')"
            :title="t('Add tournament type')"
            @click="emit('add-type')"
          >
            ＋
          </button>
        </div>
      </div>
      <div class="form-field full">
        <span>{{ t('HOST CLUB') }}</span>
        <div class="field-with-button">
          <select v-model="form.clubId" :disabled="!canManage" :aria-label="t('Host club')">
            <option v-if="canManage" value="">{{ t('No club / independent event') }}</option>
            <option
              v-for="club in canManage ? clubs : clubs.filter((item) => item.id === clubId)"
              :key="club.id"
              :value="club.id"
            >
              {{ club.name }}
            </option>
          </select>
          <button
            v-if="canManage"
            type="button"
            class="icon-button target-type-add"
            :aria-label="t('Add new club')"
            :title="t('Add new club')"
            @click="emit('add-club')"
          >
            ＋
          </button>
        </div>
      </div>
      <div class="form-field full">
        <span>{{ t('TOURNAMENT LOCATION') }}</span>
        <div class="radio-row">
          <label><input v-model="form.venueMode" type="radio" value="club" /> {{ t('Use club address') }}</label
          ><label><input v-model="form.venueMode" type="radio" value="custom" /> {{ t('Custom address') }}</label>
        </div>
      </div>
      <label v-if="form.venueMode === 'custom'" class="form-field full"
        ><span>{{ t('CUSTOM ADDRESS') }} <b>*</b></span
        ><input v-model="form.customAddress" required :placeholder="t('Street, city, state, ZIP')"
      /></label>
      <p v-else-if="form.clubId" class="address-preview full">
        ⌖ {{ clubs.find((club) => club.id === form.clubId)?.address || t('This club has no address yet.') }}
      </p>
    </template>
  </div>
</template>
