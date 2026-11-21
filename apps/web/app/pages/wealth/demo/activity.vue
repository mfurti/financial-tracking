<script setup lang="ts">
const { state, status } = useDemoPortfolio();
const visible = ref(50);
/** Display terms describe simulation events without implying real postings. */
const labels = {
  buy: tr('Demo-Kauf'),
  sell: tr('Demo-Verkauf'),
  transfer: tr('Demo-Umbuchung'),
  account: tr('Demo-Konto angelegt'),
  category: tr('Demo-Kategorie angelegt'),
  scenario: tr('Demo-Szenario geändert'),
  'plan-save': tr('Demo-Sparplan gespeichert'),
  'plan-delete': tr('Demo-Sparplan gelöscht'),
  'plan-execute': tr('Demo-Sparplan ausgeführt'),
  role: tr('Lokale Demo-Rolle geändert'),
};
const activities = computed(
  /** Latest explicit device actions appear first; this is not bank history. */ () =>
    state.value.activity.slice(-visible.value).reverse(),
);
/** Resolve the frozen synthetic order for one activity. */
function order(id: string) {
  return state.value.orders.find(/** Share the explicit command identity. */ (item) => item.id === id);
}
/** Resolve only a synthetic transfer endpoint for display. */
function accountName(id: string) {
  return (
    state.value.accounts.find(/** Match the retained synthetic reference. */ (account) => account.id === id)?.name ??
    tr('Demo-Konto')
  );
}
/** Format explicit timestamps in the project's calendar timezone. */
function time(at: string) {
  return new Intl.DateTimeFormat(displayLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(new Date(at));
}
</script>
<template>
  <UButton to="/wealth" variant="link">{{ tr('Zurück zu Vermögen') }}</UButton>
  <div class="page-heading">
    <h1>{{ tr('Demo-Aktivität') }}</h1>
  </div>
  <p>{{ tr('Ausdrücklich simulierte Aktionen auf diesem Gerät. Keine echten Buchungen oder Bankaufträge.') }}</p>
  <p v-if="status !== 'ready'" role="status">
    {{ tr('Demo-Speicherstatus prüfen; dies ist ausschließlich eine lokale Simulation.') }}
  </p>
  <SectionPanel :title="tr('Simulierte Transaktionen')"
    ><p v-if="!activities.length">{{ tr('Noch keine Demo-Aktivität.') }}</p>
    <article v-for="item in activities" :key="item.id" class="demo-activity">
      <div>
        <h3>{{ labels[item.kind] }}</h3>
        <time :datetime="item.at">{{ time(item.at) }}</time>
      </div>
      <p v-if="order(item.id)" data-financial>
        <template v-if="!amountsMasked()"
          >{{ order(item.id)!.quantity }} {{ tr('ganze Anteile ·') }}
          {{ money(BigInt(order(item.id)!.quantity) * BigInt(order(item.id)!.priceCents)) }}
          {{ tr('simulierter Auftragswert') }}</template
        ><template v-else>{{ tr('Betrag ausgeblendet') }}</template>
      </p>
      <p v-if="item.transfer" data-financial>
        <template v-if="!amountsMasked()"
          >{{ accountName(item.transfer.fromId) }} → {{ accountName(item.transfer.toId) }} ·
          {{ money(item.transfer.amountCents) }} {{ tr('simuliert') }}</template
        ><template v-else>{{ tr('Betrag ausgeblendet') }}</template>
      </p>
    </article></SectionPanel
  >
  <UButton v-if="visible < state.activity.length" variant="soft" @click="visible += 50">{{
    tr('Weitere Demo-Aktivität')
  }}</UButton>
</template>
<style scoped>
.demo-activity {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-block: 14px;
  border-bottom: 1px solid var(--line);
}
.demo-activity:last-child {
  border-bottom: 0;
}
time {
  color: var(--muted);
  font-size: 13px;
}
</style>
