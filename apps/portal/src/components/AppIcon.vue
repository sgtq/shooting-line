<script setup>
defineProps({
  /** Launcher option id: `manager`, `scorecard`, or `ianseo-dashboard`. */
  appId: { type: String, required: true },
})
</script>

<template>
  <!-- Decorative: the tile name carries the meaning. currentColor follows the card text color. -->
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    width="28"
    height="28"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="appId === 'manager'">
      <path d="M9 4h6v3H9z" />
      <path d="M15 5.5h2A1.5 1.5 0 0 1 18.5 7v3" />
      <path d="M9 5.5H7A1.5 1.5 0 0 0 5.5 7v12A1.5 1.5 0 0 0 7 20.5h4" />
      <path d="M18.6 12.4a1.3 1.3 0 0 1 1.8 1.8L14 20.6l-2.8.7.7-2.8z" />
    </template>
    <template v-else-if="appId === 'scorecard'">
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
      <path d="m7.5 8 1.2 1.2L10.8 7" />
      <path d="M13 8h3.5" />
      <path d="m7.5 13 1.2 1.2 2.1-2.2" />
      <path d="M13 13h3.5" />
      <path d="M7.5 17.5h3M13 17.5h3.5" />
    </template>
    <template v-else-if="appId === 'ianseo-dashboard'">
      <rect x="3" y="5" width="18" height="11" rx="2" />
      <path d="M7 12.5V10M10.5 12.5V8.5M14 12.5v-3M17.5 12.5V9" />
      <path d="M8 20h8M12 16v4" />
    </template>
  </svg>
</template>
