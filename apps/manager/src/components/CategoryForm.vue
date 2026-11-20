<script setup>
import { t } from '@shooting-line/i18n'

const form = defineModel('form', { type: Object, required: true })
</script>

<template>
  <div class="form-grid">
    <label class="form-field full"
      ><span>{{ t('CATEGORY NAME') }} <b>*</b></span
      ><input v-model="form.name" required :placeholder="t('e.g. Junior Recurve')"
    /></label>
    <label class="form-field"
      ><span
        >{{ t('MINIMUM AGE') }} <small>{{ t('OPTIONAL') }}</small></span
      ><input v-model.number="form.minAge" type="number" min="0" step="1" :placeholder="t('No minimum')"
    /></label>
    <label class="form-field"
      ><span
        >{{ t('MAXIMUM AGE') }} <small>{{ t('OPTIONAL') }}</small></span
      ><input v-model.number="form.maxAge" type="number" min="0" step="1" :placeholder="t('No maximum')"
    /></label>
    <label class="form-field full"
      ><span
        >{{ t('BOW TYPE') }} <small>{{ t('OPTIONAL') }}</small></span
      ><select v-model="form.bowType">
        <option value="">{{ t('Any bow type') }}</option>
        <option value="Recurve">{{ t('Recurve') }}</option>
        <option value="Compound">{{ t('Compound') }}</option>
        <option value="Barebow">{{ t('Barebow') }}</option>
        <option value="Longbow">{{ t('Longbow') }}</option>
        <option value="Traditional">{{ t('Traditional') }}</option>
      </select></label
    >
    <label class="form-field full checkbox-field"
      ><input v-model="form.levelExempt" type="checkbox" /><span>{{
        t('Not part of the level order (limited only by age, such as Masters)')
      }}</span></label
    >
    <label v-if="!form.levelExempt" class="form-field full"
      ><span>{{ t('LEVEL ORDER') }} <b>*</b></span
      ><input
        v-model.number="form.sortOrder"
        required
        type="number"
        min="0"
        step="1"
        :placeholder="t('e.g. 0 for the lowest level')"
    /></label>
    <p v-if="!form.levelExempt" class="address-preview full">
      {{ t('Within a bow type, an archer who entered a category can never enter one with a lower level order.') }}
    </p>
    <p class="address-preview full">
      {{
        t(
          "Age limits are checked against the archer's age on the tournament date. Leave a field blank when it does not apply.",
        )
      }}
    </p>
  </div>
</template>
