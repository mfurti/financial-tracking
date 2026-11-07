<script setup lang="ts">
import { z } from 'zod';
import { userErrorMessage } from '../utils/api-error';

const api = useApi();
const route = useRoute();
const error = ref('');
const links = [
  { to: '/', label: 'Übersicht', icon: '◈' },
  { to: '/transactions', label: 'Umsätze', icon: '≋' },
  { to: '/accounts', label: 'Konten', icon: '▣' },
  { to: '/categories', label: 'Kategorien', icon: '⊞' },
  { to: '/imports', label: 'Importe', icon: '↥' },
  { to: '/connections', label: 'Bankverbindungen', icon: '⌁' },
  { to: '/settings', label: 'Einstellungen', icon: '⚙' },
];
/** Revoke the cookie session before navigating to login. */
async function logout() {
  try {
    await api.request('/auth/logout', z.object({ ok: z.boolean() }), { method: 'POST', body: {} });
    api.session.value = null;
    await navigateTo('/login');
  } catch (cause) {
    error.value = userErrorMessage(cause);
  }
}
</script>

<template>
  <div class="app-frame">
    <a href="#main-content" class="skip-link">Zum Inhalt springen</a>
    <aside class="sidebar">
      <NuxtLink to="/" class="brand"
        ><span class="brand-mark">H</span><span>Haushaltsbuch<small>Privater Finanzplaner</small></span></NuxtLink
      >
      <nav aria-label="Hauptnavigation">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :class="{ active: link.to === '/' ? route.path === '/' : route.path.startsWith(link.to) }"
          :aria-current="(link.to === '/' ? route.path === '/' : route.path.startsWith(link.to)) ? 'page' : undefined"
          ><span aria-hidden="true">{{ link.icon }}</span
          >{{ link.label }}</NuxtLink
        >
      </nav>
      <div class="sidebar-bottom">
        <span class="private-dot" />Privater Arbeitsbereich<small>Heimnetz & VPN · EUR</small>
      </div>
    </aside>
    <div class="main-frame">
      <header class="topbar">
        <span class="workspace-label">Mein Haushaltsbuch</span>
        <div>
          <ThemeToggle />
          <span class="user-badge" :aria-label="`Angemeldet: ${api.session.value?.username}`">{{
            api.session.value?.username?.slice(0, 1).toUpperCase()
          }}</span>
          <UButton size="sm" variant="ghost" color="neutral" @click="logout">Abmelden</UButton>
        </div>
      </header>
      <main id="main-content" tabindex="-1" class="page-content">
        <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" /><slot />
      </main>
      <footer class="page-footer">Privat verwaltet · Daten bleiben auf deinem Server</footer>
    </div>
  </div>
</template>
