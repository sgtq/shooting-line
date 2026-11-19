<script setup>
import { t } from '@shooting-line/i18n'

defineProps({
  eyebrow: { type: String, required: true },
  title: { type: String, required: true },
  submitLabel: { type: String, required: true },
  cancelLabel: { type: String, required: true },
  error: { type: String, default: '' },
})
const emit = defineEmits(['submit', 'close'])
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <form class="modal" @submit.prevent="emit('submit')">
      <div class="modal-heading">
        <div>
          <p class="eyebrow">{{ eyebrow }}</p>
          <h2>{{ title }}</h2>
        </div>
        <button type="button" class="modal-close" :aria-label="t('Close dialog')" @click="emit('close')">×</button>
      </div>
      <p v-if="error" class="database-error modal-error" role="alert">{{ error }}</p>
      <slot />
      <div class="modal-actions">
        <button type="button" class="button button-outline" @click="emit('close')">{{ cancelLabel }}</button><button
          type="submit"
          class="button button-primary"
        >
          {{ submitLabel }}
        </button>
      </div>
    </form>
    <slot name="after" />
  </div>
</template>
