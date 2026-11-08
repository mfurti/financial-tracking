<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
const api = useApi();
const route = useRoute();
const router = useRouter();
const appliedFilters = ref<z.infer<typeof c.analyticsOverviewQuerySchema>>({});
const report = ref<z.infer<typeof c.analyticsOverviewSchema> | null>(null);
const accounts = ref<c.Account[]>([]);
const categories = ref<c.Category[]>([]);
const from = ref(String(route.query.from ?? ''));
const to = ref(String(route.query.to ?? ''));
const accountId = ref(route.query.unassigned === 'true' ? 'UNASSIGNED' : String(route.query.accountId ?? ''));
const categoryId = ref(route.query.uncategorized === 'true' ? 'UNCATEGORIZED' : String(route.query.categoryId ?? ''));
const error = ref('');
const busy = ref(true);
let generation = 0;
const reasons: Record<string, string> = {
  NO_DATA: 'Keine Buchungen',
  CURRENT: 'Laufender Monat',
  FUTURE: 'Zukünftiger Monat',
  PARTIAL: 'Nur teilweise ausgewählt',
};
const classificationLabels = { FIXED: 'Fix', VARIABLE: 'Variabel', UNCLASSIFIED: 'Nicht eingeordnet' };
const navigation = [
  { label: 'Analysen', to: '/analytics', exact: true },
  { label: 'Kategorien & Regeln', to: '/categories' },
];
/** Read exactly the chosen range/identity filters for both report and drill-down. */
function filters() {
  return c.analyticsOverviewQuerySchema.parse({
    from: from.value || undefined,
    to: to.value || undefined,
    accountId: accountId.value && accountId.value !== 'UNASSIGNED' ? accountId.value : undefined,
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
  try {
    const input = filters();
    const [result, availableAccounts, availableCategories] = await Promise.all([
      api.request('/analytics/overview', c.analyticsOverviewSchema, { query: input }),
      api.request('/accounts', z.array(c.accountSchema)),
      api.request('/categories', z.array(c.categorySchema)),
    ]);
    if (current !== generation) return;
    report.value = result;
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
  if (appliedFilters.value.uncategorized === 'true') source.uncategorized = 'true';
  else if (appliedFilters.value.categoryId) source.categoryId = appliedFilters.value.categoryId;
  return `/transactions?${new URLSearchParams({ ...source, ...extra })}`;
}
/** Category selection retains the current range/account and selects precisely one expense group. */
function categoryLink(id: string | null) {
  return link({ direction: 'EXPENSE', categoryId: id ?? '', uncategorized: id === null ? 'true' : 'false' });
}
/** A selected chart month/direction opens that month's contributing actual transactions. */
async function monthSelect(month: string, direction: 'INCOME' | 'EXPENSE') {
  const row = report.value?.months.find(
    /** Use inclusive clipped boundaries from the report. */ (entry) => entry.month === month,
  );
  if (row) await navigateTo(link({ from: row.from, to: row.to, direction }));
}
onMounted(load);
onBeforeUnmount(
  /** Invalidate outstanding reads when leaving analyses. */ () => {
    generation++;
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>Analysen</h1>
    </div>
    <div class="toolbar">
      <HelpPopover
        title="So liest du diese Zahlen"
        text="Gebuchte Umsätze einschließlich Ohne Konto zählen. Umbuchungen und Vormerkungen sind ausgeschlossen. Erstattungen sind Einnahmen. Durchschnitte berücksichtigen vollständig ausgewählte, abgeschlossene Monate mit Buchungen; vorhandene Daten beweisen keine vollständige Bankhistorie."
      /><UButton to="/imports/csv">CSV importieren</UButton>
    </div>
  </div>
  <UNavigationMenu :items="navigation" class="mb-5" aria-label="Analysebereiche" />
  <section class="panel mb-5">
    <div class="toolbar mb-4">
      <UButton
        v-for="count in [3, 6, 12]"
        :key="count"
        color="neutral"
        variant="outline"
        :disabled="busy"
        @click="preset(count)"
        >{{ count }} Monate</UButton
      >
    </div>
    <HelpPopover
      title="Zeitraum"
      text="Schnellwahl: abgeschlossene Monate. Eigener Zeitraum: maximal 36 Monate. Laufende Monate zählen zu den Summen, aber nicht zum Durchschnitt."
      class="mb-4"
    />
    <form class="filter-grid" @submit.prevent="apply">
      <UFormField label="Zeitraum von"><DatePicker v-model="from" label="Zeitraum von" /></UFormField
      ><UFormField label="Zeitraum bis"><DatePicker v-model="to" label="Zeitraum bis" /></UFormField
      ><UFormField label="Konto"
        ><ChoiceSelect
          v-model="accountId"
          :items="[
            { label: 'Alle Konten', value: '' },
            { label: 'Ohne Konto', value: 'UNASSIGNED' },
            ...accounts.map(
              /** Filter real account identities only. */ (account) => ({ label: account.name, value: account.id }),
            ),
          ]" /></UFormField
      ><UFormField label="Kategorie"
        ><ChoiceSelect
          v-model="categoryId"
          :items="[
            { label: 'Alle Kategorien', value: '' },
            { label: 'Nicht kategorisiert', value: 'UNCATEGORIZED' },
            ...categories.map(
              /** Existing category IDs drive both report and transactions. */ (category) => ({
                label: category.name,
                value: category.id,
              }),
            ),
          ]" /></UFormField
      ><UButton type="submit" :loading="busy">Auswertung anzeigen</UButton>
    </form>
  </section>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <p v-if="busy" role="status">Auswertung wird geladen …</p>
  <template v-if="report && !busy">
    <div class="analytics-metrics mb-5">
      <section class="panel">
        <p class="muted">Einnahmen</p>
        <UButton
          :to="link({ direction: 'INCOME' })"
          variant="link"
          color="neutral"
          class="insight-amount amount-income"
          >{{ money(report.incomeCents) }}</UButton
        >
      </section>
      <section class="panel">
        <p class="muted">Ausgaben</p>
        <UButton
          :to="link({ direction: 'EXPENSE' })"
          variant="link"
          color="neutral"
          class="insight-amount amount-expense"
          >{{ money(report.expenseCents) }}</UButton
        >
      </section>
      <section class="panel">
        <p class="muted">Saldo der Geldflüsse</p>
        <strong class="insight-amount">{{ money(report.netCents) }}</strong>
      </section>
      <section class="panel">
        <p class="muted">Durchschnittliche Ausgaben</p>
        <strong class="insight-amount">{{
          report.average.expenseCents === null ? 'Noch nicht berechenbar' : money(report.average.expenseCents)
        }}</strong
        ><small>Ø aus {{ report.average.monthCount }} Monaten</small>
      </section>
    </div>
    <SectionPanel
      title="Dein Monatsverlauf"
      icon="categories"
      class="mb-5"
      help="Der Trend vergleicht den letzten geeigneten Monat mit seinem direkten Kalendervormonat. Beide müssen vollständig ausgewählt sein und Buchungen enthalten."
    >
      <MonthlyChart :report="report" @select="monthSelect" />
      <div v-if="report.trend" class="data-context">
        <strong
          >Ausgabentrend: {{ money(report.trend.changeCents)
          }}<span v-if="report.trend.percent !== null">
            ({{ report.trend.percent.toLocaleString('de-DE') }} %)</span
          ></strong
        ><span
          >{{ monthName(report.trend.month) }} gegenüber {{ monthName(report.trend.previousMonth)
          }}<span v-if="report.trend.percent === null"> · kein Prozentwert bei Nullbasis</span></span
        >
      </div>
      <p v-else class="muted">Noch kein vergleichbarer Trend.</p>
    </SectionPanel>
    <div class="dashboard-grid mb-5">
      <SectionPanel title="Ausgaben nach Kategorien" icon="categories">
        <ExpenseChart
          v-if="report.categories.length"
          :groups="report.categories"
          :total-cents="report.expenseCents"
          label="Ausgabenanteile nach Kategorien"
          @select="navigateTo(categoryLink($event))"
        />
        <p v-else class="empty-copy">Keine gebuchten Ausgaben im gewählten Zeitraum.</p>
        <UButton
          v-for="group in report.categories"
          :key="group.categoryId ?? 'none'"
          :to="categoryLink(group.categoryId)"
          color="neutral"
          variant="link"
          class="contract-list-row"
          ><span
            >{{ group.name
            }}<small
              >{{ (group.share * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 }) }} % ·
              {{ group.count }} Buchungen</small
            ></span
          ><strong>{{ money(group.expenseCents) }}</strong></UButton
        >
      </SectionPanel>
      <SectionPanel
        help="Manuelle Kennzeichnung hat Vorrang. Bestätigte Vertragszahlungen gelten sonst als fix; der Rest bleibt nicht eingeordnet."
        title="Fix oder variabel?"
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
              >{{ (group.share * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 }) }} % ·
              {{ group.count }} Buchungen</small
            ></span
          ><strong>{{ money(group.expenseCents) }}</strong></UButton
        >
      </SectionPanel>
    </div>
    <SectionPanel
      title="Exakte Monatswerte"
      icon="categories"
      help="Durchschnitt nur aus vollständig ausgewählten, abgeschlossenen Monaten mit Buchungen. Lücken sowie laufende und angeschnittene Monate bleiben sichtbar. Einzelne Buchungen werden nicht aufgeteilt."
    >
      <div class="analytics-table-scroll">
        <table class="analytics-table">
          <caption class="sr-only">
            Monatliche Einnahmen, Ausgaben, Saldo und Eignung für den Durchschnitt
          </caption>
          <thead>
            <tr>
              <th scope="col">Monat</th>
              <th scope="col">Einnahmen</th>
              <th scope="col">Ausgaben</th>
              <th scope="col">Saldo</th>
              <th scope="col">Durchschnitt</th>
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
              <td>{{ month.averageEligible ? 'Berücksichtigt' : reasons[month.excludedReason!] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted mt-4">
        {{ report.average.excludedMonths.length }} von {{ report.months.length }} Monaten ausgeschlossen.
      </p>
    </SectionPanel>
  </template>
</template>
