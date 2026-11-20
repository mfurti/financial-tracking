<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import type { AnalysisModuleId } from '../../utils/workspace-preferences';
const api = useApi();
const route = useRoute();
const router = useRouter();
const { preferences, updatePreferences } = useWorkspacePreferences();
const availableModules: readonly AnalysisModuleId[] = [
  'months',
  'categories',
  'merchants',
  'history',
  'reserve',
  'contracts',
];
/** Delivered global modules retain their own state without masking a valid scoped transaction report. */
type WorkspaceModule = 'history' | 'reserve' | 'contracts';
const moduleState = reactive<Record<WorkspaceModule, 'loading' | 'ready' | 'error'>>({
  history: 'loading',
  reserve: 'loading',
  contracts: 'loading',
});
const moduleErrors = reactive<Record<WorkspaceModule, string>>({ history: '', reserve: '', contracts: '' });
const moduleGeneration: Record<WorkspaceModule, number> = { history: 0, reserve: 0, contracts: 0 };
const reserve = ref<z.infer<typeof c.reserveGoalSchema> | null>(null);
const wealth = ref<z.infer<typeof c.wealthRecordsSchema> | null>(null);
const contractCosts = ref<z.infer<typeof c.contractSummarySchema> | null>(null);
const latestWealth = computed(
  /** Show only a real saved observation, never the live preview as historical wealth. */ () => wealth.value?.items[0],
);
const latestWealthKnown = computed(
  /** An all-unknown partial record must not appear as an observed zero. */ () =>
    latestWealth.value?.components.some(
      /** Explicit zero/negative components are real observations. */ (item) => item.amountCents !== null,
    ) ?? false,
);
const reserveStale = computed(
  /** Preserve freshness disclosure on the compact global reserve tile. */ () =>
    reserve.value?.components.filter(/** Count only observed sources marked stale. */ (item) => item.stale).length ?? 0,
);
let disposed = false;
/** Read each delivered workspace module independently; these values explicitly ignore transaction-report filters. */
async function loadWorkspaceModule(id: WorkspaceModule) {
  const request = ++moduleGeneration[id];
  moduleState[id] = 'loading';
  moduleErrors[id] = '';
  try {
    if (id === 'reserve') {
      const value = await api.request('/reserve-goal', c.reserveGoalSchema);
      if (disposed || request !== moduleGeneration[id]) return;
      reserve.value = value;
    } else if (id === 'history') {
      const value = await api.request('/wealth-records', c.wealthRecordsSchema, { query: { limit: 1 } });
      if (disposed || request !== moduleGeneration[id]) return;
      wealth.value = value;
    } else {
      const value = await api.request('/contracts/summary', c.contractSummarySchema);
      if (disposed || request !== moduleGeneration[id]) return;
      contractCosts.value = value;
    }
    moduleState[id] = 'ready';
  } catch (cause) {
    if (!disposed && request === moduleGeneration[id]) {
      moduleState[id] = 'error';
      moduleErrors[id] = userErrorMessage(cause);
    }
  }
}
const appliedFilters = ref<z.infer<typeof c.analyticsOverviewQuerySchema>>({});
const report = ref<z.infer<typeof c.analyticsOverviewSchema> | null>(null);
const merchants = ref<z.infer<typeof c.merchantAnalyticsSchema> | null>(null);
const accounts = ref<c.Account[]>([]);
const categories = ref<c.Category[]>([]);
const from = ref(String(route.query.from ?? ''));
const to = ref(String(route.query.to ?? ''));
const accountId = ref(route.query.unassigned === 'true' ? 'UNASSIGNED' : String(route.query.accountId ?? ''));
const groupId = ref(String(route.query.groupId ?? ''));
const categoryId = ref(route.query.uncategorized === 'true' ? 'UNCATEGORIZED' : String(route.query.categoryId ?? ''));
const error = ref('');
const busy = ref(true);
const latestMonth = computed(
  /** Review the actual final selected month, including explicitly disclosed empty or partial periods. */ () =>
    report.value?.months.at(-1),
);
const trendLink = computed(
  /** Link the shown trend to its actual latest eligible calendar month, excluding later incomplete observations. */ () => {
    const month = report.value?.months.find(
      /** Resolve the exact report-owned range rather than using input drafts. */ (row) =>
        row.month === report.value?.trend?.month,
    );
    return month ? link({ from: month.from, to: month.to, direction: 'EXPENSE' }) : undefined;
  },
);
let generation = 0;
const reasons: Record<string, string> = {
  NO_DATA: tr('Keine Buchungen'),
  CURRENT: tr('Laufender Monat'),
  FUTURE: tr('Zukünftiger Monat'),
  PARTIAL: tr('Nur teilweise ausgewählt'),
};
const classificationLabels = { FIXED: tr('Fix'), VARIABLE: tr('Variabel'), UNCLASSIFIED: tr('Nicht eingeordnet') };
const navigation = [
  { label: tr('Analysen'), to: '/analytics', exact: true },
  { label: tr('Kategorien & Regeln'), to: '/categories' },
];
/** Read exactly the chosen range/identity filters for both report and drill-down. */
function filters() {
  return c.analyticsOverviewQuerySchema.parse({
    from: from.value || undefined,
    to: to.value || undefined,
    accountId: accountId.value && accountId.value !== 'UNASSIGNED' ? accountId.value : undefined,
    groupId: groupId.value || undefined,
    unassigned: accountId.value === 'UNASSIGNED' ? 'true' : undefined,
    categoryId: categoryId.value && categoryId.value !== 'UNCATEGORIZED' ? categoryId.value : undefined,
    uncategorized: categoryId.value === 'UNCATEGORIZED' ? 'true' : undefined,
  });
}
/** Load current exact results and discard stale responses after a filter change. */
async function load() {
  const current = ++generation;
  busy.value = true;
  error.value = '';
  report.value = null;
  merchants.value = null;
  try {
    const input = filters();
    const [result, availableAccounts, availableCategories, merchantReport] = await Promise.all([
      api.request('/analytics/overview', c.analyticsOverviewSchema, { query: input }),
      api.request('/accounts', z.array(c.accountSchema)),
      api.request('/categories', z.array(c.categorySchema)),
      api.request('/analytics/merchants', c.merchantAnalyticsSchema, { query: input }),
    ]);
    if (current !== generation) return;
    report.value = result;
    merchants.value = merchantReport;
    appliedFilters.value = input;
    from.value = result.from;
    to.value = result.to;
    accounts.value = availableAccounts;
    categories.value = availableCategories;
  } catch (cause) {
    if (current === generation) error.value = userErrorMessage(cause);
  } finally {
    if (current === generation) busy.value = false;
  }
}
/** Preserve an explicit chosen window in the URL before reading it. */
async function apply() {
  try {
    await router.replace({ query: filters() });
    await load();
  } catch (cause) {
    error.value = userErrorMessage(cause);
  }
}
/** Select only completed Berlin calendar months, including visible months without data. */
async function preset(count: number) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  const end = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
  end.setUTCDate(0);
  const start = new Date(`${end.toISOString().slice(0, 7)}-01T12:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - count + 1);
  from.value = start.toISOString().slice(0, 10);
  to.value = end.toISOString().slice(0, 10);
  await apply();
}
/** Build transaction links from displayed report values, never stale input drafts. */
function link(extra: Record<string, string> = {}) {
  if (!report.value) return '/transactions';
  const source: Record<string, string> = {
    from: report.value.from,
    to: report.value.to,
    status: 'BOOKED',
    excludeTransfers: 'true',
  };
  if (appliedFilters.value.unassigned === 'true') source.unassigned = 'true';
  else if (appliedFilters.value.accountId) source.accountId = appliedFilters.value.accountId;
  else if (appliedFilters.value.groupId) source.groupId = appliedFilters.value.groupId;
  if (appliedFilters.value.uncategorized === 'true') source.uncategorized = 'true';
  else if (appliedFilters.value.categoryId) source.categoryId = appliedFilters.value.categoryId;
  return `/transactions?${new URLSearchParams({ ...source, ...extra })}`;
}
/** Category selection retains the current range/account and selects precisely one expense group. */
function categoryLink(id: string | null) {
  const params = new URLSearchParams(link({ direction: 'EXPENSE' }).split('?')[1]);
  if (id) {
    params.set('categoryId', id);
    params.delete('uncategorized');
  } else {
    params.delete('categoryId');
    params.set('uncategorized', 'true');
  }
  return `/analytics/details?${params}`;
}
/** Preserve the displayed effective period and all account/category scope when opening an exact merchant. */
function merchantLink(key: string) {
  return link({ merchantKey: key, direction: 'EXPENSE' }).replace('/transactions?', '/analytics/details?');
}
/** Navigate to delivered chart/list content without losing the displayed report's effective scope. */
function analysisAnchor(id: string) {
  if (!report.value) return '/analytics';
  const params = new URLSearchParams({ from: report.value.from, to: report.value.to });
  for (const [key, value] of Object.entries(appliedFilters.value)) if (value !== undefined) params.set(key, value);
  return `/analytics?${params}#${id}`;
}
/** A selected chart month/direction opens that month's contributing actual transactions. */
async function monthSelect(month: string, direction: 'INCOME' | 'EXPENSE') {
  const row = report.value?.months.find(
    /** Use inclusive clipped boundaries from the report. */ (entry) => entry.month === month,
  );
  if (row) await navigateTo(link({ from: row.from, to: row.to, direction }));
}
onMounted(
  /** Scoped reports and global modules load independently; one optional failure never hides valid actual totals. */ () => {
    void load();
    for (const id of ['history', 'reserve', 'contracts'] as const) void loadWorkspaceModule(id);
  },
);
onBeforeUnmount(
  /** Invalidate outstanding reads when leaving analyses. */ () => {
    generation++;
    disposed = true;
    for (const id of ['history', 'reserve', 'contracts'] as const) moduleGeneration[id]++;
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>{{ tr('Analysen') }}</h1>
    </div>
    <div class="toolbar">
      <HelpPopover
        :title="tr('So liest du diese Zahlen')"
        :text="
          tr(
            'Gebuchte Umsätze einschließlich Ohne Konto zählen. Umbuchungen und Vormerkungen sind ausgeschlossen. Erstattungen sind Einnahmen. Durchschnitte berücksichtigen vollständig ausgewählte, abgeschlossene Monate mit Buchungen; vorhandene Daten beweisen keine vollständige Bankhistorie.',
          )
        "
      /><UButton to="/imports/csv">{{ tr('CSV importieren') }}</UButton>
    </div>
  </div>
  <UNavigationMenu :items="navigation" class="mb-5" :aria-label="tr('Analysebereiche')" />
  <section class="panel mb-5">
    <div class="toolbar mb-4">
      <UButton
        v-for="count in [3, 6, 12]"
        :key="count"
        color="neutral"
        variant="outline"
        :disabled="busy"
        @click="preset(count)"
        >{{ count }} {{ tr('Monate') }}</UButton
      >
    </div>
    <HelpPopover
      :title="tr('Zeitraum')"
      :text="
        tr(
          'Schnellwahl: abgeschlossene Monate. Eigener Zeitraum: maximal 36 Monate. Laufende Monate zählen zu den Summen, aber nicht zum Durchschnitt.',
        )
      "
      class="mb-4"
    />
    <form class="filter-grid" @submit.prevent="apply">
      <UFormField :label="tr('Zeitraum von')"><DatePicker v-model="from" :label="tr('Zeitraum von')" /></UFormField
      ><UFormField :label="tr('Zeitraum bis')"><DatePicker v-model="to" :label="tr('Zeitraum bis')" /></UFormField
      ><UFormField :label="tr('Konto')"
        ><!-- Filter real account identities only. --><AccountScopeSelect
          v-model:account-id="accountId"
          v-model:group-id="groupId"
          :accounts="accounts" /></UFormField
      ><UFormField :label="tr('Kategorie')"
        ><ChoiceSelect
          v-model="categoryId"
          :items="[
            { label: tr('Alle Kategorien'), value: '' },
            { label: tr('Nicht kategorisiert'), value: 'UNCATEGORIZED' },
            ...categories.map(
              /** Existing category IDs drive both report and transactions. */ (category) => ({
                label: category.name,
                value: category.id,
              }),
            ),
          ]" /></UFormField
      ><UButton type="submit" :loading="busy">{{ tr('Auswertung anzeigen') }}</UButton>
    </form>
  </section>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <p v-if="busy" role="status">{{ tr('Auswertung wird geladen …') }}</p>
  <template v-if="report && !busy">
    <div class="finance-analysis-hub">
      <SectionPanel :title="tr('Monatsrückblick')" icon="calendar" class="finance-analysis-top" :bare="true">
        <FinanceTile
          v-if="latestMonth"
          :label="monthName(latestMonth.month)"
          :value="money(latestMonth.expenseCents)"
          financial
          :context="
            tr('Ausgegeben · {0} Buchungen · {1}', [
              latestMonth.count,
              latestMonth.averageEligible ? tr('Abgeschlossener Monat') : reasons[latestMonth.excludedReason!],
            ])
          "
          actionable
          @activate="monthSelect(latestMonth!.month, 'EXPENSE')"
        />
      </SectionPanel>
      <SectionPanel :title="tr('Einnahmen und Ausgaben')" icon="categories" class="finance-analysis-top" :bare="true">
        <div class="analytics-metrics finance-analysis-insights">
          <FinanceTile
            :label="tr('Durchschnittliche Ausgaben')"
            variant="insight"
            :financial="report.average.expenseCents !== null"
            :value="
              report.average.expenseCents === null ? tr('Noch nicht berechenbar') : money(report.average.expenseCents)
            "
            :context="tr('Ø aus {0} Monaten', [report.average.monthCount])"
            :to="link({ direction: 'EXPENSE' })"
            ><template #graphic><FinanceIcon name="categories" /></template
          ></FinanceTile>
          <FinanceTile
            :label="tr('Trend zum Vormonat')"
            variant="insight"
            :financial="Boolean(report.trend)"
            :value="report.trend ? money(report.trend.changeCents) : tr('Noch kein vergleichbarer Trend')"
            :context="
              report.trend
                ? tr('{0} gegenüber {1}', [monthName(report.trend.month), monthName(report.trend.previousMonth)])
                : tr('Zwei aufeinanderfolgende geeignete Monate erforderlich')
            "
            :to="trendLink"
            ><template #graphic><FinanceIcon name="transactions" /></template
          ></FinanceTile>
        </div>
      </SectionPanel>
    </div>
    <div class="finance-analysis-actuals">
      <NuxtLink :to="link({ direction: 'INCOME' })"
        >{{ tr('Einnahmen') }}
        <strong class="positive" data-financial
          ><template v-if="!amountsMasked()">{{ money(report.incomeCents) }}</template
          ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
        ></NuxtLink
      >
      <NuxtLink :to="link({ direction: 'EXPENSE' })"
        >{{ tr('Ausgaben') }}
        <strong data-financial
          ><template v-if="!amountsMasked()">{{ money(report.expenseCents) }}</template
          ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
        ></NuxtLink
      >
      <span
        >{{ tr('Saldo der Geldflüsse') }}
        <strong data-financial
          ><template v-if="!amountsMasked()">{{ money(report.netCents) }}</template
          ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
        ></span
      >
    </div>
    <SectionPanel :title="tr('Deine Analysen')" icon="categories" bare>
      <template #actions><AnalysisModulePicker :available="availableModules" /></template>
      <AnalysisModuleGrid
        :report="report"
        :merchant-count="merchants?.merchants.length ?? 0"
        :available="availableModules"
        :months-href="analysisAnchor('monatsverlauf')"
        :categories-href="analysisAnchor('kategorien')"
        :merchants-href="analysisAnchor('haendler')"
      >
        <template #history>
          <FinanceTile
            :label="tr('Aufgezeichnetes Vermögen')"
            :state="moduleState.history"
            :error-text="moduleErrors.history"
            :value="
              !latestWealth
                ? tr('Noch keine Aufzeichnungen')
                : latestWealthKnown
                  ? money(latestWealth.totalCents)
                  : tr('Keine bekannten Beträge')
            "
            :financial="latestWealthKnown"
            :context="
              latestWealth
                ? tr('Gesamter Arbeitsbereich · {0} · unabhängig vom Umsatzfilter', [
                    observedTime(latestWealth.recordedAt),
                  ])
                : tr('Gesamter Arbeitsbereich · nur ausdrücklich aufgezeichnete Beobachtungen')
            "
            to="/wealth"
            @retry="loadWorkspaceModule('history')"
            ><template #graphic><FinanceIcon name="history" /></template
          ></FinanceTile>
        </template>
        <template #reserve>
          <FinanceTile
            :label="tr('Notgroschen')"
            :state="moduleState.reserve"
            :error-text="moduleErrors.reserve"
            :value="
              reserve?.currentCents === null || !reserve ? tr('Keine beobachtete Reserve') : money(reserve.currentCents)
            "
            :financial="reserve?.currentCents !== null && Boolean(reserve)"
            to="/wealth"
            @retry="loadWorkspaceModule('reserve')"
          >
            <template #context
              ><span v-if="reserve"
                >{{ tr('Gesamte Reserve · Ziel:') }}
                <span data-financial
                  ><template v-if="!amountsMasked()">{{ money(reserve.targetCents) }}</template
                  ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></span
                >
                · {{ reserve.observedCount }} {{ tr('von') }} {{ reserve.eligibleCount }} {{ tr('Quellen beobachtet')
                }}<span v-if="reserveStale"> · {{ reserveStale }} {{ tr('älter als 48 Stunden') }}</span></span
              ><span class="block">{{ tr('Unabhängig vom Umsatzfilter') }}</span></template
            >
            <template #graphic><FinanceIcon name="accounts" /></template>
          </FinanceTile>
        </template>
        <template #contracts>
          <FinanceTile
            :label="tr('Vertragskosten')"
            :state="moduleState.contracts"
            :error-text="moduleErrors.contracts"
            :value="contractCosts ? money(contractCosts.monthlyCents) : undefined"
            financial
            :context="
              contractCosts
                ? tr('{0} bestätigte Verträge · globaler Planwert / Monat · {1} · unabhängig vom Umsatzfilter', [
                    contractCosts.count,
                    calendarDate(contractCosts.asOf),
                  ])
                : undefined
            "
            to="/contracts/analysis"
            @retry="loadWorkspaceModule('contracts')"
            ><template #graphic><FinanceIcon name="contracts" /></template
          ></FinanceTile>
        </template>
      </AnalysisModuleGrid>
    </SectionPanel>
    <div class="toolbar finance-chart-choice" role="group" :aria-label="tr('Diagrammdarstellung')">
      <UButton
        :aria-pressed="preferences.chart === 'bar'"
        :variant="preferences.chart === 'bar' ? 'soft' : 'ghost'"
        @click="updatePreferences({ chart: 'bar' })"
        >{{ tr('Balkendiagramme') }}</UButton
      >
      <UButton
        :aria-pressed="preferences.chart === 'ring'"
        :variant="preferences.chart === 'ring' ? 'soft' : 'ghost'"
        @click="updatePreferences({ chart: 'ring' })"
        >{{ tr('Ringdiagramme') }}</UButton
      >
    </div>
    <SectionPanel
      id="monatsverlauf"
      :title="tr('Dein Monatsverlauf')"
      icon="categories"
      class="mb-5"
      :help="
        tr(
          'Der Trend vergleicht den letzten geeigneten Monat mit seinem direkten Kalendervormonat. Beide müssen vollständig ausgewählt sein und Buchungen enthalten.',
        )
      "
    >
      <p v-if="preferences.chart === 'ring'" class="muted mb-4">
        {{
          tr(
            'Der Ring zeigt Ausgabenanteile der Monate. Einnahmen, Ausgaben und Lücken stehen centgenau in der Tabelle.',
          )
        }}
      </p>
      <MonthlyChart :report="report" :chart="preferences.chart" @select="monthSelect" />
      <div v-if="report.trend" class="data-context">
        <strong
          >{{ tr('Ausgabentrend:') }} {{ money(report.trend.changeCents)
          }}<span v-if="report.trend.percent !== null">
            ({{ financialPercentage(report.trend.percent) }} %)</span
          ></strong
        ><span
          >{{ monthName(report.trend.month) }} {{ tr('gegenüber') }} {{ monthName(report.trend.previousMonth)
          }}<span v-if="report.trend.percent === null"> {{ tr('· kein Prozentwert bei Nullbasis') }}</span></span
        >
      </div>
      <p v-else class="muted">{{ tr('Noch kein vergleichbarer Trend.') }}</p>
    </SectionPanel>
    <div class="dashboard-grid mb-5">
      <SectionPanel id="kategorien" :title="tr('Ausgaben nach Kategorien')" icon="categories">
        <ExpenseChart
          v-if="report.categories.length"
          :groups="report.categories"
          :total-cents="report.expenseCents"
          :chart="preferences.chart"
          :label="tr('Ausgabenanteile nach Kategorien')"
          @select="navigateTo(categoryLink($event))"
        />
        <p v-else class="empty-copy">{{ tr('Keine gebuchten Ausgaben im gewählten Zeitraum.') }}</p>
        <UButton
          v-for="group in report.categories"
          :key="group.categoryId ?? 'none'"
          :to="categoryLink(group.categoryId)"
          color="neutral"
          variant="link"
          class="contract-list-row"
          ><span
            >{{ categoryDisplayLabel(group.categoryId, group.name)
            }}<small
              >{{ financialPercentage(group.share * 100, { maximumFractionDigits: 1 }) }} % · {{ group.count }}
              {{ tr('Buchungen') }}</small
            ></span
          ><strong>{{ money(group.expenseCents) }}</strong></UButton
        >
      </SectionPanel>
      <SectionPanel
        :help="
          tr(
            'Manuelle Kennzeichnung hat Vorrang. Bestätigte Vertragszahlungen gelten sonst als fix; der Rest bleibt nicht eingeordnet.',
          )
        "
        :title="tr('Fix oder variabel?')"
        icon="categories"
      >
        <UButton
          v-for="group in report.classification"
          :key="group.classification"
          :to="link({ classification: group.classification, direction: 'EXPENSE' })"
          color="neutral"
          variant="link"
          class="contract-list-row"
          ><span
            >{{ classificationLabels[group.classification]
            }}<small
              >{{ financialPercentage(group.share * 100, { maximumFractionDigits: 1 }) }} % · {{ group.count }}
              {{ tr('Buchungen') }}</small
            ></span
          ><strong>{{ money(group.expenseCents) }}</strong></UButton
        >
      </SectionPanel>
    </div>
    <SectionPanel id="haendler" :title="tr('Wo gibst du dein Geld aus?')" icon="categories" class="mb-5">
      <NuxtLink
        v-for="merchant in merchants?.merchants"
        :key="merchant.key"
        :to="merchantLink(merchant.key)"
        class="contract-list-row"
        ><span
          >{{ merchant.key === 'unknown' ? tr('Unbekannter Händler') : merchant.label
          }}<small>{{ merchant.count }} {{ tr('Buchungen') }}</small></span
        ><strong data-financial
          ><template v-if="!amountsMasked()">{{ money(merchant.expenseCents) }}</template
          ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
        ></NuxtLink
      >
      <p v-if="!merchants?.merchants.length" class="empty-copy">
        {{ tr('Keine gebuchten Ausgaben im gewählten Zeitraum.') }}
      </p>
    </SectionPanel>
    <SectionPanel
      :title="tr('Exakte Monatswerte')"
      icon="categories"
      :help="
        tr(
          'Durchschnitt nur aus vollständig ausgewählten, abgeschlossenen Monaten mit Buchungen. Lücken sowie laufende und angeschnittene Monate bleiben sichtbar. Einzelne Buchungen werden nicht aufgeteilt.',
        )
      "
    >
      <div class="analytics-table-scroll">
        <table class="analytics-table">
          <caption class="sr-only">
            {{
              tr('Monatliche Einnahmen, Ausgaben, Saldo und Eignung für den Durchschnitt')
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ tr('Monat') }}</th>
              <th scope="col">{{ tr('Einnahmen') }}</th>
              <th scope="col">{{ tr('Ausgaben') }}</th>
              <th scope="col">{{ tr('Saldo') }}</th>
              <th scope="col">{{ tr('Durchschnitt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="month in report.months" :key="month.month">
              <th scope="row">{{ monthName(month.month) }}</th>
              <td>
                <UButton variant="link" color="neutral" @click="monthSelect(month.month, 'INCOME')">{{
                  money(month.incomeCents)
                }}</UButton>
              </td>
              <td>
                <UButton variant="link" color="neutral" @click="monthSelect(month.month, 'EXPENSE')">{{
                  money(month.expenseCents)
                }}</UButton>
              </td>
              <td>{{ money(month.netCents) }}</td>
              <td>{{ month.averageEligible ? tr('Berücksichtigt') : reasons[month.excludedReason!] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted mt-4">
        {{ report.average.excludedMonths.length }} {{ tr('von') }} {{ report.months.length }}
        {{ tr('Monaten ausgeschlossen.') }}
      </p>
    </SectionPanel>
  </template>
</template>

<style scoped>
.filter-grid > * {
  min-width: 0;
}
@media (max-width: 1100px) {
  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 700px) {
  .filter-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
