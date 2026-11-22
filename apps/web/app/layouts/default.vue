<script setup lang="ts">
import { z } from 'zod';
import { useMediaQuery } from '@vueuse/core';
import { userErrorMessage } from '../utils/api-error';
const api = useApi();
const route = useRoute();
const error = ref('');
const accountMenuOpen = ref(false);
const hasExpandedNavigation = useMediaQuery('(min-width: 901px)');
const primaryLinks = [
  { to: '/', label: tr('Übersicht'), icon: 'home' },
  { to: '/transactions', label: tr('Umsätze'), icon: 'transactions' },
  { to: '/accounts', label: tr('Konten'), icon: 'accounts' },
  { to: '/analytics', label: tr('Analysen'), icon: 'categories' },
  { to: '/contracts', label: tr('Verträge'), icon: 'contracts' },
  { to: '/wealth', label: tr('Vermögen'), icon: 'wealth' },
] as const;
const expandedLinks = [
  { to: '/imports', label: tr('Importe'), icon: 'history' },
  { to: '/settings', label: tr('Einstellungen'), icon: 'settings' },
] as const;
const accountMenu = [
  { to: '/settings/profile', label: 'Persönliche Angaben' },
  { to: '/notifications', label: 'Benachrichtigungen' },
  { to: '/accounts/add', label: 'Banken & Konten hinzufügen' },
  { to: '/settings/users', label: 'Userverwaltung' },
] as const;
const secondaryLinks = [
  { to: '/notifications', label: tr('Benachrichtigungen'), icon: 'calendar' },
  { to: '/imports', label: tr('Importhistorie'), icon: 'history' },
  { to: '/connections', label: tr('Bankverbindungen'), icon: 'bank' },
  { to: '/settings', label: tr('Einstellungen'), icon: 'settings' },
] as const;
const currentPage = computed(
  /** Keep the toolbar anchored to the actual page. */ () =>
    [...primaryLinks, ...secondaryLinks].find(
      /** Exact import history must not shadow the upload route. */ (link) =>
        link.to === '/' ? route.path === '/' : route.path === link.to,
    )?.label ?? (route.path === '/more' ? tr('Mehr') : tr('Mein Haushaltsbuch')),
);
const moreActive = computed(
  /** Group secondary destinations unless they already have a visible desktop tab. */ () => {
    if (route.path === '/more') return true;
    const section = secondaryLinks.find(/** Find the current secondary destination. */ (link) => active(link.to));
    return (
      !!section &&
      !(
        hasExpandedNavigation.value &&
        expandedLinks.some(/** A visible tab owns its matching nested route. */ (link) => link.to === section.to)
      )
    );
  },
);
/** Match destination roots and their own detail routes. */
function active(path: string) {
  if (path === '/') return route.path === '/';
  if (path === '/analytics' && route.path === '/categories') return true;
  return route.path === path || route.path.startsWith(path + '/');
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
    <a href="#main-content" class="skip-link">{{ tr('Zum Inhalt springen') }}</a>
    <div class="main-frame">
      <header class="topbar">
        <span class="sr-only">{{ currentPage }}</span>
        <UButton
          variant="link"
          color="neutral"
          to="/"
          class="finance-brand"
          :aria-label="tr('Haushaltsbuch Startseite')"
          ><span class="brand-mark">H</span><strong>{{ tr('Haushaltsbuch') }}</strong></UButton
        >
        <div class="finance-tools">
          <FinanceDialog v-model:open="accountMenuOpen" :title="tr('Accountverwaltung')" panel="profile">
            <template #trigger>
              <UButton variant="ghost" color="neutral" class="finance-profile" :aria-label="tr('Accountverwaltung')">
                <span aria-hidden="true">{{ api.session.value?.username?.slice(0, 1).toUpperCase() }}</span>
              </UButton>
            </template>
            <div class="finance-account-menu">
              <UButton
                v-for="item in accountMenu"
                :key="item.to"
                :to="item.to"
                variant="outline"
                color="neutral"
                @click="accountMenuOpen = false"
                >{{ tr(item.label) }}</UButton
              >
            </div>
          </FinanceDialog>
          <ThemeToggle /><UButton
            size="sm"
            variant="ghost"
            color="neutral"
            class="logout-button"
            :aria-label="tr('Abmelden')"
            :title="tr('Abmelden')"
            @click="logout"
            ><FinanceIcon name="logout" /><span class="logout-label">{{ tr('Abmelden') }}</span></UButton
          >
        </div>
      </header>
      <nav class="finance-nav" :aria-label="tr('Hauptnavigation')">
        <UButton
          v-for="link in hasExpandedNavigation ? [...primaryLinks, ...expandedLinks] : primaryLinks"
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
          ><FinanceIcon name="more" /><span>{{ tr('Mehr') }}</span></UButton
        >
      </nav>
      <main id="main-content" tabindex="-1" class="page-content">
        <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" /><slot />
      </main>
    </div>
  </div>
</template>
