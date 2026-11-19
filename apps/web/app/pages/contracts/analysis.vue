<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import { contractKinds } from '../../utils/contract-presentation';
const api = useApi();
const summary = ref<z.infer<typeof c.contractSummarySchema> | null>(null);
const grouping = ref<'category' | 'kind'>('category');
const selected = ref<string | null>(null);
const loading = ref(true);
const error = ref('');
let disposed = false;
let timer: ReturnType<typeof setInterval> | undefined;
const groups = computed(
  /** Both groupings sum exactly the same rounded contract costs. */ () =>
    summary.value ? (grouping.value === 'category' ? summary.value.categories : summary.value.kinds) : [],
);
const chart = computed(
  /** Reuse accessible Nuxt chart geometry without treating forecasts as actual expenditure. */ () =>
    groups.value.map(
      /** Preserve stable group identity on chart selections. */ (group) => ({
        categoryId: group.key,
        name: group.name,
        expenseCents: group.monthlyCents,
      }),
    ),
);
const contracts = computed(
  /** Drill into precisely the selected cost group, or all current contracts. */ () => {
    const ids = groups.value.find(
      /** Match the selected explicit group only. */ (group) => group.key === selected.value,
    )?.contractIds;
    return (summary.value?.contracts ?? []).filter(
      /** No transaction-derived category guessing. */ (contract) => !selected.value || ids?.includes(contract.id),
    );
  },
);
/** Read a fresh server-day snapshot without retaining stale success after an error. */
async function load() {
  loading.value = true;
  error.value = '';
  try {
    const result = await api.request('/contracts/summary', c.contractSummarySchema);
    if (!disposed) summary.value = result;
  } catch (cause) {
    if (!disposed) {
      summary.value = null;
      error.value = userErrorMessage(cause);
    }
  } finally {
    if (!disposed) loading.value = false;
  }
}
/** Calculate a display percentage from exact cents; never feed it back into money. */
function share(cents: string) {
  const total = BigInt(summary.value?.monthlyCents ?? '0');
  return total
    ? (Number((BigInt(cents) * 10000n) / total) / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })
    : '0';
}
watch(
  grouping,
  /** A category selection must not leak into the kind grouping. */ () => {
    selected.value = null;
  },
);
onMounted(
  /** Keep the active-day cost snapshot fresh without another contract write. */ async () => {
    await load();
    timer = setInterval(
      /** Hidden pages do not need automatic reads. */ () => {
        if (!document.hidden && !loading.value) void load();
      },
      60000,
    );
  },
);
onBeforeUnmount(
  /** Release owned timer and ignore late reads. */ () => {
    disposed = true;
    if (timer) clearInterval(timer);
  },
);
</script>

<template>
  <div class="page-heading">
    <h1>Vertragsanalyse</h1>
    <UButton to="/contracts" variant="soft">Alle Verträge</UButton>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" />
  <UButton v-if="error" @click="load">Erneut laden</UButton>
  <p v-if="loading" role="status">Fixkosten werden geladen …</p>
  <template v-if="summary && !loading">
    <SectionPanel
      title="Monatliche Fixkosten"
      icon="contracts"
      help="Planwert der heute gültigen bestätigten Verträge. Jahres- und Quartalszahlungen werden auf Monate verteilt und je Vertrag auf Cent gerundet. Zukünftige Verträge und Preisänderungen zählen noch nicht. Tatsächliche Ausgaben bleiben getrennt."
      class="mb-6"
    >
      <strong data-financial class="fixed-cost-value amount-expense">{{ money(summary.monthlyCents) }}</strong
      ><span class="muted"
        >{{ summary.count }} {{ summary.count === 1 ? 'Vertrag' : 'Verträge' }} · Planwert ·
        {{ calendarDate(summary.asOf) }}</span
      >
    </SectionPanel>
    <URadioGroup
      v-model="grouping"
      legend="Gruppieren nach"
      orientation="horizontal"
      variant="card"
      class="mb-6"
      :items="[
        { label: 'Kategorien', value: 'category' },
        { label: 'Vertragsarten', value: 'kind' },
      ]"
    />
    <div class="contract-analysis-grid">
      <SectionPanel title="Aufteilung" icon="categories">
        <ExpenseChart
          v-if="BigInt(summary.monthlyCents) > 0n"
          :groups="chart"
          :total-cents="summary.monthlyCents"
          label="Monatliche Fixkosten nach Gruppe"
          center-label="Planwert / Monat"
          description="Exakte monatliche Vertragskosten und Gruppen stehen in der Liste."
          @select="selected = $event"
        />
        <p v-if="!groups.length" class="empty-copy">Noch keine laufenden Verträge.</p>
        <UButton
          v-for="(group, index) in groups"
          :key="group.key"
          variant="link"
          color="neutral"
          class="contract-list-row"
          :aria-pressed="selected === group.key"
          @click="selected = selected === group.key ? null : group.key"
        >
          <span
            ><strong
              ><span
                class="category-dot"
                :style="{ background: `var(--chart-${(index % 6) + 1})` }"
                aria-hidden="true"
              />{{ group.name }}</strong
            ><small
              >{{ group.count }} {{ group.count === 1 ? 'Vertrag' : 'Verträge' }} ·
              {{ share(group.monthlyCents) }} %</small
            ></span
          ><strong data-financial class="amount-expense">{{ money(group.monthlyCents) }}</strong>
        </UButton>
      </SectionPanel>
      <SectionPanel
        :title="
          selected
            ? (groups.find(/** Resolve the exact selected group label. */ (group) => group.key === selected)?.name ??
              'Verträge')
            : 'Laufende Verträge'
        "
        icon="contracts"
      >
        <template v-if="selected" #actions
          ><UButton variant="ghost" @click="selected = null">Alle zeigen</UButton></template
        >
        <UButton
          v-for="contract in contracts"
          :key="contract.id"
          :to="`/contracts/${contract.id}`"
          variant="link"
          color="neutral"
          class="contract-list-row"
        >
          <span class="contract-identity"
            ><span class="contract-kind-icon" :style="{ '--kind-color': contractKinds[contract.kind].color }"
              ><FinanceIcon :name="contractKinds[contract.kind].icon" /></span
            ><span
              ><strong>{{ contract.name }}</strong
              ><small>{{ money(contract.amountCents) }} · alle {{ contract.intervalMonths }} Monate</small></span
            ></span
          ><span
            ><strong class="amount-expense">{{ money(contract.monthlyCents) }}</strong
            ><small>/ Monat</small></span
          >
        </UButton>
        <UButton v-if="!summary.count" to="/contracts" variant="soft">Vertrag anlegen</UButton>
      </SectionPanel>
    </div>
  </template>
</template>

<style scoped>
.contract-analysis-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  align-items: start;
  gap: 24px;
}
.contract-analysis-grid > * {
  min-width: 0;
}
@media (max-width: 1100px) {
  .contract-analysis-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}
</style>
