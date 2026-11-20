<script setup>
import { t } from '@shooting-line/i18n'

defineProps({
  canManage: { type: Boolean, default: false },
})
const emit = defineEmits(['logo-selected'])

const form = defineModel('form', { type: Object, required: true })
</script>

<template>
  <div class="form-grid">
    <label class="form-field full"
      ><span>{{ t('CLUB NAME') }} <b>*</b></span
      ><input v-model="form.name" required :disabled="!canManage" :placeholder="t('e.g. Northside Archery Club')"
    /></label>
    <p v-if="!canManage" class="privacy-note full">
      {{ t('Only a manager can change the name and location of a club.') }}
    </p>
    <label class="form-field"
      ><span>{{ t('REPRESENTATIVE NAME') }} <b>*</b></span
      ><input v-model="form.representative" required :placeholder="t('Full name')"
    /></label>
    <label class="form-field"
      ><span>{{ t('PHONE NUMBER') }} <b>*</b></span
      ><input v-model="form.phone" required type="tel" placeholder="(555) 123-4567"
    /></label>
    <label class="form-field"
      ><span
        >{{ t('EMAIL') }} <small>{{ t('OPTIONAL') }}</small></span
      ><input v-model="form.email" type="email" placeholder="contact@club.org"
    /></label>
    <label class="form-field"
      ><span
        >{{ t('WEBSITE') }} <small>{{ t('OPTIONAL') }}</small></span
      ><input v-model="form.website" type="url" placeholder="https://"
    /></label>
    <label class="form-field full"
      ><span>{{ t('LOCATION ADDRESS') }} <b>*</b></span
      ><input v-model="form.address" required :disabled="!canManage" :placeholder="t('Street, city, state, ZIP')"
    /></label>
    <label class="form-field full"
      ><span
        >{{ t('MAP LOCATION URL') }} <small>{{ t('OPTIONAL') }}</small></span
      ><input v-model="form.mapUrl" type="url" :disabled="!canManage" placeholder="https://maps.google.com/..."
    /></label>
    <label class="form-field full">
      <span
        >{{ t('CLUB LOGO') }} <small>{{ t('JPG, PNG, OR WEBP · MAX 2 MB') }}</small></span
      >
      <input type="file" accept="image/jpeg,image/png,image/webp" @change="emit('logo-selected', $event)" />
    </label>
    <img
      v-if="form.logoPreview"
      class="club-logo-preview"
      :src="form.logoPreview"
      :alt="t('{name} logo preview', { name: form.name || t('Club') })"
    />
  </div>
</template>
