<script setup>
import { language, setLanguage, t } from './index.js'
</script>

<template>
  <label class="language-switcher">
    <span>{{ t('Language') }}</span>
    <select :value="language" @change="setLanguage($event.target.value)">
      <option value="en" lang="en">English</option>
      <option value="es-419" lang="es-419">Español</option>
    </select>
  </label>
</template>

<style scoped>
.language-switcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary, #64748b);
  font-size: 12px;
  font-weight: 600;
}
.language-switcher select {
  padding: 6px;
  border: 1px solid var(--border-subtle, #d7dee7);
  border-radius: 6px;
  color: var(--text-primary, #172033);
  background: var(--bg-surface, #fff);
  font: inherit;
}
</style>
