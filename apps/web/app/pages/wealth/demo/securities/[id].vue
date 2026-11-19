<script setup lang="ts">
import { demoPrice } from '../../../../utils/demo-finance';
const route = useRoute();
const { state, status, saving } = useDemoPortfolio();
const security = computed(
  /** Allow only the validated synthetic catalog, never an arbitrary security or real identifier. */ () =>
    state.value.securities.find(
      /** Match the literal synthetic route identity. */ (item) => item.id === route.params.id,
    ),
);
const ordering = ref(false);
const notice = ref('');
/** Announce a successful isolated order while restoring the trigger's dialog focus. */
function completed() {
  ordering.value = false;
  notice.value = 'Demo-Auftrag gespeichert.';
}
</script>

<template>
  <UButton to="/wealth" variant="link">Zurück zu Vermögen</UButton>
  <div class="page-heading">
    <h1>{{ security?.name ?? 'Unbekanntes Demo-Wertpapier' }}</h1>
  </div>
  <p>Investment-Demo · Fiktives Wertpapier. Keine Live-Kurse und keine echten Aufträge.</p>
  <p v-if="notice" role="status">{{ notice }}</p>
  <p v-if="status !== 'ready'" role="status">
    {{
      status === 'memory'
        ? 'Nur im Arbeitsspeicher; Änderungen gehen beim Neuladen verloren.'
        : 'Demo-Speicher prüfen. Bitte zur Vermögensseite zurückkehren.'
    }}
  </p>
  <template v-if="security">
    <div class="finance-feature-grid demo-security-grid">
      <FinanceTile
        label="Simulierter Stückpreis"
        :value="money(demoPrice(state, security.id))"
        context="Fiktiver Basiskurs mit gespeichertem Demo-Szenario"
        financial
      /><FinanceTile
        label="Demo-Szenario"
        :value="`${state.scenarioBps} Basispunkte`"
        context="100 Basispunkte = 1 %"
      />
    </div>
    <SectionPanel title="Demo-Bestände"
      ><div
        v-for="position in state.positions.filter((p) => p.securityId === security!.id)"
        :key="position.accountId"
        class="demo-holding"
      >
        <span>{{ state.accounts.find((a) => a.id === position.accountId)?.name }}</span
        ><strong>{{ position.quantity }} ganze Anteile</strong
        ><span data-financial>{{ money(BigInt(position.quantity) * demoPrice(state, security.id)) }}</span>
      </div>
      <p v-if="!state.positions.some((p) => p.securityId === security!.id)" class="demo-holding">
        Noch keine Demo-Anteile.
      </p></SectionPanel
    >
    <UButton :disabled="saving || !['ready', 'memory'].includes(status)" @click="ordering = true"
      >Kauf / Verkauf simulieren</UButton
    >
    <FinanceDialog
      v-model:open="ordering"
      title="Demo-Auftrag"
      description="Kein echter Wertpapierauftrag."
      :dismissible="!saving"
      ><DemoOrderForm :security-id="security.id" @completed="completed" @cancel="ordering = false"
    /></FinanceDialog>
  </template>
  <UAlert v-else color="warning" title="Dieses Wertpapier gehört nicht zum Demo-Katalog." />
</template>

<style scoped>
.demo-security-grid {
  margin: 24px 0;
}
.demo-holding {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}
</style>
