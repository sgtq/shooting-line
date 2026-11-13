<script setup>
defineProps({
  activePage: { type: String, required: true },
  navItems: { type: Array, required: true },
  tournamentCount: { type: Number, required: true },
})

const emit = defineEmits(['navigate'])
</script>

<template>
  <aside class="sidebar">
    <a class="brand" href="#" @click.prevent="emit('navigate', 'dashboard')">
      <span class="brand-mark"><span></span><span></span><span></span></span>
      <span class="brand-name">Shooting<span>Line</span></span>
    </a>
    <div class="workspace-label">WORKSPACE</div>
    <nav class="main-nav" aria-label="Main navigation">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="nav-link"
        :class="{ active: activePage === item.id }"
        :aria-label="item.label"
        :title="item.label"
        @click="emit('navigate', item.id)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
        <span v-if="item.id === 'tournaments'" class="nav-count">{{ tournamentCount }}</span>
      </button>
    </nav>
    <div class="sidebar-bottom">
      <div class="help-card">
        <div class="help-icon">↗</div>
        <strong>Made for the range</strong>
        <p>Keep your club and tournament details in one place.</p>
      </div>
      <button class="profile-button">
        <span class="avatar">A</span>
        <span class="profile-copy"><strong>Administrator</strong><small>Demo workspace</small></span>
        <span class="profile-menu">···</span>
      </button>
    </div>
  </aside>
</template>
