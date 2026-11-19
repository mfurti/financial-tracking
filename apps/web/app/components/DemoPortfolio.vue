<script setup lang="ts">
import { demoPrice, demoTotal } from '../utils/demo-finance';
const { state, status, saving, error, execute, reload } = useDemoPortfolio();
const ordering = ref(false);
const notice = ref('');
const scenario = ref(String(state.value.scenarioBps));
const total = computed(/** Synthetic aggregate is never added to recorded real wealth. */ () => demoTotal(state.value));
const cash = computed(
  /** Sum only the dedicated synthetic accounts. */ () =>
    state.value.accounts.reduce(
      /** Exact cash accumulation cannot lose cents. */ (sum, account) => sum + BigInt(account.cashCents),
      0n,
    ),
);
const blocked = computed(
  /** Recovery and ongoing commits disable conflicting mutation controls. */ () =>
    saving.value || !['ready', 'memory'].includes(status.value),
);
watch(
  /** Follow only committed scenario changes after reload or another simulation action. */ () =>
    state.value.scenarioBps,
  /** Keep the editable scenario aligned with confirmed state. */ (value) => {
    scenario.value = String(value);
  },
);

/** Present allocation basis points as a decimal percentage without converting money to Number. */
function allocation(cents: bigint) {
  const points = total.value === 0n ? 0n : (cents * 10000n) / total.value;
  return `${points / 100n},${String(points % 100n).padStart(2, '0')} %`;
}
/** Require integer basis points; invalid values keep the previous working synthetic valuation. */
async function applyScenario() {
  notice.value = '';
  if (!/^-?\d{1,4}$/.test(scenario.value) || Math.abs(Number(scenario.value)) > 3000) {
    notice.value = 'Ganze Basispunkte von -3000 bis 3000 eingeben.';
    return;
  }
  if (await execute({ kind: 'scenario', basisPoints: Number(scenario.value) }))
    notice.value = 'Demo-Szenario gespeichert. Keine echten Kurse verändert.';
}
/** Close only after a committed synthetic order and announce its isolated effect. */
function completed() {
  ordering.value = false;
  notice.value = 'Demo-Auftrag gespeichert. Echte Konten bleiben unverändert.';
}
</script>

<template>
  <section class="demo-portfolio" aria-labelledby="demo-portfolio-title" data-demo-portfolio>
    <header class="section-heading">
      <h2 id="demo-portfolio-title"><FinanceIcon name="history" />Investment-Demo</h2>
      <span class="demo-badge">Simulation</span>
    </header>
    <p class="demo-scope">
      Fiktive Konten und Wertpapiere auf diesem Gerät. Keine Bankverbindung, keine Live-Kurse, keine echten Aufträge.
    </p>
    <p v-if="status === 'memory'" role="status">
      Nur im Arbeitsspeicher: Änderungen gehen beim Neuladen verloren. Sichere lokale Speicherung ist nicht verfügbar.
    </p>
    <div v-else-if="status === 'conflict'" role="alert">
      <p>Demo-Daten wurden in einem anderen Tab geändert.</p>
      <UButton variant="soft" @click="reload">Demo neu laden</UButton>
    </div>
    <p v-else-if="status === 'corrupt' || status === 'unsupported'" role="alert">
      Demo-Speicher ist beschädigt oder seine Version wird nicht unterstützt. Die gespeicherten Daten bleiben erhalten;
      Aktionen sind gesperrt.
    </p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="error && !ordering" role="alert">{{ error }}</p>
    <div class="demo-summary">
      <FinanceTile
        label="Simuliertes Gesamtvermögen"
        :value="money(total)"
        context="Demo-Depot und Demo-Guthaben · getrennt von echten Beobachtungen"
        financial
      >
        <template #actions
          ><UButton :disabled="blocked" @click="ordering = true">Kauf / Verkauf simulieren</UButton></template
        >
      </FinanceTile>
      <SectionPanel title="Demo-Depotaufteilung">
        <div class="demo-allocation">
          <div class="finance-row">
            <span>Demo-Guthaben</span><strong data-financial>{{ money(cash) }} · {{ allocation(cash) }}</strong>
          </div>
          <div v-for="security in state.securities" :key="security.id" class="finance-row">
            <span>{{ security.name }}</span
            ><strong data-financial>{{
              allocation(
                state.positions
                  .filter((p) => p.securityId === security.id)
                  .reduce((sum, p) => sum + BigInt(p.quantity) * demoPrice(state, security.id), 0n),
              )
            }}</strong>
          </div>
        </div>
      </SectionPanel>
    </div>
    <SectionPanel title="Demo-Positionen und Katalog">
      <NuxtLink
        v-for="security in state.securities"
        :key="security.id"
        :to="`/wealth/demo/securities/${security.id}`"
        class="finance-row demo-security"
        ><span
          ><strong>{{ security.name }}</strong
          ><small
            >Fiktives Wertpapier ·
            {{
              state.positions
                .filter((p) => p.securityId === security.id)
                .reduce((sum, p) => sum + BigInt(p.quantity), 0n)
            }}
            ganze Anteile</small
          ></span
        ><strong data-financial
          >{{ money(demoPrice(state, security.id)) }} <span aria-hidden="true">›</span></strong
        ></NuxtLink
      >
    </SectionPanel>
    <div class="demo-summary">
      <SectionPanel title="Demo-Marktszenario">
        <form class="demo-scenario" @submit.prevent="applyScenario">
          <fieldset :disabled="blocked">
            <label
              >Simulierte Änderung in Basispunkten<input
                v-model="scenario"
                type="number"
                min="-3000"
                max="3000"
                step="1"
            /></label>
            <p>100 Basispunkte = 1 %. Bereich: −30 % bis +30 %. Ändert nur die Demo-Bewertung.</p>
            <UButton type="submit" :loading="saving">Demo-Szenario anwenden</UButton>
          </fieldset>
        </form>
      </SectionPanel>
      <SectionPanel title="Demo-Verrechnungskonten"
        ><div v-for="account in state.accounts" :key="account.id" class="finance-row">
          <span>{{ account.name }}</span
          ><strong data-financial>{{ money(account.cashCents) }}</strong>
        </div></SectionPanel
      >
    </div>
    <div class="demo-links">
      <UButton to="/wealth/demo/plans" variant="soft">Demo-Sparpläne</UButton
      ><UButton to="/wealth/demo/activity" variant="soft">Demo-Aktivität</UButton>
    </div>
    <DemoAccountActions />
    <DemoHistory />
    <DemoResetDialog />
    <FinanceDialog
      v-model:open="ordering"
      title="Demo-Auftrag"
      description="Kauf oder Verkauf ausschließlich mit fiktiven Werten."
      :dismissible="!saving"
      ><DemoOrderForm @completed="completed" @cancel="ordering = false"
    /></FinanceDialog>
  </section>
</template>

<style scoped>
.demo-portfolio {
  display: grid;
  gap: 20px;
  margin-top: 40px;
}
.demo-scope {
  color: var(--muted);
  max-width: 80ch;
}
.demo-badge {
  background: var(--accent-soft);
  color: var(--ink);
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}
.demo-summary {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.demo-summary > * {
  min-width: 0;
}
.demo-allocation .finance-row,
.demo-security,
.finance-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
}
.finance-row:last-child {
  border-bottom: 0;
}
.finance-row strong {
  overflow-wrap: anywhere;
}
.demo-security small {
  display: block;
  color: var(--muted);
  margin-top: 4px;
}
.demo-scenario {
  padding: 20px;
}
fieldset,
label {
  display: grid;
  gap: 12px;
  min-width: 0;
}
input {
  padding: 8px 12px;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--control-border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
}
@media (max-width: 1100px) {
  .demo-summary {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}
</style>
