<script setup>
import logoUrl from '../assets/shooting-line-logo.svg'
import darkLogoUrl from '../assets/shooting-line-logo-dark.svg'

defineProps({
  activePage: { type: String, required: true },
  navItems: { type: Array, required: true },
  tournamentCount: { type: Number, required: true },
  userEmail: { type: String, default: '' },
})

const emit = defineEmits(['navigate'])
const iconUrl = `${import.meta.env.BASE_URL}shooting-line-icon.svg`
const darkIconUrl = `${import.meta.env.BASE_URL}shooting-line-icon-dark.svg`
</script>

<template>
  <aside class="sidebar">
    <a class="brand" href="#" aria-label="ShootingLine home" @click.prevent="emit('navigate', 'dashboard')">
      <img class="brand-logo brand-logo-light" :src="logoUrl" alt="ShootingLine" />
      <img class="brand-logo brand-logo-dark" :src="darkLogoUrl" alt="" />
      <img class="brand-icon brand-icon-light" :src="iconUrl" alt="" />
      <img class="brand-icon brand-icon-dark" :src="darkIconUrl" alt="" />
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
        <span class="profile-copy"><strong>Workspace member</strong><small>{{ userEmail || 'Signed in' }}</small></span>
        <span class="profile-menu">···</span>
      </button>
    </div>
  </aside>
</template>
