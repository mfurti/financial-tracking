<script setup lang="ts">
import { z } from 'zod';
import {
  accountSchema,
  monthlySchema,
  transactionPageSchema,
  runSchema,
  type Account,
  type Monthly,
  type Transaction,
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
let loadVersion = 0;
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
/** Fetch dashboard data for the selected month and keep it bookmarkable. */
async function load() {
  const version = ++loadVersion;
  const selectedMonth = month.value;
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
          from: `${selectedMonth}-01`,
          to: new Date(Date.UTC(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0))
            .toISOString()
            .slice(0, 10),
        },
      }),
      api.request('/imports', z.array(runSchema)),
      api.request('/transactions', transactionPageSchema, { query: { unassigned: 'true', limit: 1 } }),
    ]);
    if (version !== loadVersion) return;
    accounts.value = a;
    report.value = r;
    recent.value = t.items;
    reviews.value = runs.reduce(
      /** Include actionable duplicate reviews across the visible import history. */ (total, run) =>
        total + run.reviewRequiredCount,
      0,
    );
    unassigned.value = standalone.items.length > 0;
    await router.replace({ query: { month: selectedMonth } });
  } catch (cause) {
    if (version !== loadVersion) return;
    report.value = null;
    error.value = (cause as Error).message;
  } finally {
    if (version === loadVersion) busy.value = false;
  }
}
onMounted(load);
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">DEIN MONAT AUF EINEN BLICK</p>
      <h1>Finanzieller Überblick</h1>
      <p class="muted">Klarheit über das, was reinkommt und rausgeht.</p>
    </div>
    <div class="toolbar">
      <UInput v-model="month" aria-label="Monat" type="month" @change="load" /><UButton
        variant="soft"
        :loading="busy"
        @click="load"
        >Aktualisieren</UButton
      ><UButton to="/imports/csv">CSV importieren <span aria-hidden="true">↗</span></UButton>
    </div>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <p v-if="busy" role="status" class="muted">Übersicht wird geladen …</p>
  <template v-else-if="report">
    <div v-if="reviews || unassigned" class="review-summary" aria-label="Nächste Schritte">
      <NuxtLink v-if="reviews" to="/imports">{{ reviews }} offene Importprüfungen</NuxtLink>
      <NuxtLink v-if="unassigned" to="/transactions?unassigned=true">Ohne Konto · später zuordnen</NuxtLink>
    </div>
    <div class="stats-grid">
      <section class="stat-card balance-card">
        <p>Bekannte Kontostände</p>
        <strong>{{ balances.length ? money(knownBalance) : 'Noch kein Saldo' }}</strong
        ><small>{{ balances.length }} von {{ activeCount }} aktiven Konten · gebucht</small
        ><small>Bankgemeldet · keine Summe deiner CSV-Umsätze</small>
      </section>
      <section class="stat-card">
        <p>Einnahmen</p>
        <strong class="positive">{{ money(report.incomeCents) }}</strong
        ><small>Gebuchte Eingänge · inklusive Ohne Konto</small>
      </section>
      <section class="stat-card">
        <p>Ausgaben</p>
        <strong>{{ money(report.expenseCents) }}</strong
        ><small>Ohne eigene Umbuchungen</small>
      </section>
      <section class="stat-card">
        <p>Monatssaldo</p>
        <strong :class="BigInt(report.netCents) >= 0n ? 'positive' : 'negative'">{{ money(report.netCents) }}</strong
        ><small>{{ money(report.deltaCents) }} zum Vormonat</small>
      </section>
    </div>
    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-heading">
          <h2>Ausgaben nach Kategorien</h2>
          <span class="subtle-tag">Dieser Monat</span>
        </div>
        <div v-if="!report.categories.length" class="empty-state">
          <span aria-hidden="true">⊞</span>
          <h3>Noch keine Buchungen</h3>
          <p>Importiere Umsätze, um deinen Monat zu entdecken.</p>
          <UButton to="/imports/csv" variant="soft">Ersten Import starten</UButton>
        </div>
        <div v-for="category in report.categories" :key="category.categoryId ?? 'uncategorized'" class="category-bar">
          <div>
            <span>{{ category.name }}</span
            ><strong>{{ money(category.expenseCents) }}</strong>
          </div>
          <div class="bar-track"><div :style="{ width: `${(category.expenseShare ?? 0) * 100}%` }" /></div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-heading">
          <h2>Deine Konten</h2>
          <NuxtLink to="/accounts" class="text-link">Verwalten ↗</NuxtLink>
        </div>
        <p v-if="!accounts.length" class="empty-copy">
          CSV funktioniert auch ohne Konto. Ein Konto kannst du später anlegen und zuordnen.
        </p>
        <NuxtLink v-for="account in accounts" :key="account.id" :to="`/accounts/${account.id}`" class="account-row"
          ><span class="account-icon">▣</span>
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
      </section>
    </div>
    <section class="panel mt-6">
      <div class="panel-heading">
        <h2>Letzte Buchungen</h2>
        <NuxtLink to="/transactions" class="text-link">Alle Umsätze ↗</NuxtLink>
      </div>
      <p v-if="!recent.length" class="empty-copy">Noch keine gebuchten Umsätze in diesem Monat.</p>
      <NuxtLink v-for="row in recent" :key="row.id" :to="`/transactions/${row.id}`" class="transaction-row"
        ><span class="transaction-icon">{{ BigInt(row.amountCents) > 0n ? '↙' : '↗' }}</span>
        <div>
          <strong>{{ row.counterpartyName || row.description }}</strong
          ><small>{{ calendarDate(row.bookingDate) }} · {{ row.description }}</small>
        </div>
        <strong :class="BigInt(row.amountCents) > 0n ? 'positive' : ''">{{ money(row.amountCents) }}</strong></NuxtLink
      >
    </section>
  </template>
</template>
