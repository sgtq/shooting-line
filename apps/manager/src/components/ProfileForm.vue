<script setup>
import { t } from '@shooting-line/i18n'

defineProps({
  userEmail: { type: String, default: '' },
})
const emit = defineEmits(['reset-password'])

const form = defineModel('form', { type: Object, required: true })
</script>

<template>
  <label class="form-field">
    <span>{{ t('DISPLAY NAME') }} <b>*</b></span>
    <input v-model="form.displayName" required autocomplete="name" />
  </label>
  <button v-if="userEmail" type="button" class="button button-outline" @click="emit('reset-password')">
    {{ t('Email me a password reset link') }}
  </button>
</template>
