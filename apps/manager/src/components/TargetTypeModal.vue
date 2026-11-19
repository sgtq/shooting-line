<script setup>
import { t } from '@shooting-line/i18n'

defineProps({
  error: { type: String, default: '' },
})
const emit = defineEmits(['save', 'close'])
const name = defineModel('name', { type: String, default: '' })
</script>

<template>
  <div class="modal-backdrop target-type-backdrop" @click.self="emit('close')">
    <section class="modal target-type-modal" role="dialog" aria-modal="true" aria-labelledby="target-type-modal-title">
      <div class="modal-heading">
        <div>
          <p class="eyebrow">{{ t('CUSTOM TARGET TYPES') }}</p>
          <h2 id="target-type-modal-title">{{ t('Add a target type') }}</h2>
        </div>
        <button type="button" class="modal-close" :aria-label="t('Close dialog')" @click="emit('close')">×</button>
      </div>
      <label class="form-field">
        <span>{{ t('TARGET TYPE NAME') }} <b>*</b></span>
        <input
          v-model="name"
          required
          autofocus
          :aria-label="t('Custom target type name')"
          :placeholder="t('e.g. 40 cm triple-spot')"
          @keydown.enter.prevent="emit('save')"
        />
      </label>
      <p v-if="error" class="database-error modal-error" role="alert">{{ error }}</p>
      <div class="modal-actions">
        <button type="button" class="button button-outline" @click="emit('close')">{{ t('Cancel') }}</button>
        <button
          type="button"
          class="button button-primary"
          :aria-label="t('Save custom target type')"
          @click="emit('save')"
        >
          {{ t('Save target type') }}
        </button>
      </div>
    </section>
  </div>
</template>
