<script setup lang="ts">
import { z } from 'zod';
import { userErrorMessage } from '../utils/api-error';
const api = useApi();
const route = useRoute();
const popup = useFinancePopup();
const displayedRoute = computed(() => popup?.background.value ?? route);
const error = ref('');
const accountMenuOpen = ref(false);
const primaryLinks = [
  { to: '/', label: tr('Übersicht'), icon: 'home' },
  { to: '/transactions', label: tr('Umsätze'), icon: 'transactions' },
  { to: '/accounts', label: tr('Konten'), icon: 'accounts' },
  { to: '/analytics', label: tr('Analysen'), icon: 'categories' },
  { to: '/contracts', label: tr('Verträge'), icon: 'contracts' },
  { to: '/wealth', label: tr('Vermögen'), icon: 'wealth' },
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
        link.to === '/' ? displayedRoute.value.path === '/' : displayedRoute.value.path === link.to,
    )?.label ?? (displayedRoute.value.path === '/more' ? tr('Mehr') : tr('Mein Haushaltsbuch')),
);
const moreActive = computed(
  /** Preserve the management section marker on its nested forms and import upload. */ () =>
    displayedRoute.value.path === '/more' ||
    displayedRoute.value.path.startsWith('/imports/') ||
    secondaryLinks.some(/** Mark the management destination on its child pages. */ (link) => active(link.to)),
);
/** Match nested ledger/detail routes without marking both import entries active. */
function active(path: string) {
  const displayed = displayedRoute.value.path;
  if (path === '/') return displayed === '/';
  if (path === '/analytics') return displayed.startsWith('/analytics') || displayed.startsWith('/categories');
  if (path === '/imports') return displayed === '/imports';
  return displayed.startsWith(path);
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
      <main id="main-content" tabindex="-1" class="page-content">
        <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" /><slot />
      </main>
    </div>
    <nav class="finance-nav" :aria-label="tr('Hauptnavigation')">
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
        ><FinanceIcon name="more" /><span>{{ tr('Mehr') }}</span></UButton
      >
    </nav>
  </div>
</template>
