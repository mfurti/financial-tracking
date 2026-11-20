<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
const api = useApi();
const route = useRoute();
const router = useRouter();
const applied = ref<z.infer<typeof c.analyticsDetailQuerySchema> | null>(null);
const report = ref<z.infer<typeof c.analyticsOverviewSchema> | null>(null);
const rows = ref<c.Transaction[]>([]);
const title = ref('Analyse-Details');
const scopeLabel = ref('');
const nextCursor = ref<string | null>(null);
const busy = ref(true);
const moreBusy = ref(false);
const error = ref('');
const moreError = ref('');
let generation = 0;
const total = computed(
  /** Read exact server aggregates for the displayed direction, independently of loaded page size. */ () =>
    !report.value || !applied.value
      ? null
      : applied.value.direction === 'INCOME'
        ? report.value.incomeCents
        : report.value.expenseCents,
);
const transactionLink = computed(
  /** The complete ledger view receives exactly the displayed scope and direction. */ () =>
    applied.value ? `/transactions?${parameters(transactionQuery(applied.value))}` : '/transactions',
);
const backLink = computed(
  /** Return to the originating report window/account/category while removing only merchant detail and direction. */ () => {
    if (!applied.value) return '/analytics';
    const { merchantKey: _merchant, direction: _direction, ...scope } = applied.value;
    void _merchant;
    void _direction;
    return `/analytics?${parameters(scope)}`;
  },
);

/** Serialize only validated defined transport fields, retaining explicit false and zero values. */
function parameters(query: Record<string, string | number | undefined>) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) result.set(key, String(value));
  return result.toString();
}
/** Keep a booking's back action tied to the current validated detail bookmark. */
function bookingLink(id: string) {
  return `/transactions/${id}?${parameters({ returnTo: route.fullPath })}`;
}
/** Match the aggregate's booked/non-transfer predicate before the existing cursor pagination. */
function transactionQuery(input: z.infer<typeof c.analyticsDetailQuerySchema>, cursor?: string) {
  return c.transactionQuerySchema.parse({ ...input, status: 'BOOKED', excludeTransfers: 'true', cursor });
}
/** Load one explicit bookmark, clearing old values and rejecting responses superseded by navigation. */
async function load() {
  const current = ++generation;
  busy.value = true;
  error.value = '';
  moreError.value = '';
  moreBusy.value = false;
  report.value = null;
  rows.value = [];
  applied.value = null;
  nextCursor.value = null;
  title.value = 'Analyse-Details';
  scopeLabel.value = '';
  try {
    const input = c.analyticsDetailQuerySchema.parse(route.query);
    const [overview, page, merchants, categories, accounts, groups] = await Promise.all([
      api.request('/analytics/overview', c.analyticsOverviewSchema, { query: input }),
      api.request('/transactions', c.transactionPageSchema, { query: transactionQuery(input) }),
      api.request('/analytics/merchants', c.merchantAnalyticsSchema, { query: input }),
      api.request('/categories', z.array(c.categorySchema)),
      api.request('/accounts', z.array(c.accountSchema)),
      input.groupId ? api.request('/account-groups', z.array(c.accountGroupSchema)) : Promise.resolve([]),
    ]);
    if (current !== generation) return;
    const account = accounts.find(
      /** Match the selected persisted account, never a text alias. */ (row) => row.id === input.accountId,
    );
    const category = categories.find(
      /** Match the selected persisted category, never a display name. */ (row) => row.id === input.categoryId,
    );
    const group = groups.find(
      /** Resolve only the saved group identity from the validated bookmark. */ (row) => row.id === input.groupId,
    );
    if ((input.accountId && !account) || (input.categoryId && !category) || (input.groupId && !group))
      throw new Error('Dieser Analysefilter ist nicht mehr verfügbar.');
    title.value =
      input.merchantKey === 'unknown'
        ? 'Unbekannter Händler'
        : input.merchantKey
          ? (merchants.merchants.find(
              /** Resolve merchant presentation from the server's canonical bucket. */ (row) =>
                row.key === input.merchantKey,
            )?.label ?? 'Händler im gewählten Zeitraum')
          : (category?.name ?? (input.uncategorized === 'true' ? 'Nicht kategorisiert' : 'Einnahmen und Ausgaben'));
    scopeLabel.value = `${input.unassigned === 'true' ? 'Ohne Konto' : group ? `Kontogruppe: ${group.name}` : (account?.name ?? 'Alle Konten')}${category && input.merchantKey ? ` · ${category.name}` : ''}`;
    report.value = overview;
    rows.value = page.items;
    nextCursor.value = page.nextCursor;
    applied.value = input;
  } catch (cause) {
    if (current === generation)
      error.value =
        cause instanceof z.ZodError
          ? 'Bitte einen gültigen Zeitraum und gültige Analysefilter wählen.'
          : userErrorMessage(cause);
  } finally {
    if (current === generation) busy.value = false;
  }
}
/** Change only the displayed direction and let bookmark navigation invalidate previous reads. */
async function direction(value: 'INCOME' | 'EXPENSE') {
  if (applied.value) await router.push({ query: { ...applied.value, direction: value } });
}
/** Append one stable cursor page only if it still belongs to the active aggregate scope. */
async function more() {
  if (!applied.value || !nextCursor.value || moreBusy.value) return;
  const current = generation,
    input = transactionQuery(applied.value, nextCursor.value);
  moreBusy.value = true;
  moreError.value = '';
  try {
    const page = await api.request('/transactions', c.transactionPageSchema, { query: input });
    if (current !== generation) return;
    rows.value = [...rows.value, ...page.items];
    nextCursor.value = page.nextCursor;
  } catch (cause) {
    if (current === generation) moreError.value = userErrorMessage(cause);
  } finally {
    if (current === generation) moreBusy.value = false;
  }
}
onMounted(load);
watch(
  /** React to back/forward, direction and scope changes without reusing an old aggregate. */ () => route.fullPath,
  load,
);
onBeforeUnmount(
  /** Invalidate all outstanding page and cursor reads when leaving details. */ () => {
    generation++;
  },
);
</script>

<template>
  <div class="page-heading">
    <h1>{{ title }}</h1>
    <UButton :to="backLink" variant="soft">Zur Auswertung zurück</UButton>
  </div>
  <p v-if="busy" role="status">Analyse wird geladen …</p>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" />
  <UButton v-if="error" :disabled="busy" @click="load">Erneut versuchen</UButton>
  <template v-if="report && applied && !busy">
    <p class="data-context">{{ calendarDate(applied.from) }} – {{ calendarDate(applied.to) }} · {{ scopeLabel }}</p>
    <div class="toolbar mb-5" role="group" aria-label="Buchungsrichtung">
      <UButton
        :aria-pressed="applied.direction === 'EXPENSE'"
        :variant="applied.direction === 'EXPENSE' ? 'soft' : 'ghost'"
        @click="direction('EXPENSE')"
        >Ausgaben anzeigen</UButton
      >
      <UButton
        :aria-pressed="applied.direction === 'INCOME'"
        :variant="applied.direction === 'INCOME' ? 'soft' : 'ghost'"
        @click="direction('INCOME')"
        >Einnahmen anzeigen</UButton
      >
    </div>
    <FinanceTile
      :label="applied.direction === 'INCOME' ? 'Gebuchte Einnahmen' : 'Gebuchte Ausgaben'"
      variant="stat"
      context="Ohne Umbuchungen und Vormerkungen. Erstattungen zählen als Einnahmen."
      ><template #value
        ><span data-analysis-total data-financial>{{ money(total!) }}</span></template
      ></FinanceTile
    >
    <SectionPanel title="Zugehörige Buchungen" icon="transactions" class="mt-6" compact>
      <NuxtLink v-for="row in rows" :key="row.id" :to="bookingLink(row.id)" class="transaction-row"
        ><FinanceIcon name="transactions" />
        <div>
          <strong>{{ row.description }}</strong
          ><small
            >{{ calendarDate(row.bookingDate) }} · {{ row.counterpartyName?.trim() || 'Keine Gegenpartei' }}</small
          >
        </div>
        <strong :class="BigInt(row.amountCents) < 0n ? 'negative' : 'positive'" data-financial>{{
          money(row.amountCents)
        }}</strong></NuxtLink
      >
      <p v-if="!rows.length" class="empty-copy">Keine zugehörigen Buchungen im gewählten Zeitraum.</p>
      <p v-if="moreError" role="alert">{{ moreError }}</p>
      <div class="section-action">
        <UButton v-if="nextCursor" :disabled="moreBusy" variant="soft" @click="more">{{
          moreBusy ? 'Wird geladen …' : 'Weitere Buchungen'
        }}</UButton
        ><UButton :to="transactionLink" variant="soft">Alle zugehörigen Umsätze</UButton>
      </div>
    </SectionPanel>
    <p class="muted mt-4">
      Vorhandene Buchungen belegen keine vollständige Bankhistorie. Die Summe umfasst den gesamten gewählten Zeitraum;
      die Liste wird seitenweise geladen.
    </p>
  </template>
</template>
