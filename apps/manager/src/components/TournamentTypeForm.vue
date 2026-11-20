<script setup>
import { t } from '@shooting-line/i18n'

defineProps({
  targetTypeOptions: { type: Array, required: true },
  canManage: { type: Boolean, default: false },
})
const emit = defineEmits(['add-target-type'])

const form = defineModel('form', { type: Object, required: true })
</script>

<template>
  <div class="form-grid">
    <label class="form-field full"
      ><span>{{ t('TYPE NAME') }} <b>*</b></span
      ><input v-model="form.name" required :placeholder="t('e.g. Outdoor 70m Recurve')"
    /></label>
    <label class="form-field"
      ><span>{{ t('DISTANCE') }} <b>*</b></span
      ><input v-model.number="form.distance" required type="number" min="0.1" step="any" placeholder="70"
    /></label>
    <label class="form-field"
      ><span>{{ t('DISTANCE UNIT') }} <b>*</b></span
      ><select v-model="form.distanceUnit" required>
        <option value="m">{{ t('Meters') }}</option>
        <option value="yd">{{ t('Yards') }}</option>
      </select></label
    >
    <div class="form-field full">
      <span>{{ t('TARGET TYPE') }} <b>*</b></span>
      <div class="field-with-button">
        <select v-model="form.targetType" required :aria-label="t('Target type')">
          <option value="" disabled>{{ t('Select or add a custom target type') }}</option>
          <option v-for="targetType in targetTypeOptions" :key="targetType">{{ targetType }}</option>
        </select>
        <button
          v-if="canManage"
          type="button"
          class="icon-button target-type-add"
          :aria-label="t('Add custom target type')"
          :title="t('Add custom target type')"
          @click="emit('add-target-type')"
        >
          ＋
        </button>
      </div>
    </div>
    <label class="form-field"
      ><span>{{ t('ENDS (SERIES)') }} <b>*</b></span
      ><input v-model.number="form.ends" required type="number" min="1" step="1" placeholder="12"
    /></label>
    <label class="form-field"
      ><span>{{ t('ARROWS PER END') }} <b>*</b></span
      ><input v-model.number="form.arrowsPerEnd" required type="number" min="1" step="1" placeholder="6"
    /></label>
    <p class="address-preview full">
      {{ t('This format can be selected when creating a tournament and reused for future events.') }}
    </p>
  </div>
</template>
