<script setup lang="ts">
const groups = [
  {
    title: 'Mein Geld',
    links: [
      { to: '/accounts', label: 'Konten', icon: 'accounts', context: 'Giro, Sparen, Tagesgeld & Festgeld' },
      { to: '/wealth', label: 'Scalable', icon: 'wealth', context: 'Depot, Guthaben & Sparpläne' },
    ],
  },
  {
    title: 'Verwalten',
    links: [
      { to: '/imports', label: 'Importe', icon: 'history' },
      { to: '/connections', label: 'Bankverbindungen', icon: 'bank' },
      { to: '/categories', label: 'Kategorien & Regeln', icon: 'categories' },
      { to: '/settings', label: 'Einstellungen', icon: 'settings' },
    ],
  },
] as const;
</script>

<template>
  <div class="page-heading finance-more-heading">
    <h1>{{ tr('Mehr') }}</h1>
  </div>
  <div class="finance-more-grid">
    <SectionPanel v-for="group in groups" :key="group.title" :title="tr(group.title)">
      <nav class="finance-management" :aria-label="tr(group.title)">
        <UButton
          v-for="link in group.links"
          :key="link.to"
          :to="link.to"
          color="neutral"
          variant="link"
          class="finance-management-row"
          :class="{ 'finance-management-row--identity': 'context' in link }"
          ><FinanceIcon v-if="'context' in link" :name="link.icon" /><span
            >{{ tr(link.label) }}<small v-if="'context' in link">{{ tr(link.context) }}</small></span
          ><span aria-hidden="true">›</span></UButton
        >
      </nav>
    </SectionPanel>
  </div>
</template>
