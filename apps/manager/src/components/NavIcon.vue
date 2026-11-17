<script setup>
defineProps({
  name: { type: String, required: true },
})
</script>

<template>
  <svg
    class="nav-icon-svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'dashboard'">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </template>
    <template v-else-if="name === 'tournaments'">
      <path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0V4z" />
      <path d="M7.5 6H4.5v1.5a3 3 0 0 0 3 3M16.5 6h3v1.5a3 3 0 0 1-3 3" />
      <path d="M12 14v4M8.5 20.5h7M9.5 18h5" />
    </template>
    <template v-else-if="name === 'tournament-types'">
      <path d="M4 7h9M18 7h2M4 12h3M12 12h8M4 17h11M19 17h1" />
      <circle cx="15.5" cy="7" r="2" />
      <circle cx="9.5" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </template>
    <template v-else-if="name === 'categories'">
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3.5 13.5V3.5h10l7.1 7.1a2 2 0 0 1 0 2.8z" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'clubs'">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M10 20v-6h4v6" />
    </template>
    <template v-else-if="name === 'archers'">
      <path d="M5 3c9 3 9 15 0 18" />
      <path d="M5 3v18" />
      <path d="M2.5 12H21" />
      <path d="M17.5 8.5L21 12l-3.5 3.5" />
      <path d="M5 12L2.5 9.5M5 12l-2.5 2.5" />
    </template>
    <template v-else-if="name === 'user-access'">
      <circle cx="12" cy="8" r="4" fill="currentColor" stroke="none" />
      <path d="M4 21a8 8 0 0 1 16 0z" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'pencil'">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </template>
  </svg>
</template>
