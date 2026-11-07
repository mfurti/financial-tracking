<script setup lang="ts">
import { z } from 'zod';
import { userErrorMessage } from '../utils/api-error';
const api = useApi();
const route = useRoute();
const error = ref('');
const more = ref<HTMLDetailsElement | null>(null);
const primaryLinks = [
  { to: '/', label: 'Übersicht', icon: 'home' },
  { to: '/transactions', label: 'Umsätze', icon: 'transactions' },
  { to: '/categories', label: 'Kategorien', icon: 'categories' },
  { to: '/imports/csv', label: 'Importieren', icon: 'upload' },
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
    )?.label ?? 'Mein Haushaltsbuch',
);
/** Match nested ledger/detail routes without marking both import entries active. */
function active(path: string) {
  if (path === '/') return route.path === '/';
  if (path === '/imports') return route.path === '/imports';
  return route.path.startsWith(path);
}
/** Close the mobile disclosure and optionally return keyboard focus to its summary. */
function closeMore(event?: KeyboardEvent) {
  if (!more.value) return;
  more.value.open = false;
  if (event) more.value.querySelector('summary')?.focus();
}
/** Dismiss the mobile disclosure when a pointer lands outside it. */
function outside(event: PointerEvent) {
  if (more.value?.open && !more.value.contains(event.target as Node)) closeMore();
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
watch(
  /** Observe page changes, not query-only filter updates. */ () => route.path,
  /** A completed navigation dismisses the mobile menu. */ () => closeMore(),
);
onMounted(/** Register only a local UI pointer handler. */ () => document.addEventListener('pointerdown', outside));
onBeforeUnmount(/** Release the shell's UI listener. */ () => document.removeEventListener('pointerdown', outside));
</script>

<template>
  <div class="app-frame">
    <a href="#main-content" class="skip-link">Zum Inhalt springen</a>
    <aside class="sidebar">
      <NuxtLink to="/" class="brand"
        ><span class="brand-mark">H</span><span>Haushaltsbuch<small>Dein Geld. Dein Überblick.</small></span></NuxtLink
      >
      <p class="nav-heading">MEIN GELD</p>
      <nav aria-label="Hauptnavigation">
        <NuxtLink
          v-for="link in primaryLinks"
          :key="link.to"
          :to="link.to"
          :class="{ active: active(link.to) }"
          :aria-current="active(link.to) ? 'page' : undefined"
          ><FinanceIcon :name="link.icon" /><span>{{ link.label }}</span></NuxtLink
        >
      </nav>
      <p class="nav-heading">VERWALTEN</p>
      <nav aria-label="Verwaltung">
        <NuxtLink
          v-for="link in secondaryLinks"
          :key="link.to"
          :to="link.to"
          :class="{ active: active(link.to) }"
          :aria-current="active(link.to) ? 'page' : undefined"
          ><FinanceIcon :name="link.icon" /><span>{{ link.label }}</span></NuxtLink
        >
      </nav>
      <div class="sidebar-bottom">
        <span class="private-dot" />Dein privater Finanzbereich<small>Heimnetz & VPN · EUR</small>
      </div>
    </aside>
    <div class="main-frame">
      <header class="topbar">
        <span class="workspace-label">{{ currentPage }}</span>
        <NuxtLink to="/" class="mobile-brand" aria-label="Haushaltsbuch Startseite"
          ><span class="brand-mark">H</span><strong>Haushaltsbuch</strong></NuxtLink
        >
        <div>
          <ThemeToggle /><NuxtLink to="/settings" class="mobile-settings icon-button" aria-label="Einstellungen"
            ><FinanceIcon name="settings" /></NuxtLink
          ><span class="user-badge" :aria-label="`Angemeldet: ${api.session.value?.username}`">{{
            api.session.value?.username?.slice(0, 1).toUpperCase()
          }}</span
          ><UButton size="sm" variant="ghost" color="neutral" @click="logout">Abmelden</UButton>
        </div>
      </header>
      <main id="main-content" tabindex="-1" class="page-content">
        <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" /><slot />
      </main>
      <footer class="page-footer">Deine Buchungen. Deine Auswertung. Auf deinem privaten Server.</footer>
    </div>
    <nav class="mobile-nav" aria-label="Hauptnavigation">
      <NuxtLink
        v-for="link in primaryLinks"
        :key="link.to"
        :to="link.to"
        :class="{ active: active(link.to) }"
        :aria-current="active(link.to) ? 'page' : undefined"
        ><FinanceIcon :name="link.icon" /><span>{{ link.label }}</span></NuxtLink
      >
      <details ref="more" class="mobile-more" @keydown.esc="closeMore">
        <summary><FinanceIcon name="more" /><span>Mehr</span></summary>
        <nav aria-label="Weitere Seiten">
          <NuxtLink v-for="link in secondaryLinks" :key="link.to" :to="link.to"
            ><FinanceIcon :name="link.icon" />{{ link.label }}</NuxtLink
          >
        </nav>
      </details>
    </nav>
  </div>
</template>
