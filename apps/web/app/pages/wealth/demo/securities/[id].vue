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
  notice.value = tr('Demo-Auftrag gespeichert.');
}
</script>

<template>
  <UButton to="/wealth" variant="link">{{ tr('Zurück zu Vermögen') }}</UButton>
  <div class="page-heading">
    <h1>{{ security?.name ?? tr('Unbekanntes Demo-Wertpapier') }}</h1>
  </div>
  <p>{{ tr('Investment-Demo · Fiktives Wertpapier. Keine Live-Kurse und keine echten Aufträge.') }}</p>
  <p v-if="notice" role="status">{{ notice }}</p>
  <p v-if="status !== 'ready'" role="status">
    {{
      status === 'memory'
        ? tr('Nur im Arbeitsspeicher; Änderungen gehen beim Neuladen verloren.')
        : tr('Demo-Speicher prüfen. Bitte zur Vermögensseite zurückkehren.')
    }}
  </p>
  <template v-if="security">
    <div class="finance-feature-grid demo-security-grid">
      <FinanceTile
        :label="tr('Simulierter Stückpreis')"
        :value="money(demoPrice(state, security.id))"
        :context="tr('Fiktiver Basiskurs mit gespeichertem Demo-Szenario')"
        financial
      /><FinanceTile
        :label="tr('Demo-Szenario')"
        :value="tr('{0} Basispunkte', [state.scenarioBps])"
        :context="tr('100 Basispunkte = 1 %')"
      />
    </div>
    <SectionPanel :title="tr('Demo-Bestände')"
      ><div
        v-for="position in state.positions.filter((p) => p.securityId === security!.id)"
        :key="position.accountId"
        class="demo-holding"
      >
        <span>{{ state.accounts.find((a) => a.id === position.accountId)?.name }}</span
        ><strong>{{ position.quantity }} {{ tr('ganze Anteile') }}</strong
        ><span data-financial
          ><template v-if="!amountsMasked()">{{
            money(BigInt(position.quantity) * demoPrice(state, security.id))
          }}</template
          ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></span
        >
      </div>
      <p v-if="!state.positions.some((p) => p.securityId === security!.id)" class="demo-holding">
        {{ tr('Noch keine Demo-Anteile.') }}
      </p></SectionPanel
    >
    <UButton :disabled="saving || !['ready', 'memory'].includes(status)" @click="ordering = true">{{
      tr('Kauf / Verkauf simulieren')
    }}</UButton>
    <FinanceDialog
      v-model:open="ordering"
      :title="tr('Demo-Auftrag')"
      :description="tr('Kein echter Wertpapierauftrag.')"
      :dismissible="!saving"
      ><DemoOrderForm :security-id="security.id" @completed="completed" @cancel="ordering = false"
    /></FinanceDialog>
  </template>
  <UAlert v-else color="warning" :title="tr('Dieses Wertpapier gehört nicht zum Demo-Katalog.')" />
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
