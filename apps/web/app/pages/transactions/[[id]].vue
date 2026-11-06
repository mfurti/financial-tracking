<script setup lang="ts">
import { z } from 'zod';
import {
  accountSchema,
  categorySchema,
  transactionSchema,
  transactionPageSchema,
  transactionQuerySchema,
  bulkCategorySchema,
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
const bulkCategory = ref('');
const nextCursor = ref<string | null>(null);
const error = ref('');
const busy = ref(false);
const filter = reactive({
  accountId: String(route.query.accountId ?? ''),
  from: String(route.query.from ?? ''),
  to: String(route.query.to ?? ''),
  search: String(route.query.search ?? ''),
  status: String(route.query.status ?? ''),
  categoryId: String(route.query.categoryId ?? ''),
  direction: String(route.query.direction ?? ''),
  uncategorized: route.query.uncategorized === 'true',
  excludeTransfers: route.query.excludeTransfers === 'true',
});
/** Serialize only nonempty filter values before schema validation. */
function query(cursor?: string) {
  const value: Record<string, string | undefined> = {};
  for (const [key, field] of Object.entries(filter)) if (field) value[key] = String(field);
  if (cursor) value.cursor = cursor;
  return transactionQuerySchema.parse(value);
}
/** Fetch one stable page or a selected transaction detail. */
async function load(append = false) {
  busy.value = true;
  error.value = '';
  try {
    if (route.params.id) detail.value = await api.request(`/transactions/${route.params.id}`, transactionSchema);
    else {
      const q = query(append ? (nextCursor.value ?? undefined) : undefined);
      const page = await api.request('/transactions', transactionPageSchema, { query: q });
      rows.value = append ? [...rows.value, ...page.items] : page.items;
      nextCursor.value = page.nextCursor;
      if (!append) selected.value = [];
      await router.replace({
        query: Object.fromEntries(
          Object.entries(q).filter(
            /** Keep persistent filters, not pagination position. */ ([key, value]) =>
              key !== 'limit' && key !== 'cursor' && value !== undefined,
          ),
        ),
      });
    }
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}
/** Start a fresh filtered page from a form submission. */
async function search() {
  await load(false);
}
/** Request the next cursor page without resetting existing rows. */
async function more() {
  await load(true);
}
/** Save a category chosen in either transaction view. */
async function assign(id: string, event: Event) {
  try {
    await api.request(`/transactions/${id}`, transactionSchema, {
      method: 'PATCH',
      body: { categoryId: (event.target as HTMLSelectElement).value || null },
    });
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
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
    error.value = (cause as Error).message;
  }
}
/** Assign a category to the explicit selected IDs. */
async function bulk() {
  try {
    const body = bulkCategorySchema.parse({ ids: selected.value, categoryId: bulkCategory.value || null });
    await api.request('/transactions/bulk-category', z.object({ updated: z.number() }), { method: 'POST', body });
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
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
    error.value = (cause as Error).message;
  }
}
/** Resolve category labels including deleted assignments. */
function categoryName(id: string | null) {
  return (
    categories.value.find(/** Match by stable ID. */ (category) => category.id === id)?.name ?? 'Nicht kategorisiert'
  );
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
      error.value = (cause as Error).message;
    }
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">JEDE BUCHUNG IM BLICK</p>
      <h1>{{ route.params.id ? 'Umsatzdetails' : 'Deine Umsätze' }}</h1>
      <p class="muted">Suchen, zuordnen und deinen Alltag verstehen.</p>
    </div>
    <UButton :to="route.params.id ? '/transactions' : '/imports/csv'" variant="soft">{{
      route.params.id ? 'Alle Umsätze' : 'CSV importieren'
    }}</UButton>
  </div>
  <UAlert v-if="error" color="error" :description="error" class="mb-5" />
  <section v-if="detail" class="panel">
    <p class="eyebrow">{{ detail.status === 'PENDING' ? 'VORGEMERKT' : 'GEBUCHT' }}</p>
    <h2 class="mt-3">{{ detail.description }}</h2>
    <p class="detail-amount">{{ money(detail.amountCents) }}</p>
    <dl class="detail-list">
      <dt>Buchungsdatum</dt>
      <dd>{{ calendarDate(detail.bookingDate) }}</dd>
      <dt>Wertstellung</dt>
      <dd>{{ detail.valueDate ? calendarDate(detail.valueDate) : 'Nicht geliefert' }}</dd>
      <dt>Gegenpartei</dt>
      <dd>{{ detail.counterpartyName || 'Nicht geliefert' }}</dd>
      <dt>Gegenkonto</dt>
      <dd>{{ detail.counterpartyIban || 'Nicht geliefert' }}</dd>
      <dt>Kategorie</dt>
      <dd>{{ categoryName(detail.categoryId) }}</dd>
    </dl>
    <div class="toolbar mt-5">
      <select
        :value="detail.categoryId ?? ''"
        aria-label="Kategorie zuordnen"
        class="control"
        @change="assign(detail.id, $event)"
      >
        <option value="">Nicht kategorisiert</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.name }}
        </option></select
      ><UButton variant="soft" @click="mark(detail)">{{
        detail.isTransfer ? 'Umbuchung aufheben' : 'Als Umbuchung markieren'
      }}</UButton>
    </div>
  </section>
  <template v-if="!route.params.id"
    ><section class="panel mb-5">
      <form class="filter-grid" @submit.prevent="search">
        <label
          >Suche<UInput
            v-model="filter.search"
            placeholder="Text oder Gegenpartei"
            aria-label="Umsätze durchsuchen" /></label
        ><label
          >Konto<select v-model="filter.accountId" class="control">
            <option value="">Alle Konten</option>
            <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option>
          </select></label
        ><label>Von<UInput v-model="filter.from" type="date" aria-label="Von" /></label
        ><label>Bis<UInput v-model="filter.to" type="date" aria-label="Bis" /></label
        ><label
          >Kategorie<select v-model="filter.categoryId" class="control">
            <option value="">Alle Kategorien</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
          </select></label
        ><label
          >Status<select v-model="filter.status" class="control">
            <option value="">Alle Buchungen</option>
            <option value="BOOKED">Gebucht</option>
            <option value="PENDING">Vorgemerkt</option>
          </select></label
        ><label
          >Richtung<select v-model="filter.direction" class="control">
            <option value="">Einnahmen & Ausgaben</option>
            <option value="INCOME">Einnahmen</option>
            <option value="EXPENSE">Ausgaben</option>
          </select></label
        >
        <div class="toolbar">
          <label><input v-model="filter.uncategorized" type="checkbox" /> Ohne Kategorie</label
          ><label><input v-model="filter.excludeTransfers" type="checkbox" /> Ohne Umbuchungen</label>
        </div>
        <UButton type="submit" :loading="busy">Filtern</UButton>
      </form>
    </section>
    <section class="panel">
      <div v-if="selected.length" class="toolbar mb-5">
        <span>{{ selected.length }} ausgewählt</span
        ><select v-model="bulkCategory" aria-label="Kategorie für Auswahl" class="control">
          <option value="">Nicht kategorisiert</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option></select
        ><UButton @click="bulk">Kategorie zuweisen</UButton
        ><UButton :disabled="selected.length > 2" variant="soft" @click="transfer">Umbuchung verknüpfen</UButton>
      </div>
      <p v-if="busy" role="status">Umsätze werden geladen …</p>
      <p v-if="!busy && !rows.length" class="empty-copy">
        Keine Umsätze gefunden. Passe deine Filter an oder importiere Buchungen.
      </p>
      <div v-for="row in rows" :key="row.id" class="ledger-row">
        <input
          v-model="selected"
          :value="row.id"
          type="checkbox"
          :aria-label="`${row.description} auswählen`"
        /><NuxtLink :to="`/transactions/${row.id}`" class="ledger-description"
          ><strong>{{ row.description }}</strong
          ><small
            >{{ calendarDate(row.bookingDate) }} · {{ row.counterpartyName || 'Keine Gegenpartei'
            }}<span v-if="row.isTransfer"> · Umbuchung</span
            ><span v-if="row.status === 'PENDING'"> · Vorgemerkt</span></small
          ></NuxtLink
        ><select
          :value="row.categoryId ?? ''"
          :aria-label="`Kategorie für ${row.description}`"
          class="control"
          @change="assign(row.id, $event)"
        >
          <option value="">Nicht kategorisiert</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option></select
        ><strong :class="BigInt(row.amountCents) > 0n ? 'positive' : ''">{{ money(row.amountCents) }}</strong>
      </div>
      <UButton v-if="nextCursor" :loading="busy" variant="soft" class="mt-5" @click="more"
        >Weitere Umsätze laden</UButton
      >
    </section>
  </template>
</template>
