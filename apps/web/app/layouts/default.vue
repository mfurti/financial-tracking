<script setup lang="ts">
import { z } from 'zod';
import { userErrorMessage } from '../utils/api-error';
const api = useApi();
const route = useRoute();
const error = ref('');
const primaryLinks = [
  { to: '/', label: 'Übersicht', icon: 'home' },
  { to: '/transactions', label: 'Umsätze', icon: 'transactions' },
  { to: '/accounts', label: 'Konten', icon: 'accounts' },
  { to: '/analytics', label: 'Analysen', icon: 'categories' },
  { to: '/contracts', label: 'Verträge', icon: 'contracts' },
] as const;
const secondaryLinks = [
  { to: '/wealth', label: 'Vermögen', icon: 'history' },
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
const moreActive = computed(
  /** Preserve the management section marker on its nested forms and import upload. */ () =>
    route.path === '/more' ||
    route.path.startsWith('/imports/') ||
    secondaryLinks.some(/** Mark the management destination on its child pages. */ (link) => active(link.to)),
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
  <div class="app-frame finance-shell">
    <a href="#main-content" class="skip-link">Zum Inhalt springen</a>
    <div class="main-frame">
      <header class="topbar">
        <span class="sr-only">{{ currentPage }}</span>
        <UButton variant="link" color="neutral" to="/" class="finance-brand" aria-label="Haushaltsbuch Startseite"
          ><span class="brand-mark">H</span><strong>Haushaltsbuch</strong></UButton
        >
        <div class="finance-tools">
          <UButton
            variant="ghost"
            color="neutral"
            to="/settings"
            class="finance-profile"
            aria-label="Einstellungen"
            :title="`Angemeldet: ${api.session.value?.username}`"
            ><span aria-hidden="true">{{ api.session.value?.username?.slice(0, 1).toUpperCase() }}</span></UButton
          ><ThemeToggle /><UButton
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
    </div>
    <nav class="finance-nav" aria-label="Hauptnavigation">
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
        :class="{ active: moreActive }"
        :aria-current="moreActive ? 'page' : undefined"
        ><FinanceIcon name="more" /><span>Mehr</span></UButton
      >
    </nav>
  </div>
</template>
