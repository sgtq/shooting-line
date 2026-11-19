<script setup>
import { t } from '@shooting-line/i18n'
import { computed } from 'vue'
import NavIcon from './NavIcon.vue'

const props = defineProps({
  clubs: { type: Array, required: true },
  canManage: { type: Boolean, default: false },
  canClubEdit: { type: Boolean, default: false },
  isClubUser: { type: Boolean, default: false },
  clubId: { type: String, default: '' },
})
const emit = defineEmits(['create', 'edit', 'toggle-user', 'add-archer'])
const search = defineModel('search', { type: String, default: '' })

const visibleClubs = computed(() =>
  props.clubs.filter((item) => !search.value || item.name.toLowerCase().includes(search.value.toLowerCase())),
)

/**
 * @param {{ id: string }} club
 * @returns {boolean} True when the user may edit this club.
 */
function canEdit(club) {
  return props.canManage || (props.canClubEdit && club.id === props.clubId)
}

/**
 * @param {{ id: string }} club
 * @returns {boolean} True when the user may add archers to this club.
 */
function canAddArcher(club) {
  return props.canManage || (props.isClubUser && club.id === props.clubId)
}
</script>

<template>
  <section>
    <div class="page-heading heading-row">
      <div>
        <p class="eyebrow">{{ t('YOUR COMMUNITY') }}</p>
        <h1>{{ t('Archery clubs') }}</h1>
        <p class="page-subtitle">{{ t('View clubs and manage your club details.') }}</p>
      </div>
      <button v-if="canManage" class="button button-primary" @click="emit('create')">
        <span>＋</span> {{ t('Add club') }}
      </button>
    </div>
    <div class="section-toolbar">
      <div class="toolbar-count">{{ clubs.length }} {{ t('clubs in the directory') }}</div>
      <div class="search-box"><span>⌕</span><input v-model="search" :placeholder="t('Search clubs...')" /></div>
    </div>
    <div class="clubs-grid">
      <article v-for="club in visibleClubs" :key="club.id" class="club-card">
        <div class="club-card-head">
          <img
            v-if="club.logoUrl"
            class="club-logo"
            :src="club.logoUrl"
            :alt="t('{name} logo', { name: club.name })"
          /><span v-else class="club-avatar large">{{ club.name.charAt(0) }}</span>
        </div>
        <h3>{{ club.name }}</h3>
        <a v-if="club.mapUrl" class="club-location" :href="club.mapUrl" target="_blank" rel="noreferrer"
          >⌖ {{ club.address || t('Open map') }} ↗</a
        >
        <p v-else class="club-location">⌖ {{ club.address || t('No address added') }}</p>
        <div class="club-contact">
          <span class="contact-label">{{ t('REPRESENTATIVE') }}</span><strong>{{
            club.representative || t('Not provided')
          }}</strong
          ><a :href="`tel:${club.phone}`">{{ club.phone || t('No phone number') }}</a
          ><a v-if="club.email" :href="`mailto:${club.email}`">{{ club.email }}</a>
        </div>
        <div v-if="canManage || isClubUser" class="club-user-row">
          <div>
            <span class="contact-label">{{ t('CLUB USER') }}</span>
            <strong>{{ club.email || club.userEmail || t('No email set') }}</strong>
          </div>
          <div class="club-user-controls">
            <span class="status-pill" :class="club.userEnabled ? 'status-active' : 'status-disabled'"
              ><i></i>{{ club.userEnabled ? t('Enabled') : t('Disabled') }}</span
            >
            <button
              v-if="canManage"
              type="button"
              class="button button-small button-outline"
              @click="emit('toggle-user', club)"
            >
              {{ club.userEnabled ? t('Disable') : t('Enable') }}
            </button>
          </div>
        </div>
        <div class="club-card-actions">
          <button
            v-if="canAddArcher(club)"
            class="button button-small button-outline"
            @click="emit('add-archer', club.id)"
          >
            {{ t('＋ Add archer') }}
          </button>
          <a
            v-if="club.website"
            :href="club.website"
            target="_blank"
            rel="noreferrer"
            class="button button-small button-outline"
            >{{ t('Website ↗') }}</a
          >
          <button
            v-if="canEdit(club)"
            class="button button-icon"
            :aria-label="t('Edit club')"
            :title="t('Edit club')"
            @click="emit('edit', club)"
          >
            <NavIcon name="pencil" />
          </button>
        </div>
      </article>
      <button v-if="canManage" class="add-card" @click="emit('create')">
        <span>＋</span><strong>{{ t('Add a club') }}</strong
        ><small>{{ t('Add club contact and location details') }}</small>
      </button>
    </div>
  </section>
</template>
