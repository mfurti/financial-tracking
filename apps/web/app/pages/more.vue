<script setup lang="ts">
const links = [
  { to: '/accounts', label: 'Konten', icon: 'accounts' },
  { to: '/imports', label: 'Importhistorie', icon: 'history' },
  { to: '/connections', label: 'Bankverbindungen', icon: 'bank' },
  { to: '/settings', label: 'Einstellungen', icon: 'settings' },
] as const;
</script>

<template>
  <div class="page-heading"><h1>Mehr</h1></div>
  <nav class="management-grid" aria-label="Weitere Seiten">
    <UButton
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      color="neutral"
      variant="outline"
      class="management-tile"
      ><FinanceIcon :name="link.icon" /><span>{{ link.label }}</span
      ><span aria-hidden="true">›</span></UButton
    >
  </nav>
</template>
