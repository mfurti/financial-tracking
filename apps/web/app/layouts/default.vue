<script setup lang="ts">
import { z } from 'zod';
import { userErrorMessage } from '../utils/api-error';
const api = useApi();
const route = useRoute();
const error = ref('');
const primaryLinks = [
  { to: '/', label: 'Übersicht', icon: 'home' },
  { to: '/transactions', label: 'Umsätze', icon: 'transactions' },
  { to: '/analytics', label: 'Analysen', icon: 'categories' },
  { to: '/contracts', label: 'Verträge', icon: 'contracts' },
] as const;
const secondaryLinks = [
  { to: '/accounts', label: 'Konten', icon: 'accounts' },
  { to: '/imports', label: 'Importhistorie', icon: 'history' },
  { to: '/connections', label: 'Bankverbindungen', icon: 'bank' },
  { to: '/settings', label: 'Einstellungen', icon: 'settings' },
] as const;
const currentPage = computed(
  /** Keep the toolbar anchored to the actual page. */ () =>
    [...primaryLinks, ...secondaryLinks].find(
      /** Exact import history must not shadow the upload route. */ (link) =>
        link.to === '/' ? route.path === '/' : route.path === link.to,
    )?.label ?? (route.path === '/more' ? 'Mehr' : 'Mein Haushaltsbuch'),
);
/** Match nested ledger/detail routes without marking both import entries active. */
function active(path: string) {
  if (path === '/') return route.path === '/';
  if (path === '/analytics') return route.path.startsWith('/analytics') || route.path.startsWith('/categories');
  if (path === '/imports') return route.path === '/imports';
  return route.path.startsWith(path);
}
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
      <UButton variant="link" color="neutral" to="/" class="brand"
        ><span class="brand-mark">H</span><span>Haushaltsbuch<small>Dein Geld. Dein Überblick.</small></span></UButton
      >
      <p class="nav-heading">MEIN GELD</p>
      <nav aria-label="Hauptnavigation">
        <UButton
          v-for="link in primaryLinks"
          :key="link.to"
          variant="link"
          color="neutral"
          :to="link.to"
          :class="{ active: active(link.to) }"
          :aria-current="active(link.to) ? 'page' : undefined"
          ><FinanceIcon :name="link.icon" /><span>{{ link.label }}</span></UButton
        >
      </nav>
      <div class="desktop-more">
        <p class="nav-group-label">Verwaltung</p>
        <nav aria-label="Verwaltung">
          <UButton
            v-for="link in secondaryLinks"
            :key="link.to"
            variant="link"
            color="neutral"
            :to="link.to"
            :class="{ active: active(link.to) }"
            :aria-current="active(link.to) ? 'page' : undefined"
            ><FinanceIcon :name="link.icon" /><span>{{ link.label }}</span></UButton
          >
        </nav>
      </div>
      <div class="sidebar-bottom">
        <span class="private-dot" />Dein privater Finanzbereich<small>Heimnetz & VPN · EUR</small>
      </div>
    </aside>
    <div class="main-frame">
      <header class="topbar">
        <span class="workspace-label">{{ currentPage }}</span>
        <UButton variant="link" color="neutral" to="/" class="mobile-brand" aria-label="Haushaltsbuch Startseite"
          ><span class="brand-mark">H</span><strong>Haushaltsbuch</strong></UButton
        >
        <div>
          <ThemeToggle /><UButton
            variant="link"
            color="neutral"
            to="/settings"
            class="mobile-settings icon-button"
            aria-label="Einstellungen"
            ><FinanceIcon name="settings" /></UButton
          ><span class="user-badge" :aria-label="`Angemeldet: ${api.session.value?.username}`">{{
            api.session.value?.username?.slice(0, 1).toUpperCase()
          }}</span
          ><UButton
            size="sm"
            variant="ghost"
            color="neutral"
            class="logout-button"
            aria-label="Abmelden"
            title="Abmelden"
            @click="logout"
            ><FinanceIcon name="logout" /><span class="logout-label">Abmelden</span></UButton
          >
        </div>
      </header>
      <main id="main-content" tabindex="-1" class="page-content">
        <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" /><slot />
      </main>
      <footer class="page-footer">Deine Buchungen. Deine Auswertung. Auf deinem privaten Server.</footer>
    </div>
    <nav class="mobile-nav" aria-label="Hauptnavigation">
      <UButton
        v-for="link in primaryLinks"
        :key="link.to"
        variant="link"
        color="neutral"
        :to="link.to"
        :class="{ active: active(link.to) }"
        :aria-current="active(link.to) ? 'page' : undefined"
        ><FinanceIcon :name="link.icon" /><span>{{ link.label }}</span></UButton
      >
      <UButton
        to="/more"
        variant="link"
        color="neutral"
        :class="{
          active:
            route.path === '/more' ||
            secondaryLinks.some(/** Mark the management destination on its child pages. */ (link) => active(link.to)),
        }"
        :aria-current="route.path === '/more' ? 'page' : undefined"
        ><FinanceIcon name="more" /><span>Mehr</span></UButton
      >
    </nav>
  </div>
</template>
