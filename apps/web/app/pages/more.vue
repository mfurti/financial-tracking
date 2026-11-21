<script setup lang="ts">
const links = [
  { to: '/notifications', label: tr('Benachrichtigungen'), icon: 'calendar' },
  { to: '/accounts', label: tr('Konten'), icon: 'accounts' },
  { to: '/wealth', label: tr('Vermögen'), icon: 'history' },
  { to: '/imports', label: tr('Importhistorie'), icon: 'history' },
  { to: '/connections', label: tr('Bankverbindungen'), icon: 'bank' },
  { to: '/settings', label: tr('Einstellungen'), icon: 'settings' },
] as const;
</script>

<template>
  <div class="page-heading">
    <h1>{{ tr('Mehr') }}</h1>
  </div>
  <SectionPanel :title="tr('Verwalten')" icon="settings">
    <nav class="finance-management" :aria-label="tr('Weitere Seiten')">
      <UButton
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        color="neutral"
        variant="link"
        class="finance-management-row"
        ><FinanceIcon :name="link.icon" /><span>{{ link.label }}</span
        ><span aria-hidden="true">›</span></UButton
      >
    </nav>
  </SectionPanel>
</template>
