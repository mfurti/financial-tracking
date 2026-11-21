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
          limit: 5,
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
onBeforeRouteLeave(
  /** A pending navigation already owns the URL before its lazy component resolves; late overview reads must not cancel it. */ () => {
    loadVersion++;
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
  <div class="page-heading">
    <div>
      <h1>{{ tr('Finanzieller Überblick') }}</h1>
    </div>
    <div class="toolbar finance-month-controls">
      <UButton variant="ghost" color="neutral" :aria-label="tr('Vorheriger Monat')" @click="shiftMonth(-1)">‹</UButton>
      <MonthPicker v-model="month" compact @change="load" />
      <UButton variant="ghost" color="neutral" :aria-label="tr('Nächster Monat')" @click="shiftMonth(1)">›</UButton>
    </div>
  </div>
  <details class="finance-overview-actions">
    <summary>{{ tr('Weitere Aktionen') }}</summary>
    <div class="toolbar">
      <UButton variant="ghost" @click="currentMonth">{{ tr('Dieser Monat') }}</UButton>
      <UButton variant="ghost" :loading="busy" @click="load">{{ tr('Aktualisieren') }}</UButton
      ><UButton to="/imports/csv">{{ tr('CSV hochladen') }}</UButton>
    </div>
  </details>
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
  <div v-if="busy" class="stats-grid finance-overview-stats" aria-busy="true">
    <FinanceTile
      v-for="label in ['Monatsbilanz', 'Einnahmen', 'Ausgaben']"
      :key="label"
      :label="label"
      variant="stat"
      state="loading"
    />
  </div>
  <template v-else-if="report && !error">
    <p class="overview-month-phase">{{ monthPhase }}</p>
    <div class="stats-grid finance-overview-stats">
      <FinanceTile :label="tr('Monatsbilanz')" variant="stat" class="month-balance">
        <template #value
          ><span class="overview-net" data-financial
            ><template v-if="!amountsMasked()">{{ money(report.netCents) }}</template
            ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></span
          ></template
        >
        <template #context
          ><span data-financial
            ><template v-if="!amountsMasked()">{{ money(report.deltaCents) }}</template
            ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></span
          >
          {{ tr('zum Vormonat') }}</template
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
    </div>
    <div class="data-context">
      <span>{{ transactionCount }} {{ tr('gebuchte Umsätze · inklusive Buchungen ohne Konto') }}</span>
      <HelpPopover
        :title="tr('Monatszahlen')"
        :text="
          tr(
            'Gebuchte Einnahmen minus Ausgaben. Eigene Umbuchungen und vorgemerkte Zahlungen zählen nicht mit. Auch Buchungen ohne Konto zählen mit.',
          )
        "
      />
    </div>
    <div v-if="reviews || uncategorizedCount" class="review-summary" :aria-label="tr('Nächste Schritte')">
      <NuxtLink v-if="reviews" to="/imports">{{ reviews }} {{ tr('Buchungen klären') }}</NuxtLink
      ><NuxtLink v-if="uncategorizedCount" :to="uncategorizedLink"
        >{{ uncategorizedCount }} {{ tr('Kategorien ergänzen (freiwillig)') }}</NuxtLink
      >
    </div>
    <OverviewColumns>
      <template #bookings>
        <SectionPanel :title="tr('Letzte Buchungen')" icon="transactions" compact data-overview-section="bookings">
          <p v-if="!recent.length" class="empty-copy">
            {{
              tr(
                'In diesem Monat sind noch keine Buchungen vorhanden. Lade eine Datei hoch oder wähle einen anderen Monat.',
              )
            }}
          </p>
          <NuxtLink v-for="row in recent" :key="row.id" :to="`/transactions/${row.id}`" class="transaction-row"
            ><span class="transaction-icon"><FinanceIcon name="transactions" /></span>
            <div>
              <strong>{{ row.counterpartyName?.trim() || row.description }}</strong>
              <small>
                {{
                  row.isTransfer
                    ? tr('Eigene Umbuchung')
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
            ></NuxtLink
          >
          <div class="section-action">
            <UButton :to="transactionsLink" variant="soft">{{ tr('Alle Umsätze') }}</UButton>
          </div>
        </SectionPanel>
      </template>
      <template #payments><UpcomingContracts data-overview-section="payments" /></template>
      <template #accounts>
        <SectionPanel
          :title="tr('Deine Konten')"
          icon="accounts"
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
                >{{ account.iban ? `•••• ${account.iban.slice(-4)}` : tr('Manuelles Konto') }} ·
                {{ account.isActive ? tr('Aktiv') : tr('Inaktiv') }}</small
              ><small>{{ observedTime(account.balances[0]?.observedAt ?? null) }}</small
              ><small
                v-if="account.balances[0] && Date.now() - Date.parse(account.balances[0].observedAt) > 48 * 3600000"
                class="negative"
                >{{ tr('Saldo älter als 48 Stunden') }}</small
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
      <template #categories><ExpenseBreakdown :report="report" compact data-overview-section="categories" /></template>
    </OverviewColumns>
    <UButton to="/analytics" variant="soft" class="mt-5">{{ tr('Mehrmonatsanalyse öffnen') }}</UButton>
  </template>
</template>
