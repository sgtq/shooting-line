<script setup>
import { t } from '@shooting-line/i18n'

const form = defineModel('form', { type: Object, required: true })
</script>

<template>
  <div class="form-grid">
    <label class="form-field full">
      <span>{{ t('ACCOUNT EMAIL') }} <b>*</b></span>
      <input v-model="form.email" required type="email" placeholder="manager@example.com" />
    </label>
    <label class="form-field full">
      <span
        >{{ t('DISPLAY NAME') }} <small>{{ t('OPTIONAL') }}</small></span
      >
      <input v-model="form.displayName" :placeholder="t('Name shown in the app')" />
    </label>
    <p class="address-preview full">
      {{ t('The account must already exist in Supabase Auth before a manager role can be assigned.') }}
    </p>
  </div>
</template>
