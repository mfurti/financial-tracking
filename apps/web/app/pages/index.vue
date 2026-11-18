<script setup lang="ts">
import { z } from 'zod';
import { userErrorMessage } from '../utils/api-error';
import {
  accountSchema,
  monthlySchema,
  transactionPageSchema,
  runSchema,
  type Account,
  type Monthly,
  type Transaction,
  type ImportRun,
} from '@financial-tracking/contracts';

const api = useApi();
const route = useRoute();
const router = useRouter();
const month = ref(
  typeof route.query.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(route.query.month)
    ? route.query.month
    : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()).slice(0, 7),
);
const accounts = ref<Account[]>([]);
const report = ref<Monthly | null>(null);
const recent = ref<Transaction[]>([]);
const error = ref('');
const busy = ref(true);
const reviews = ref(0);
const unassigned = ref(false);
const importResult = ref<ImportRun | null>(null);
let loadVersion = 0;
let disposed = false;
const transactionCount = computed(
  /** Reports count only booked records excluding own transfers. */ () =>
    report.value?.categories.reduce(
      /** Sum the server's category counts. */ (total, category) => total + category.count,
      0,
    ) ?? 0,
);
const uncategorizedCount = computed(
  /** Keep unknown classifications visible rather than inventing a category. */ () =>
    report.value?.categories.find(
      /** The explicit null group is the uncategorized bucket. */ (category) => category.categoryId === null,
    )?.count ?? 0,
);
const transactionsLink = computed(
  /** Keep navigation in the displayed month. */ () =>
    `/transactions?${new URLSearchParams(monthRangeQuery(month.value))}`,
);
const uncategorizedLink = computed(
  /** Open real records awaiting a category. */ () => `${transactionsLink.value}&uncategorized=true`,
);
const monthPhase = computed(
  /** A month selector does not establish complete bank coverage, especially for current or future periods. */ () => {
    const current = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()).slice(0, 7);
    return month.value === current
      ? 'Laufender Monat · gebuchte Umsätze'
      : month.value > current
        ? 'Zukünftiger Monat · nur vorhandene Buchungen'
        : 'Kalendermonat · gebuchte Umsätze';
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
  month.value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()).slice(0, 7);
  await load();
}
/** Fetch dashboard data for the selected month and keep it bookmarkable. */
async function load() {
  if (disposed || route.path !== '/') return;
  const version = ++loadVersion;
  const selectedMonth = month.value;
  const requestedImport = typeof route.query.import === 'string' ? route.query.import : null;
  busy.value = true;
  error.value = '';
  try {
    const [a, r, t, runs, standalone] = await Promise.all([
      api.request('/accounts', z.array(accountSchema)),
      api.request('/analytics/monthly', monthlySchema, { query: { month: selectedMonth } }),
      api.request('/transactions', transactionPageSchema, {
        query: {
          status: 'BOOKED',
          limit: 10,
          ...monthRangeQuery(selectedMonth),
        },
      }),
      api.request('/imports', z.array(runSchema)),
      api.request('/transactions', transactionPageSchema, { query: { unassigned: 'true', limit: 1 } }),
    ]);
    if (disposed || version !== loadVersion || route.path !== '/') return;
    accounts.value = a;
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
    await router.replace({ query: { month: selectedMonth } });
  } catch (cause) {
    if (disposed || version !== loadVersion) return;
    report.value = null;
    error.value = userErrorMessage(cause);
  } finally {
    if (version === loadVersion) busy.value = false;
  }
}
onMounted(load);
onBeforeUnmount(
  /** A late dashboard response cannot rewrite another page's URL. */ () => {
    disposed = true;
    loadVersion++;
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>Finanzieller Überblick</h1>
    </div>
    <div class="toolbar finance-month-controls">
      <UButton variant="ghost" color="neutral" aria-label="Vorheriger Monat" @click="shiftMonth(-1)">‹</UButton>
      <MonthPicker v-model="month" @change="load" />
      <UButton variant="ghost" color="neutral" aria-label="Nächster Monat" @click="shiftMonth(1)">›</UButton>
      <UButton variant="ghost" @click="currentMonth">Dieser Monat</UButton>
      <UButton variant="ghost" :loading="busy" @click="load">Aktualisieren</UButton
      ><UButton to="/imports/csv">CSV hochladen</UButton>
    </div>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <UAlert
    v-if="importResult"
    role="status"
    color="success"
    title="Datei ausgewertet"
    :description="`${importResult.importedCount} neue Buchungen übernommen · ${importResult.knownCount} bereits bekannt. Deine Monatszahlen sind aktualisiert.`"
    class="mb-5"
  />
  <p v-if="busy" role="status" class="muted">Dein Monat wird geladen …</p>
  <template v-else-if="report && !error">
    <p class="overview-month-phase">{{ monthPhase }}</p>
    <div class="stats-grid finance-overview-stats">
      <section class="stat-card balance-card month-balance">
        <p>{{ monthName(month) }} · Monatsbilanz</p>
        <strong class="overview-net">{{ money(report.netCents) }}</strong
        ><small>Gebuchte Einnahmen minus Ausgaben</small
        ><small>{{ money(report.deltaCents) }} Veränderung zum Vormonat</small>
      </section>
      <section class="stat-card">
        <p>Einnahmen</p>
        <strong class="positive">{{ money(report.incomeCents) }}</strong
        ><small>Das ist diesen Monat reingekommen.</small>
      </section>
      <section class="stat-card">
        <p>Ausgaben</p>
        <strong>{{ money(report.expenseCents) }}</strong
        ><small>Das hast du diesen Monat ausgegeben.</small>
      </section>
    </div>
    <div class="data-context">
      <span
        >{{ transactionCount }} gebuchte Umsätze · eigene Umbuchungen und vorgemerkte Zahlungen nicht mitgerechnet</span
      ><span>Auch Buchungen ohne Konto zählen mit.</span>
    </div>
    <div v-if="reviews || uncategorizedCount" class="review-summary" aria-label="Nächste Schritte">
      <NuxtLink v-if="reviews" to="/imports">{{ reviews }} Buchungen klären</NuxtLink
      ><NuxtLink v-if="uncategorizedCount" :to="uncategorizedLink"
        >{{ uncategorizedCount }} Kategorien ergänzen (freiwillig)</NuxtLink
      >
    </div>
    <OverviewColumns>
      <template #bookings>
        <SectionPanel title="Letzte Buchungen" icon="transactions" data-overview-section="bookings">
          <div class="panel-heading">
            <NuxtLink :to="transactionsLink" class="text-link">Alle anzeigen</NuxtLink>
          </div>
          <p v-if="!recent.length" class="empty-copy">
            In diesem Monat sind noch keine Buchungen vorhanden. Lade eine Datei hoch oder wähle einen anderen Monat.
          </p>
          <NuxtLink v-for="row in recent" :key="row.id" :to="`/transactions/${row.id}`" class="transaction-row"
            ><span class="transaction-icon"><FinanceIcon name="transactions" /></span>
            <div>
              <strong>{{ row.counterpartyName || row.description }}</strong
              ><small>{{ calendarDate(row.bookingDate) }} · {{ row.description }}</small
              ><small>{{
                row.isTransfer
                  ? 'Eigene Umbuchung'
                  : (report.categories.find((c) => c.categoryId === row.categoryId)?.name ?? 'Nicht kategorisiert')
              }}</small>
            </div>
            <strong :class="BigInt(row.amountCents) > 0n ? 'positive' : ''">{{
              money(row.amountCents)
            }}</strong></NuxtLink
          >
        </SectionPanel>
      </template>
      <template #payments><UpcomingContracts data-overview-section="payments" /></template>
      <template #accounts>
        <SectionPanel title="Deine Konten" icon="accounts" data-overview-section="accounts">
          <div class="panel-heading">
            <NuxtLink to="/accounts" class="text-link">Verwalten</NuxtLink>
          </div>
          <div class="accounts-summary">
            <small>Bekannte Kontostände</small
            ><strong>{{ balances.length ? money(knownBalance) : 'Noch kein Saldo' }}</strong
            ><small>{{ balances.length }} von {{ activeCount }} aktiven Konten · von der Bank gemeldet</small>
          </div>
          <p v-if="!accounts.length" class="muted text-sm my-5">
            Noch keine Konten. CSV-Import funktioniert auch ohne Konto.
          </p>
          <NuxtLink v-for="account in accounts" :key="account.id" :to="`/accounts/${account.id}`" class="account-row"
            ><span class="account-icon"><FinanceIcon name="accounts" /></span>
            <div>
              <strong>{{ account.name }}</strong
              ><small
                >{{ account.iban ? `•••• ${account.iban.slice(-4)}` : 'Manuelles Konto' }} ·
                {{ account.isActive ? 'Aktiv' : 'Inaktiv' }}</small
              ><small>{{ observedTime(account.balances[0]?.observedAt ?? null) }}</small
              ><small
                v-if="account.balances[0] && Date.now() - Date.parse(account.balances[0].observedAt) > 48 * 3600000"
                class="negative"
                >Saldo älter als 48 Stunden</small
              >
            </div>
            <strong>{{
              account.balances.find((b) => b.balanceType === 'BOOKED')
                ? money(account.balances.find((b) => b.balanceType === 'BOOKED')!.amountCents)
                : 'Kein Saldo'
            }}</strong></NuxtLink
          >
          <HelpPopover
            title="Kontostände"
            text="CSV-Dateien liefern Umsätze. Bankgemeldete Kontostände bleiben von der Monatsbilanz getrennt."
          />
          <NuxtLink v-if="unassigned" to="/transactions?unassigned=true" class="text-link"
            >Buchungen ohne Konto ansehen</NuxtLink
          >
        </SectionPanel>
      </template>
      <template #categories><ExpenseBreakdown :report="report" data-overview-section="categories" /></template>
    </OverviewColumns>
    <UButton to="/analytics" variant="soft" class="mt-5">Mehrmonatsanalyse öffnen</UButton>
  </template>
</template>
