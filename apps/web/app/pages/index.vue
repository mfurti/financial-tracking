<script setup lang="ts">
import { z } from 'zod';
import { userErrorMessage } from '../utils/api-error';
import type { BudgetList } from '../utils/category-budget';
import {
  accountSchema,
  monthlySchema,
  transactionPageSchema,
  runSchema,
  accountGroupSchema,
  categoryBudgetSummarySchema,
  type Account,
  type Monthly,
  type Transaction,
  type ImportRun,
} from '@financial-tracking/contracts';

const api = useApi();
const route = useRoute();
const router = useRouter();
/** Use the same Berlin month boundary for the picker and the forecast. */
function berlinMonth() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()).slice(0, 7);
}
const month = ref(
  typeof route.query.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(route.query.month)
    ? route.query.month
    : berlinMonth(),
);
const currentBerlinMonth = ref(berlinMonth());
const showForecast = computed(() => month.value >= currentBerlinMonth.value);
const accounts = ref<Account[]>([]);
const groupId = ref(typeof route.query.groupId === 'string' ? route.query.groupId : '');
const groupDialog = ref(false);
const groups = ref<z.infer<typeof accountGroupSchema>[]>([]);
const groupError = ref('');
watch(groupDialog, async (open) => {
  if (!open) return;
  groupError.value = '';
  try {
    groups.value = await api.request('/account-groups', z.array(accountGroupSchema));
  } catch (cause) {
    groupError.value = userErrorMessage(cause);
  }
});
async function selectGroup(value: string) {
  groupId.value = value;
  groupDialog.value = false;
  await load();
}
const report = ref<Monthly | null>(null);
const budgetList = ref<BudgetList>({ state: 'loading' });
const recent = ref<Transaction[]>([]);
const error = ref('');
const busy = ref(true);
const reviews = ref(0);
const unassigned = ref(false);
const importResult = ref<ImportRun | null>(null);
let loadVersion = 0;
let budgetVersion = 0;
let disposed = false;
const transactionCount = computed(
  /** Reports count only booked records excluding own transfers. */ () =>
    report.value?.bookedCount ??
    report.value?.categories.reduce(
      /** Sum the server's category counts. */ (total, category) => total + category.count,
      0,
    ) ??
    0,
);
const uncategorizedCount = computed(
  /** Keep unknown classifications visible rather than inventing a category. */ () =>
    report.value?.categories.find(
      /** The explicit null group is the uncategorized bucket. */ (category) => category.categoryId === null,
    )?.count ?? 0,
);
const transactionsLink = computed(
  /** Keep navigation in the displayed month. */ () =>
    `/transactions?${new URLSearchParams({ ...monthRangeQuery(month.value), ...(groupId.value ? { groupId: groupId.value } : {}) })}`,
);
const uncategorizedLink = computed(
  /** Open real records awaiting a category. */ () => `${transactionsLink.value}&uncategorized=true`,
);
const monthPhase = computed(
  /** A month selector does not establish complete bank coverage, especially for current or future periods. */ () => {
    const current = currentBerlinMonth.value;
    return month.value === current
      ? tr('Laufender Monat · gebuchte Umsätze')
      : month.value > current
        ? tr('Zukünftiger Monat · nur vorhandene Buchungen')
        : tr('Kalendermonat · gebuchte Umsätze');
  },
);
const balances = computed(
  /** Only source-provided active booked balances contribute to the known total. */ () =>
    accounts.value
      .filter(/** Exclude deactivated accounts. */ (account) => account.isActive)
      .flatMap(
        /** Prefer the actual booked balance. */ (account) =>
          account.balances.filter(
            /** Available limits must not inflate booked wealth. */ (balance) => balance.balanceType === 'BOOKED',
          ),
      ),
);
const knownBalance = computed(
  /** Sum exact cents without converting to Number. */ () =>
    balances.value.reduce(
      /** Accumulate a known source balance. */ (total, balance) => total + BigInt(balance.amountCents),
      0n,
    ),
);
const activeCount = computed(
  /** Count accounts with missing source balances separately. */ () =>
    accounts.value.filter(/** Only active accounts count here. */ (account) => account.isActive).length,
);
/** Move a Berlin calendar-month identity without converting an input date through local time. */
async function shiftMonth(offset: number) {
  const date = new Date(`${month.value}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  month.value = date.toISOString().slice(0, 7);
  await load();
}
/** Return to the current Berlin month through the same versioned data-loading path. */
async function currentMonth() {
  month.value = berlinMonth();
  await load();
}
/** Keep budget cards and the forecast on the same month snapshot, independently of other overview data. */
async function loadBudgets() {
  if (disposed) return;
  const version = ++budgetVersion;
  budgetList.value = { state: 'loading' };
  try {
    const budgets = await api.request('/budgets', z.array(categoryBudgetSummarySchema), {
      query: { month: month.value },
    });
    if (!disposed && version === budgetVersion) budgetList.value = { state: 'ready', budgets };
  } catch (cause) {
    if (!disposed && version === budgetVersion) budgetList.value = { state: 'error', message: userErrorMessage(cause) };
  }
}
/** Fetch dashboard data for the selected month and keep it bookmarkable. */
async function load() {
  if (disposed || route.path !== '/') return;
  currentBerlinMonth.value = berlinMonth();
  const version = ++loadVersion;
  const selectedMonth = month.value;
  const selectedGroup = groupId.value;
  const requestedImport = typeof route.query.import === 'string' ? route.query.import : null;
  busy.value = true;
  error.value = '';
  void loadBudgets();
  try {
    const [a, r, t, runs, standalone] = await Promise.all([
      api.request('/accounts', z.array(accountSchema)),
      api.request('/analytics/monthly', monthlySchema, {
        query: { month: selectedMonth, groupId: selectedGroup || undefined },
      }),
      api.request('/transactions', transactionPageSchema, {
        query: {
          status: 'BOOKED',
          limit: 5,
          groupId: selectedGroup || undefined,
          ...monthRangeQuery(selectedMonth),
        },
      }),
      api.request('/imports', z.array(runSchema)),
      api.request('/transactions', transactionPageSchema, { query: { unassigned: 'true', limit: 1 } }),
    ]);
    if (disposed || version !== loadVersion || route.path !== '/') return;
    if (selectedGroup && !groups.value.some((group) => group.id === selectedGroup)) {
      const loaded = await api.request('/account-groups', z.array(accountGroupSchema));
      if (disposed || version !== loadVersion || route.path !== '/') return;
      groups.value = loaded;
    }
    const members = groups.value.find((group) => group.id === selectedGroup)?.accountIds ?? [];
    accounts.value = selectedGroup ? a.filter((account) => members.includes(account.id)) : a;
    report.value = r;
    recent.value = t.items;
    importResult.value =
      runs.find(
        /** Only persisted completed runs can produce a success message. */ (run) =>
          run.id === requestedImport && ['COMPLETED', 'PARTIAL_SUCCESS'].includes(run.status),
      ) ?? null;
    reviews.value = runs.reduce(
      /** Include actionable duplicate reviews across the visible import history. */ (total, run) =>
        total + run.reviewRequiredCount,
      0,
    );
    unassigned.value = standalone.items.length > 0;
    await router.replace({ query: { month: selectedMonth, ...(selectedGroup ? { groupId: selectedGroup } : {}) } });
  } catch (cause) {
    if (disposed || version !== loadVersion) return;
    report.value = null;
    error.value = userErrorMessage(cause);
  } finally {
    if (version === loadVersion) busy.value = false;
  }
}
onMounted(load);
onBeforeRouteLeave(
  /** A pending navigation already owns the URL before its lazy component resolves; late overview reads must not cancel it. */ () => {
    loadVersion++;
    budgetVersion++;
  },
);
onBeforeUnmount(
  /** A late dashboard response cannot rewrite another page's URL. */ () => {
    disposed = true;
    loadVersion++;
  },
);
</script>

<template>
  <div class="page-heading finance-period-heading">
    <div>
      <h1>{{ tr('Übersicht') }}</h1>
    </div>
    <div class="toolbar finance-month-controls">
      <UButton
        variant="ghost"
        color="neutral"
        class="finance-month-step"
        :aria-label="tr('Vorheriger Monat')"
        @click="shiftMonth(-1)"
        >‹</UButton
      >
      <MonthPicker v-model="month" compact @change="load" />
      <UButton
        variant="ghost"
        color="neutral"
        class="finance-month-step"
        :aria-label="tr('Nächster Monat')"
        @click="shiftMonth(1)"
        >›</UButton
      >
    </div>
  </div>
  <div class="finance-overview-tools">
    <FinanceDialog v-model:open="groupDialog" :title="tr('Kontogruppen')" panel="groups">
      <template #trigger
        ><UButton variant="soft" size="sm" :aria-label="tr('Kontogruppen wählen')">{{
          groupId ? (groups.find((group) => group.id === groupId)?.name ?? tr('Kontogruppe')) : tr('Alle Konten')
        }}</UButton></template
      >
      <div class="finance-dialog-options">
        <UAlert v-if="groupError" role="alert" color="error" :description="groupError" />
        <UButton variant="outline" color="neutral" :aria-pressed="!groupId" @click="selectGroup('')">{{
          tr('Alle Konten')
        }}</UButton>
        <UButton
          v-for="group in groups"
          :key="group.id"
          variant="outline"
          color="neutral"
          :aria-pressed="groupId === group.id"
          @click="selectGroup(group.id)"
          >{{ group.name }}</UButton
        >
        <UButton variant="ghost" to="/settings/account-groups">{{ tr('Gruppen verwalten') }}</UButton>
      </div>
    </FinanceDialog>
    <UPopover>
      <UButton variant="ghost" color="neutral" size="sm" :aria-label="tr('Weitere Aktionen')"
        ><FinanceIcon name="more"
      /></UButton>
      <template #content
        ><div class="finance-overview-actions">
          <p class="muted">{{ monthPhase }}</p>
          <UButton variant="ghost" @click="currentMonth">{{ tr('Dieser Monat') }}</UButton>
          <UButton variant="ghost" :loading="busy" @click="load">{{ tr('Aktualisieren') }}</UButton>
          <UButton to="/imports/csv">{{ tr('CSV hochladen') }}</UButton>
          <NuxtLink v-if="reviews" to="/imports">{{ reviews }} {{ tr('Buchungen klären') }}</NuxtLink>
          <NuxtLink v-if="uncategorizedCount" :to="uncategorizedLink"
            >{{ uncategorizedCount }} {{ tr('Kategorien ergänzen (freiwillig)') }}</NuxtLink
          >
          <small v-if="report"
            >{{ transactionCount }} {{ tr('Buchungen') }} · {{ money(report.deltaCents) }}
            {{ tr('zum Vormonat') }}</small
          >
        </div></template
      >
    </UPopover>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <UButton v-if="error && !busy" variant="soft" class="mb-5" @click="load">{{ tr('Erneut versuchen') }}</UButton>
  <UAlert
    v-if="importResult"
    role="status"
    color="success"
    :title="tr('Datei ausgewertet')"
    :description="
      tr('{0} neue Buchungen übernommen · {1} bereits bekannt. Deine Monatszahlen sind aktualisiert.', [
        importResult.importedCount,
        importResult.knownCount,
      ])
    "
    class="mb-5"
  />
  <p v-if="busy" role="status" class="muted">{{ tr('Dein Monat wird geladen …') }}</p>
  <div
    v-if="busy"
    class="stats-grid finance-overview-stats"
    :class="{ 'finance-overview-stats--forecast': showForecast }"
    aria-busy="true"
  >
    <FinanceTile
      v-for="label in ['Monatsbilanz', 'Einnahmen', 'Ausgaben']"
      :key="label"
      :label="label"
      variant="stat"
      state="loading"
    />
    <FinanceTile v-if="showForecast" :label="tr('Bis Monatsende frei')" variant="stat" state="loading" />
  </div>
  <template v-else-if="report && !error">
    <div class="stats-grid finance-overview-stats" :class="{ 'finance-overview-stats--forecast': showForecast }">
      <FinanceTile :label="tr('Monatsbilanz')" variant="stat" class="month-balance">
        <template #value
          ><span class="overview-net" data-financial
            ><template v-if="!amountsMasked()">{{ money(report.netCents) }}</template
            ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></span
          ></template
        >
      </FinanceTile>
      <FinanceTile :label="tr('Einnahmen')" variant="stat"
        ><template #value
          ><span class="positive" data-financial
            ><template v-if="!amountsMasked()">{{ money(report.incomeCents) }}</template
            ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></span
          ></template
        ></FinanceTile
      >
      <FinanceTile :label="tr('Ausgaben')" variant="stat"
        ><template #value
          ><span class="negative" data-financial
            ><template v-if="!amountsMasked()">{{ money(report.expenseCents) }}</template
            ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></span
          ></template
        ></FinanceTile
      >
      <MonthForecastTile
        v-if="showForecast"
        :month="month"
        :group-id="groupId"
        :booked-net-cents="report.netCents"
        :budget-list="budgetList"
        :refresh-budgets="loadBudgets"
      />
    </div>
    <CategoryBudgets
      :month="month"
      :show-all-accounts="Boolean(groupId)"
      :budget-list="budgetList"
      :refresh-budgets="loadBudgets"
    />
    <OverviewColumns>
      <template #bookings>
        <SectionPanel :title="tr('Letzte Buchungen')" compact data-overview-section="bookings">
          <p v-if="!recent.length" class="empty-copy">
            {{
              tr(
                'In diesem Monat sind noch keine Buchungen vorhanden. Lade eine Datei hoch oder wähle einen anderen Monat.',
              )
            }}
          </p>
          <FinancePopupLink
            v-for="row in recent"
            :key="row.id"
            :to="`/transactions/${row.id}`"
            :dialog-title="tr('Umsatzdetails')"
            class="transaction-row"
            ><span class="transaction-icon" aria-hidden="true">{{
              Array.from(row.counterpartyName?.trim() || row.description.trim())[0]?.toLocaleUpperCase(
                displayLocale(),
              ) || '·'
            }}</span>
            <div>
              <strong>{{ row.counterpartyName?.trim() || row.description }}</strong>
              <small>
                {{
                  row.isTransfer
                    ? tr('Eigene Umbuchung')
                    : row.splits?.length
                      ? tr('Aufgeteilt')
                      : row.categoryId === null
                        ? tr('Nicht kategorisiert')
                        : (report.categories.find((c) => c.categoryId === row.categoryId)?.name ??
                          tr('Nicht kategorisiert'))
                }}</small
              >
            </div>
            <strong :class="BigInt(row.amountCents) > 0n ? 'positive' : 'negative'" data-financial
              ><template v-if="!amountsMasked()">{{ money(row.amountCents) }}</template
              ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
            ></FinancePopupLink
          >
          <div class="section-action">
            <UButton :to="transactionsLink" variant="soft">{{ tr('Alle Umsätze') }}</UButton>
          </div>
        </SectionPanel>
      </template>
      <template #payments><UpcomingContracts data-overview-section="payments" /></template>
      <template #accounts>
        <SectionPanel
          :title="tr('Meine Konten')"
          compact
          data-overview-section="accounts"
          :help="tr('CSV-Dateien liefern Umsätze. Bankgemeldete Kontostände bleiben von der Monatsbilanz getrennt.')"
        >
          <p v-if="!accounts.length" class="muted text-sm my-5">
            {{ tr('Noch keine Konten. CSV-Import funktioniert auch ohne Konto.') }}
          </p>
          <NuxtLink v-for="account in accounts" :key="account.id" :to="`/accounts/${account.id}`" class="account-row"
            ><span class="account-icon"><FinanceIcon name="accounts" /></span>
            <div>
              <strong>{{ account.name }}</strong
              ><small
                >{{ tr({ CHECKING: 'Girokonto', SAVINGS: 'Sparkonto', OTHER: 'Sonstiges Konto' }[account.accountType])
                }}<template v-if="!account.isActive"> · {{ tr('Inaktiv') }}</template></small
              >
            </div>
            <strong data-financial
              ><template v-if="!amountsMasked()">{{
                account.balances.find((b) => b.balanceType === 'BOOKED')
                  ? money(account.balances.find((b) => b.balanceType === 'BOOKED')!.amountCents)
                  : tr('Kein Saldo')
              }}</template
              ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
            ></NuxtLink
          >
          <div class="accounts-summary">
            <small>{{ tr('Bekannte Kontostände') }}</small
            ><strong data-financial
              ><template v-if="!amountsMasked()">{{
                balances.length ? money(knownBalance) : tr('Noch kein Saldo')
              }}</template
              ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
            ><small
              >{{ balances.length }} {{ tr('von') }} {{ activeCount }}
              {{ tr('aktiven Konten · von der Bank gemeldet') }}</small
            >
          </div>
          <NuxtLink v-if="unassigned" to="/transactions?unassigned=true" class="text-link">{{
            tr('Buchungen ohne Konto ansehen')
          }}</NuxtLink>
          <div class="section-action">
            <UButton to="/accounts" variant="soft">{{ tr('Kontenübersicht') }}</UButton>
          </div>
        </SectionPanel>
      </template>
      <template #categories
        ><ExpenseBreakdown :report="report" :group-id="groupId" compact data-overview-section="categories"
      /></template>
    </OverviewColumns>
    <UButton to="/analytics" variant="soft" class="mt-5">{{ tr('Mehrmonatsanalyse öffnen') }}</UButton>
  </template>
</template>
