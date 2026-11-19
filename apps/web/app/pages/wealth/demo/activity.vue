<script setup lang="ts">
const { state, status } = useDemoPortfolio();
const visible = ref(50);
/** Display terms describe simulation events without implying real postings. */
const labels = {
  buy: 'Demo-Kauf',
  sell: 'Demo-Verkauf',
  transfer: 'Demo-Umbuchung',
  account: 'Demo-Konto angelegt',
  category: 'Demo-Kategorie angelegt',
  scenario: 'Demo-Szenario geändert',
  'plan-save': 'Demo-Sparplan gespeichert',
  'plan-delete': 'Demo-Sparplan gelöscht',
  'plan-execute': 'Demo-Sparplan ausgeführt',
  role: 'Lokale Demo-Rolle geändert',
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
    'Demo-Konto'
  );
}
/** Format explicit timestamps in the project's calendar timezone. */
function time(at: string) {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(new Date(at));
}
</script>
<template>
  <UButton to="/wealth" variant="link">Zurück zu Vermögen</UButton>
  <div class="page-heading"><h1>Demo-Aktivität</h1></div>
  <p>Ausdrücklich simulierte Aktionen auf diesem Gerät. Keine echten Buchungen oder Bankaufträge.</p>
  <p v-if="status !== 'ready'" role="status">
    Demo-Speicherstatus prüfen; dies ist ausschließlich eine lokale Simulation.
  </p>
  <SectionPanel title="Simulierte Transaktionen"
    ><p v-if="!activities.length">Noch keine Demo-Aktivität.</p>
    <article v-for="item in activities" :key="item.id" class="demo-activity">
      <div>
        <h3>{{ labels[item.kind] }}</h3>
        <time :datetime="item.at">{{ time(item.at) }}</time>
      </div>
      <p v-if="order(item.id)" data-financial>
        {{ order(item.id)!.quantity }} ganze Anteile ·
        {{ money(BigInt(order(item.id)!.quantity) * BigInt(order(item.id)!.priceCents)) }} simulierter Auftragswert
      </p>
      <p v-if="item.transfer" data-financial>
        {{ accountName(item.transfer.fromId) }} → {{ accountName(item.transfer.toId) }} ·
        {{ money(item.transfer.amountCents) }} simuliert
      </p>
    </article></SectionPanel
  >
  <UButton v-if="visible < state.activity.length" variant="soft" @click="visible += 50">Weitere Demo-Aktivität</UButton>
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
