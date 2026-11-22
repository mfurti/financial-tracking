<script setup lang="ts">
import { z } from 'zod';
import { userErrorMessage } from '../../utils/api-error';
import { financeReturnTarget } from '../../utils/finance-return';
import { transactionSortFields } from '../../utils/ledger-table-route';
import {
  accountSchema,
  categorySchema,
  transactionSchema,
  transactionTablePageSchema,
  transactionTableFilterSchema,
  bulkCategorySchema,
  assignmentResultSchema,
  type Account,
  type Category,
  type Transaction,
} from '@financial-tracking/contracts';

const api = useApi();
const route = useRoute();
const router = useRouter();
const detail = ref<Transaction | null>(null);
const accounts = ref<Account[]>([]);
const categories = ref<Category[]>([]);
const selected = ref<string[]>([]);
const returnTarget = computed(
  /** Restore only an explicitly supported, validated local financial view. */ () =>
    financeReturnTarget(route.query.returnTo),
);
const bulkCategory = ref('');
/** Keep a Nuxt UI checkbox selection explicit and stable across refreshes. */
function selectTransaction(id: string, checked: boolean | 'indeterminate') {
  selected.value =
    checked === true
      ? [...new Set([...selected.value, id])]
      : selected.value.filter(/** Remove only the deselected transaction. */ (value) => value !== id);
}
const error = ref('');
const busy = ref(false);
let loadGeneration = 0;
let disposed = false;
const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()).slice(0, 7);
const filter = reactive(readRouteFilters());
const allMonths = ref(route.query.period === 'all' && !filter.from && !filter.to);
const month = ref(currentMonth);
const monthCaption = ref<string>();
const advancedFilters = ref(false);
let scopeSearchQueued = false;
const listRowSchema = transactionSchema.omit({ counterpartyIban: true });
const listing = useLedgerTable({
  endpoint: 'transactions/table',
  schema: transactionTablePageSchema.extend({ items: z.array(listRowSchema) }),
  fields: Object.keys(listRowSchema.shape),
  sortable: transactionSortFields,
  /** Apply only the current bookmark, keeping unsubmitted filter drafts out of fetches. */
  filters: () => {
    const applied = readRouteFilters();
    return serializeFilters(applied, !(route.query.period === 'all' && !applied.from && !applied.to));
  },
  afterLoad: restoreBookingFocus,
});
const {
  items: rows,
  page: tablePage,
  sorting: tableSorting,
  itemsPerPage: tableSize,
  totalItems: tableTotal,
} = listing;
const sortFields = [
  { value: 'bookingDate', label: tr('Buchungsdatum') },
  { value: 'amountCents', label: tr('Betrag') },
  { value: 'description', label: tr('Buchungstext') },
];
const listError = computed(
  /** Show only normalized errors from the table transport. */ () =>
    !route.params.id && listing.error.value ? userErrorMessage(listing.error.value) : '',
);
const listBusy = computed(
  /** Distinguish an unfinished first read from an empty result. */ () =>
    listing.loading.value || (!listing.loaded.value && !listing.error.value && !error.value),
);
const groupByDate = computed(
  /** Preserve the actual sort order when amounts or labels take precedence. */ () =>
    !tableSorting.value.length || tableSorting.value[0]?.id === 'bookingDate',
);
const days = computed(
  /** Group date-sorted pages, keeping every other sort in server order. */ () =>
    groupByDate.value
      ? Object.entries(Object.groupBy(rows.value, (row) => row.bookingDate))
      : rows.value.map((row) => [row.bookingDate, [row]] as const),
);
let lastFocus = '';
syncMonth();

/** Read URL filters independently of the effective default month. */
function readRouteFilters() {
  const q = route.query;
  return {
    accountId: q.unassigned === 'true' ? 'UNASSIGNED' : String(q.accountId ?? ''),
    groupId: String(q.groupId ?? ''),
    from: String(q.from ?? ''),
    to: String(q.to ?? ''),
    search: String(q.search ?? ''),
    status: String(q.status ?? ''),
    categoryId: String(q.categoryId ?? ''),
    direction: String(q.direction ?? ''),
    classification: String(q.classification ?? ''),
    merchantKey: String(q.merchantKey ?? ''),
    uncategorized: q.uncategorized === 'true',
    excludeTransfers: q.excludeTransfers === 'true',
  };
}

/** Use the month name only when the applied filter covers that exact calendar month. */
function syncMonth() {
  const from = filter.from || filter.to;
  const anchor = from.slice(0, 7);
  month.value = /^\d{4}-(0[1-9]|1[0-2])$/.test(anchor) ? anchor : currentMonth;
  const range = monthRangeQuery(month.value);
  monthCaption.value = from
    ? filter.from === range.from && filter.to === range.to
      ? undefined
      : 'Eigener Zeitraum'
    : allMonths.value
      ? 'Alle Monate'
      : undefined;
}

/** Apply an inclusive month while preserving independent account and category filters. */
async function applyMonth(offset = 0) {
  const date = new Date(`${month.value}-01T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return;
  date.setUTCMonth(date.getUTCMonth() + offset);
  month.value = date.toISOString().slice(0, 7);
  allMonths.value = false;
  Object.assign(filter, monthRangeQuery(month.value));
  await search();
}

/** Display a full date in the user's locale without shifting the booked date. */
function bookingDate(day: string) {
  return new Intl.DateTimeFormat(displayLocale(), { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );
}
const unassignedSelection = computed(
  /** Only genuinely unassigned selected transactions enter the explicit assignment workflow. */ () =>
    rows.value
      .filter(
        /** Never move an already assigned bank transaction implicitly. */ (row) =>
          row.accountId === null && selected.value.includes(row.id),
      )
      .map(/** Preserve transaction identity across a bulk selection. */ (row) => row.id),
);
/** Label genuine accountless records without inventing an account entry. */
function accountLabel(id: string | null) {
  return (
    accounts.value.find(/** Match only a real account UUID. */ (account) => account.id === id)?.name ?? tr('Ohne Konto')
  );
}
/** Return to the current scope, sort and page with focus on the row that opened the detail. */
function bookingLink(id: string) {
  const target = route.fullPath.split('#')[0] + '#booking-' + id;
  return `/transactions/${id}?${new URLSearchParams({ returnTo: target })}`;
}

/** Focus the original row once it is ready, falling back to the table heading if it was removed. */
async function restoreBookingFocus() {
  if (!/^#booking-[a-f0-9-]{36}$/i.test(route.hash) || lastFocus === route.fullPath) return;
  lastFocus = route.fullPath;
  await nextTick();
  (document.getElementById(route.hash.slice(1)) ?? document.getElementById('ledger-transactions-title'))?.focus();
}

/** Serialize supported ledger filters and the default Berlin month for server-side querying. */
function serializeFilters(values: ReturnType<typeof readRouteFilters>, includeDefaultMonth: boolean) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === 'accountId' && value === 'UNASSIGNED') result.unassigned = 'true';
    else if (value) result[key] = String(value);
  }
  if (includeDefaultMonth && !values.from && !values.to) Object.assign(result, monthRangeQuery(currentMonth));
  return result;
}

/** Refresh the current table or reload the selected detail. */
async function load() {
  if (disposed) return;
  error.value = '';
  if (!route.params.id) {
    selected.value = [];
    await listing.refresh();
    return;
  }
  const generation = ++loadGeneration;
  const requestedPath = route.path;
  busy.value = true;
  try {
    const transaction = await api.request(`/transactions/${route.params.id}`, transactionSchema);
    if (!disposed && generation === loadGeneration && route.path === requestedPath) detail.value = transaction;
  } catch (cause) {
    if (!disposed && generation === loadGeneration) error.value = userErrorMessage(cause);
  } finally {
    if (!disposed && generation === loadGeneration) busy.value = false;
  }
}

/** Validate the draft and bookmark the applied first page. */
async function search() {
  try {
    if (allMonths.value) Object.assign(filter, { from: '', to: '' });
    const q = transactionTableFilterSchema.parse(serializeFilters(filter, false));
    const next = {
      query: {
        ...q,
        period: allMonths.value ? 'all' : undefined,
        mode: route.query.mode,
        sort: route.query.sort,
        perPage: route.query.perPage,
      },
    };
    if (router.resolve(next).fullPath === route.fullPath) {
      syncMonth();
      await load();
    } else await router.push(next);
  } catch {
    error.value = tr('Bitte Filter und Zeitraum prüfen.');
  }
}
watch(
  /** Restore the form from its canonical bookmark. */ () => route.fullPath,
  /** A route change scopes new results and clears stale selection. */ () => {
    if (route.path !== '/transactions') return;
    Object.assign(filter, readRouteFilters());
    allMonths.value = route.query.period === 'all' && !filter.from && !filter.to;
    syncMonth();
    selected.value = [];
    error.value = '';
  },
);

/** The account picker updates group and account together; submit the combined scope once. */
async function searchScope() {
  if (scopeSearchQueued) return;
  scopeSearchQueued = true;
  await nextTick();
  scopeSearchQueued = false;
  await search();
}
/** Save a category chosen in either transaction view. */
async function assign(id: string, categoryId: string) {
  try {
    await api.request(`/transactions/${id}`, transactionSchema, {
      method: 'PATCH',
      body: { categoryId: categoryId || null },
    });
    await load();
  } catch (cause) {
    error.value = userErrorMessage(cause);
  }
}
/** Save a single transfer marker without changing financial values. */
async function mark(row: Transaction) {
  try {
    await api.request(`/transactions/${row.id}`, transactionSchema, {
      method: 'PATCH',
      body: { isTransfer: !row.isTransfer },
    });
    await load();
  } catch (cause) {
    error.value = userErrorMessage(cause);
  }
}
/** Assign a category to the explicit selected IDs. */
async function bulk() {
  try {
    const body = bulkCategorySchema.parse({ ids: selected.value, categoryId: bulkCategory.value || null });
    await api.request('/transactions/bulk-category', z.object({ updated: z.number() }), { method: 'POST', body });
    await load();
  } catch (cause) {
    error.value = userErrorMessage(cause);
  }
}
/** Link selected opposing own-account entries after backend validation. */
async function transfer() {
  try {
    await api.request('/transfers', z.object({ id: z.uuid() }), {
      method: 'POST',
      body: { transactionIds: selected.value },
    });
    await load();
  } catch (cause) {
    error.value = userErrorMessage(cause);
  }
}
/** Resolve category labels including deleted assignments. */
function categoryName(id: string | null) {
  return (
    categories.value.find(/** Match by stable ID. */ (category) => category.id === id)?.name ??
    tr('Nicht kategorisiert')
  );
}
/** Follow the surviving logical transaction after a merge, or refresh the current list. */
async function assigned(result: z.infer<typeof assignmentResultSchema>) {
  if (detail.value) {
    const destination = result.results.find(
      /** Resolve the reviewed detail's final identity. */ (entry) => entry.transactionId === detail.value?.id,
    )?.resultingId;
    if (destination && destination !== detail.value.id) {
      await navigateTo(`/transactions/${destination}`);
      return;
    }
  }
  await load();
}
/** Load reference choices before the adapter begins its initial table request. */
async function initialize() {
  error.value = '';
  try {
    [accounts.value, categories.value] = await Promise.all([
      api.request('/accounts', z.array(accountSchema)),
      api.request('/categories', z.array(categorySchema)),
    ]);
    if (route.params.id) await load();
    else await listing.start();
  } catch (cause) {
    error.value = userErrorMessage(cause);
  }
}
onMounted(initialize);
onBeforeUnmount(
  /** Ignore results owned by the previous list/detail after the user navigates away. */ () => {
    disposed = true;
    loadGeneration++;
  },
);
</script>

<template>
  <div class="page-heading finance-period-heading">
    <div>
      <h1 id="ledger-transactions-title" tabindex="-1">{{ route.params.id ? tr('Umsatzdetails') : tr('Umsätze') }}</h1>
    </div>
    <div v-if="!route.params.id" class="toolbar finance-month-controls">
      <UButton
        variant="ghost"
        color="neutral"
        class="finance-month-step"
        :aria-label="tr('Vorheriger Monat')"
        @click="applyMonth(-1)"
        >‹</UButton
      >
      <MonthPicker v-model="month" :caption="monthCaption" compact @change="applyMonth()" />
      <UButton
        variant="ghost"
        color="neutral"
        class="finance-month-step"
        :aria-label="tr('Nächster Monat')"
        @click="applyMonth(1)"
        >›</UButton
      >
    </div>
    <UButton v-else :to="returnTarget ?? '/transactions'" variant="soft">{{
      route.params.id
        ? returnTarget?.startsWith('/analytics/details?')
          ? tr('Zur Analyse zurück')
          : tr('Alle Umsätze')
        : tr('CSV importieren')
    }}</UButton>
  </div>
  <UAlert v-if="error || listError" role="alert" color="error" :description="error || listError" class="mb-5" />
  <SectionPanel v-if="detail" :title="detail.description" icon="transactions" compact>
    <FinanceTile
      variant="stat"
      :label="detail.status === 'PENDING' ? tr('Vorgemerkt') : tr('Gebucht')"
      :value="money(detail.amountCents)"
      financial
    />
    <dl class="detail-list">
      <dt>{{ tr('Buchungsdatum') }}</dt>
      <dd>{{ calendarDate(detail.bookingDate) }}</dd>
      <dt>{{ tr('Konto') }}</dt>
      <dd>{{ accountLabel(detail.accountId) }}</dd>
      <dt>{{ tr('Wertstellung') }}</dt>
      <dd>{{ detail.valueDate ? calendarDate(detail.valueDate) : tr('Nicht geliefert') }}</dd>
      <dt>{{ tr('Gegenpartei') }}</dt>
      <dd>{{ detail.counterpartyName || tr('Nicht geliefert') }}</dd>
      <dt>{{ tr('Gegenkonto') }}</dt>
      <dd>{{ detail.counterpartyIban || tr('Nicht geliefert') }}</dd>
      <dt>{{ tr('Kategorie') }}</dt>
      <dd>{{ categoryName(detail.categoryId) }}</dd>
    </dl>
    <UButton v-if="detail.contract" :to="`/contracts/${detail.contract.id}`" size="sm" variant="soft" class="mt-4"
      >{{ tr('Vertrag:') }} {{ detail.contract.name }}</UButton
    >
    <div class="toolbar mt-5">
      <ChoiceSelect
        :model-value="detail.categoryId ?? ''"
        :aria-label="tr('Kategorie zuordnen')"
        :searchable="true"
        :items="[
          { label: tr('Nicht kategorisiert'), value: '' },
          ...categories.map(
            /** Build a persisted choice. */ (category) => ({ label: `${category.name}`, value: category.id }),
          ),
        ]"
        @update:model-value="assign(detail.id, $event)"
      /><UButton variant="soft" @click="mark(detail)">{{
        detail.isTransfer ? tr('Umbuchung aufheben') : tr('Als Umbuchung markieren')
      }}</UButton>
    </div>
  </SectionPanel>
  <ClassificationEditor v-if="detail" :ids="[detail.id]" :value="detail.classification" @changed="load()" />
  <AccountAssignment
    v-if="detail?.accountId === null"
    :transaction-ids="[detail.id]"
    :accounts="accounts"
    :categories="categories"
    @complete="assigned"
  />

  <AccountAssignment
    v-if="!route.params.id"
    :transaction-ids="unassignedSelection"
    :accounts="accounts"
    :categories="categories"
    @complete="assigned"
  />
  <template v-if="!route.params.id"
    ><div class="finance-transaction-filter-area">
      <p v-if="route.query.mode === 'transfer'" class="muted">
        {{ tr('Zwei Buchungen für eine Umbuchung auswählen.') }}
      </p>
      <p v-if="filter.merchantKey" class="data-context">
        {{ tr('Exakter Händlerfilter aktiv. Die Suche erweitert diesen Filter nicht.') }}
      </p>
      <form class="finance-transaction-filters" :aria-label="tr('Umsätze filtern')" @submit.prevent="search">
        <label
          >{{ tr('Suche')
          }}<UInput
            v-model="filter.search"
            :placeholder="tr('Name oder Buchung')"
            :aria-label="tr('Umsätze durchsuchen')"
            ><template #trailing>
              <button v-if="!advancedFilters" type="submit" class="finance-search-submit" :aria-label="tr('Filtern')">
                <FinanceIcon name="search" />
              </button> </template></UInput></label
        ><label
          >{{ tr('Konto') }}<!-- Build a persisted choice. --><AccountScopeSelect
            v-model:account-id="filter.accountId"
            v-model:group-id="filter.groupId"
            searchable
            :accounts="accounts"
            @update:account-id="searchScope"
            @update:group-id="searchScope" /></label
        ><label
          >{{ tr('Kategorie')
          }}<ChoiceSelect
            v-model="filter.categoryId"
            :searchable="true"
            :items="[
              { label: tr('Alle Kategorien'), value: '' },
              ...categories.map(
                /** Build a persisted choice. */ (category) => ({ label: `${category.name}`, value: category.id }),
              ),
            ]"
            @update:model-value="search"
        /></label>
      </form>
      <UPopover v-model:open="advancedFilters">
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          class="transaction-filter-trigger"
          :aria-label="tr('Weitere Filter')"
          ><FinanceIcon name="filter" /><span class="sr-only">{{ tr('Weitere Filter') }}</span></UButton
        >
        <template #content>
          <form
            class="finance-advanced-filters"
            @submit.prevent="
              search();
              advancedFilters = false;
            "
          >
            <div class="filter-grid">
              <label
                >{{ tr('Von')
                }}<DatePicker v-model="filter.from" :label="tr('Von')" @update:model-value="allMonths = false"
              /></label>
              <label
                >{{ tr('Bis')
                }}<DatePicker v-model="filter.to" :label="tr('Bis')" @update:model-value="allMonths = false"
              /></label>
              <label
                >{{ tr('Status')
                }}<ChoiceSelect
                  v-model="filter.status"
                  :searchable="false"
                  :items="[
                    { label: tr('Alle Buchungen'), value: '' },
                    { label: tr('Gebucht'), value: 'BOOKED' },
                    { label: tr('Vorgemerkt'), value: 'PENDING' },
                  ]" /></label
              ><label
                >{{ tr('Richtung')
                }}<ChoiceSelect
                  v-model="filter.direction"
                  :searchable="false"
                  :items="[
                    { label: tr('Einnahmen & Ausgaben'), value: '' },
                    { label: tr('Einnahmen'), value: 'INCOME' },
                    { label: tr('Ausgaben'), value: 'EXPENSE' },
                  ]"
              /></label>
              <UFormField :label="tr('Fix/Variabel')"
                ><ChoiceSelect
                  v-model="filter.classification"
                  :searchable="false"
                  :items="[
                    { label: tr('Alle Kennzeichnungen'), value: '' },
                    { label: tr('Fix'), value: 'FIXED' },
                    { label: tr('Variabel'), value: 'VARIABLE' },
                    { label: tr('Nicht eingeordnet'), value: 'UNCLASSIFIED' },
                  ]"
              /></UFormField>
              <div class="toolbar">
                <UCheckbox v-model="allMonths" :label="tr('Alle Monate')" />
                <UCheckbox v-model="filter.uncategorized" :label="tr('Ohne Kategorie')" /><UCheckbox
                  v-model="filter.excludeTransfers"
                  :label="tr('Ohne Umbuchungen')"
                />
              </div>
            </div>
            <div class="toolbar">
              <UButton type="submit" variant="soft" :loading="busy">{{ tr('Filtern') }}</UButton>
              <UButton to="/imports/csv" variant="ghost">{{ tr('CSV importieren') }}</UButton>
            </div>
          </form>
        </template>
      </UPopover>
    </div>
    <SectionPanel :title="tr('Buchungen')" compact :aria-busy="listBusy">
      <LedgerTableSorting v-model="tableSorting" :fields="sortFields" />
      <UButton v-if="listError || error" variant="soft" class="mb-4" @click="initialize">{{
        tr('Erneut versuchen')
      }}</UButton>
      <div v-if="selected.length" class="toolbar mb-5">
        <span>{{ selected.length }} {{ tr('ausgewählt') }}</span
        ><ChoiceSelect
          v-model="bulkCategory"
          :aria-label="tr('Kategorie für Auswahl')"
          :searchable="true"
          :items="[
            { label: tr('Nicht kategorisiert'), value: '' },
            ...categories.map(
              /** Build a persisted choice. */ (category) => ({ label: `${category.name}`, value: category.id }),
            ),
          ]"
        /><UButton @click="bulk">{{ tr('Kategorie zuweisen') }}</UButton
        ><UButton :disabled="selected.length > 2" variant="soft" @click="transfer">{{
          tr('Umbuchung verknüpfen')
        }}</UButton>
      </div>
      <ClassificationEditor v-if="selected.length" :ids="selected" @changed="load()" />
      <p role="status" class="ledger-load-status">{{ listBusy ? tr('Umsätze werden geladen …') : '' }}</p>
      <p v-if="listing.loaded.value && !listBusy && !listError && !rows.length" class="empty-copy">
        {{
          route.query.search || route.query.categoryId || route.query.direction || route.query.groupId
            ? tr('Keine Buchungen für diese Auswahl.')
            : tr('Keine Umsätze gefunden. Passe deine Filter an oder importiere Buchungen.')
        }}
      </p>
      <div v-for="[day, bookings] in days" :key="`${day}:${bookings?.[0]?.id}`" class="finance-booking-day">
        <h3 v-if="groupByDate">{{ bookingDate(day) }}</h3>
        <div v-for="row in bookings" :key="row.id" class="ledger-row finance-booking-row">
          <UCheckbox
            :model-value="selected.includes(row.id)"
            :aria-label="tr('{0} auswählen', [row.description])"
            @update:model-value="selectTransaction(row.id, $event)"
          />
          <div class="ledger-description">
            <NuxtLink :id="`booking-${row.id}`" :to="bookingLink(row.id)"
              ><strong>{{ row.description }}</strong
              ><small
                ><template v-if="!groupByDate">{{ calendarDate(row.bookingDate) }} · </template
                >{{ categoryName(row.categoryId) }} · {{ accountLabel(row.accountId)
                }}<span v-if="row.isTransfer"> {{ tr('· Umbuchung') }}</span
                ><span v-if="row.status === 'PENDING'"> {{ tr('· Vorgemerkt') }}</span
                ><span v-if="row.categoryOrigin === 'RULE'"> {{ tr('· Regel:') }} {{ row.categoryRuleName }}</span
                ><span v-if="row.categoryRuleConflict">
                  {{ tr('· Kategorie klären: gleichrangige Regeln widersprechen sich') }}</span
                ><span v-if="row.effectiveClassification !== 'UNCLASSIFIED'">
                  · {{ row.effectiveClassification === 'FIXED' ? tr('Fix') : tr('Variabel') }}</span
                ></small
              ></NuxtLink
            ><UButton v-if="row.contract" :to="`/contracts/${row.contract.id}`" size="xs" variant="soft" class="mt-1">{{
              row.contract.name
            }}</UButton>
          </div>
          <ChoiceSelect
            :model-value="row.categoryId ?? ''"
            :aria-label="tr('Kategorie für {0}', [row.description])"
            :searchable="true"
            :items="[
              { label: tr('Nicht kategorisiert'), value: '' },
              ...categories.map(
                /** Build a persisted choice. */ (category) => ({ label: `${category.name}`, value: category.id }),
              ),
            ]"
            @update:model-value="assign(row.id, $event)"
          /><strong
            data-financial
            :class="BigInt(row.amountCents) > 0n ? 'positive' : BigInt(row.amountCents) < 0n ? 'negative' : ''"
            ><template v-if="!amountsMasked()">{{ money(row.amountCents) }}</template
            ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
          >
        </div>
      </div>
      <LedgerTablePagination
        v-if="tableTotal > 0"
        v-model:page="tablePage"
        :per-page="tableSize"
        :total="tableTotal"
        @page-size="listing.setPageSize"
      />
    </SectionPanel>
  </template>
</template>
