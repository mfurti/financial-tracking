<script setup lang="ts">
import { z } from 'zod';
import { userErrorMessage } from '../../utils/api-error';
import { financeReturnTarget } from '../../utils/finance-return';
import {
  accountSchema,
  categorySchema,
  transactionSchema,
  transactionPageSchema,
  transactionQuerySchema,
  bulkCategorySchema,
  assignmentResultSchema,
  type Account,
  type Category,
  type Transaction,
} from '@financial-tracking/contracts';

const api = useApi();
const route = useRoute();
const router = useRouter();
const rows = ref<Transaction[]>([]);
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
const nextCursor = ref<string | null>(null);
const error = ref('');
const busy = ref(false);
let loadGeneration = 0;
let disposed = false;
const filter = reactive({
  accountId: route.query.unassigned === 'true' ? 'UNASSIGNED' : String(route.query.accountId ?? ''),
  groupId: String(route.query.groupId ?? ''),
  from: String(route.query.from ?? ''),
  to: String(route.query.to ?? ''),
  search: String(route.query.search ?? ''),
  status: String(route.query.status ?? ''),
  categoryId: String(route.query.categoryId ?? ''),
  direction: String(route.query.direction ?? ''),
  classification: String(route.query.classification ?? ''),
  merchantKey: String(route.query.merchantKey ?? ''),
  uncategorized: route.query.uncategorized === 'true',
  excludeTransfers: route.query.excludeTransfers === 'true',
});
const month = ref(
  /^\d{4}-(0[1-9]|1[0-2])$/.test(String(route.query.from ?? '').slice(0, 7))
    ? String(route.query.from).slice(0, 7)
    : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()).slice(0, 7),
);
async function applyMonth(offset = 0) {
  const date = new Date(`${month.value}-01T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return;
  date.setUTCMonth(date.getUTCMonth() + offset);
  month.value = date.toISOString().slice(0, 7);
  Object.assign(filter, monthRangeQuery(month.value));
  await search();
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
/** Preserve the current filtered list when entering an individual booking without broadening the return scope. */
function bookingLink(id: string) {
  return `/transactions/${id}?${new URLSearchParams({ returnTo: route.fullPath })}`;
}
/** Serialize only nonempty filter values before schema validation. */
function query(cursor?: string) {
  const value: Record<string, string | undefined> = {};
  for (const [key, field] of Object.entries(filter)) {
    if (key === 'accountId' && field === 'UNASSIGNED') value.unassigned = 'true';
    else if (field) value[key] = String(field);
  }
  if (cursor) value.cursor = cursor;
  return transactionQuerySchema.parse(value);
}
/** Fetch one stable page or a selected transaction detail. */
async function load(append = false) {
  if (disposed) return;
  const generation = ++loadGeneration;
  const requestedPath = route.path;
  busy.value = true;
  error.value = '';
  try {
    if (route.params.id) {
      const transaction = await api.request(`/transactions/${route.params.id}`, transactionSchema);
      if (!disposed && generation === loadGeneration && route.path === requestedPath) detail.value = transaction;
    } else {
      const q = query(append ? (nextCursor.value ?? undefined) : undefined);
      const page = await api.request('/transactions', transactionPageSchema, { query: q });
      if (disposed || generation !== loadGeneration || route.path !== requestedPath) return;
      rows.value = append ? [...rows.value, ...page.items] : page.items;
      nextCursor.value = page.nextCursor;
      if (!append) selected.value = [];
    }
  } catch (cause) {
    if (!disposed && generation === loadGeneration) error.value = userErrorMessage(cause);
  } finally {
    if (!disposed && generation === loadGeneration) busy.value = false;
  }
}
/** Start a fresh filtered page from a form submission. */
async function search() {
  try {
    const q = query();
    await router.replace({
      query: Object.fromEntries(
        Object.entries(q).filter(
          /** Only an explicit filter submission changes the current URL. */ ([key, value]) =>
            key !== 'limit' && key !== 'cursor' && value !== undefined,
        ),
      ),
    });
    await load(false);
  } catch {
    error.value = tr('Bitte Filter und Zeitraum prüfen.');
  }
}
/** Request the next cursor page without resetting existing rows. */
async function more() {
  await load(true);
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
onMounted(
  /** Load reference choices and the initial financial view. */ async () => {
    try {
      [accounts.value, categories.value] = await Promise.all([
        api.request('/accounts', z.array(accountSchema)),
        api.request('/categories', z.array(categorySchema)),
      ]);
      await load();
    } catch (cause) {
      error.value = userErrorMessage(cause);
    }
  },
);
onBeforeUnmount(
  /** Ignore results owned by the previous list/detail after the user navigates away. */ () => {
    disposed = true;
    loadGeneration++;
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>{{ route.params.id ? tr('Umsatzdetails') : tr('Deine Umsätze') }}</h1>
    </div>
    <div v-if="!route.params.id" class="toolbar finance-month-controls">
      <UButton variant="ghost" color="neutral" :aria-label="tr('Vorheriger Monat')" @click="applyMonth(-1)">‹</UButton>
      <MonthPicker v-model="month" compact @change="applyMonth()" />
      <UButton variant="ghost" color="neutral" :aria-label="tr('Nächster Monat')" @click="applyMonth(1)">›</UButton>
    </div>
    <UButton v-else :to="returnTarget ?? '/transactions'" variant="soft">{{
      route.params.id
        ? returnTarget?.startsWith('/analytics/details?')
          ? tr('Zur Analyse zurück')
          : tr('Alle Umsätze')
        : tr('CSV importieren')
    }}</UButton>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
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
    ><div class="mb-5">
      <p v-if="filter.merchantKey" class="data-context">
        {{ tr('Exakter Händlerfilter aktiv. Die Suche erweitert diesen Filter nicht.') }}
      </p>
      <form class="finance-transaction-filters" :aria-label="tr('Umsätze filtern')" @submit.prevent="search">
        <label
          >{{ tr('Suche')
          }}<UInput
            v-model="filter.search"
            :placeholder="tr('Text oder Gegenpartei')"
            :aria-label="tr('Umsätze durchsuchen')" /></label
        ><label
          >{{ tr('Konto') }}<!-- Build a persisted choice. --><AccountScopeSelect
            v-model:account-id="filter.accountId"
            v-model:group-id="filter.groupId"
            searchable
            :accounts="accounts" /></label
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
        /></label>
        <details class="finance-advanced-filters">
          <summary>{{ tr('Weitere Filter') }}</summary>
          <div class="filter-grid">
            <label>{{ tr('Von') }}<DatePicker v-model="filter.from" :label="tr('Von')" /></label>
            <label>{{ tr('Bis') }}<DatePicker v-model="filter.to" :label="tr('Bis')" /></label>
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
              <UCheckbox v-model="filter.uncategorized" :label="tr('Ohne Kategorie')" /><UCheckbox
                v-model="filter.excludeTransfers"
                :label="tr('Ohne Umbuchungen')"
              />
            </div>
          </div>
        </details>
        <UButton type="submit" variant="soft" :loading="busy">{{ tr('Filtern') }}</UButton>
        <UButton to="/imports/csv" variant="ghost">{{ tr('CSV importieren') }}</UButton>
      </form>
    </div>
    <SectionPanel :title="tr('Buchungen')" bare>
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
      <p role="status" class="ledger-load-status">{{ busy ? tr('Umsätze werden geladen …') : '' }}</p>
      <p v-if="!busy && !rows.length" class="empty-copy">
        {{ tr('Keine Umsätze gefunden. Passe deine Filter an oder importiere Buchungen.') }}
      </p>
      <div v-for="row in rows" :key="row.id" class="ledger-row">
        <UCheckbox
          :model-value="selected.includes(row.id)"
          :aria-label="tr('{0} auswählen', [row.description])"
          @update:model-value="selectTransaction(row.id, $event)"
        />
        <div class="ledger-description">
          <NuxtLink :to="bookingLink(row.id)"
            ><strong>{{ row.description }}</strong
            ><small
              >{{ calendarDate(row.bookingDate) }} · {{ row.counterpartyName || tr('Keine Gegenpartei')
              }}<span v-if="row.isTransfer"> {{ tr('· Umbuchung') }}</span
              ><span v-if="row.accountId === null"> {{ tr('· Ohne Konto') }}</span
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
        /><strong data-financial :class="BigInt(row.amountCents) > 0n ? 'positive' : ''"
          ><template v-if="!amountsMasked()">{{ money(row.amountCents) }}</template
          ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
        >
      </div>
      <UButton v-if="nextCursor" :loading="busy" variant="soft" class="mt-5" @click="more">{{
        tr('Weitere Umsätze laden')
      }}</UButton>
    </SectionPanel>
  </template>
</template>
