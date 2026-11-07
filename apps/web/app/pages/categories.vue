<script setup lang="ts">
import { z } from 'zod';
import {
  categorySchema,
  categoryInputSchema,
  monthlySchema,
  type Category,
  type Monthly,
} from '@financial-tracking/contracts';

const api = useApi();
const { validation, formError } = useFormFeedback();
const route = useRoute();
const categories = ref<Category[]>([]);
const month = ref(
  typeof route.query.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(route.query.month)
    ? route.query.month
    : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()).slice(0, 7),
);
const report = ref<Monthly | null>(null);
let version = 0;
let disposed = false;
const unclassified = computed(
  /** Use the explicit unclassified report bucket. */ () =>
    report.value?.categories.find(/** Select real records without a category. */ (entry) => entry.categoryId === null),
);
const unclassifiedLink = computed(
  /** Preserve the displayed month in the assignment workflow. */ () =>
    `/transactions?${new URLSearchParams({ ...monthRangeQuery(month.value), uncategorized: 'true', status: 'BOOKED', excludeTransfers: 'true' })}`,
);
const error = ref('');
const busy = ref(false);
const loading = ref(true);
const form = reactive({ name: '', kind: 'EXPENSE' as 'INCOME' | 'EXPENSE' | 'BOTH' });
const kinds = [
  { label: 'Ausgaben', value: 'EXPENSE' },
  { label: 'Einnahmen', value: 'INCOME' },
  { label: 'Beides', value: 'BOTH' },
];
/** Reload persisted categories after an edit. */
async function load() {
  const current = ++version;
  loading.value = true;
  error.value = '';
  try {
    const [entries, monthly] = await Promise.all([
      api.request('/categories', z.array(categorySchema)),
      api.request('/analytics/monthly', monthlySchema, { query: { month: month.value } }),
    ]);
    if (disposed || current !== version) return;
    categories.value = entries;
    report.value = monthly;
  } catch (cause) {
    if (!disposed && current === version) error.value = formError(cause);
  } finally {
    if (!disposed && current === version) loading.value = false;
  }
}
/** Create a category with shared input validation. */
async function create() {
  busy.value = true;
  error.value = '';
  try {
    await api.request('/categories', categorySchema, { method: 'POST', body: categoryInputSchema.parse(form) });
    form.name = '';
    await load();
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    busy.value = false;
  }
}
/** Persist a renamed or disabled category. */
async function save(category: Category) {
  error.value = '';
  try {
    await api.request(`/categories/${category.id}`, categorySchema, {
      method: 'PATCH',
      body: categoryInputSchema.parse(category),
    });
    await load();
  } catch (cause) {
    error.value = formError(cause);
  }
}
/** Require explicit confirmation before clearing existing assignments. */
async function remove(category: Category) {
  if (!window.confirm(`Kategorie „${category.name}“ löschen? Zugeordnete Umsätze werden nicht kategorisiert.`)) return;
  try {
    await api.request(`/categories/${category.id}`, z.object({ ok: z.boolean() }), {
      method: 'DELETE',
      body: { confirm: true },
    });
    await load();
  } catch (cause) {
    error.value = formError(cause);
  }
}
onMounted(
  /** Surface loading failures in the page. */ async () => {
    try {
      await load();
    } catch (cause) {
      error.value = formError(cause);
    }
  },
);
onBeforeUnmount(
  /** Ignore reads that finish after leaving this page. */ () => {
    disposed = true;
    version++;
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">DEINE AUSGABEN VERSTEHEN</p>
      <h1>Kategorien & Auswertung</h1>
      <p class="muted">
        Sieh, wofür dein Geld ausgegeben wurde. Kategorien bündeln ähnliche Buchungen, zum Beispiel Lebensmittel oder
        Wohnen.
      </p>
    </div>
    <div class="heading-actions">
      <label class="month-control">Monat<input v-model="month" type="month" class="control" @change="load" /></label
      ><UButton variant="soft" :loading="loading" @click="load">Aktualisieren</UButton>
    </div>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <p v-if="loading" role="status" class="muted mb-5">Deine Auswertung wird geladen …</p>
  <template v-if="report && !loading && !error">
    <div class="category-insights mb-6">
      <section class="panel">
        <p class="muted">Ausgegeben · {{ monthName(report.month) }}</p>
        <strong class="insight-amount">{{ money(report.expenseCents) }}</strong
        ><small>Gebuchte Ausgaben ohne eigene Umbuchungen</small>
      </section>
      <section class="panel">
        <p class="muted">Eingenommen</p>
        <strong class="insight-amount positive">{{ money(report.incomeCents) }}</strong
        ><small>Einnahmen fließen separat in deinen Monatsüberblick ein.</small>
      </section>
      <section class="panel">
        <p class="muted">Noch ohne Kategorie</p>
        <strong class="insight-amount">{{ unclassified?.count ?? 0 }} Buchungen</strong
        ><small>Bereits vollständig in der Auswertung enthalten.</small
        ><NuxtLink v-if="unclassified?.count" :to="unclassifiedLink" class="text-link mt-3"
          >Buchungen zuordnen</NuxtLink
        >
      </section>
    </div>
    <ExpenseBreakdown :report="report" />
  </template>
  <section class="panel category-guide mt-6 mb-6">
    <FinanceIcon name="categories" />
    <div>
      <h2>So entstehen deine Kategorien</h2>
      <p>
        Öffne unter „Umsätze“ eine Buchung und wähle ihre Kategorie. Deine Auswertung wird daraus berechnet. Ein
        CSV-Import übernimmt deine Buchungen; fehlende Kategorien werden nicht geraten.
      </p>
      <NuxtLink :to="unclassifiedLink" class="text-link">Umsätze ohne Kategorie öffnen</NuxtLink>
    </div>
  </section>
  <details class="panel category-management">
    <summary>
      <span
        ><strong>Kategorien verwalten</strong><small>Eigene Gruppen anlegen, umbenennen oder deaktivieren</small></span
      >
    </summary>
    <div class="mt-6">
      <h2 class="mb-4">Kategorie anlegen</h2>
      <UForm ref="validation" :schema="categoryInputSchema" :state="form" class="form-row" @submit="create"
        ><UFormField label="Name" name="name"
          ><UInput v-model="form.name" placeholder="Zum Beispiel Lebensmittel" /></UFormField
        ><UFormField label="Gilt für" name="kind"><USelect v-model="form.kind" :items="kinds" /></UFormField
        ><UButton type="submit" :loading="busy">Kategorie anlegen</UButton></UForm
      >
    </div>
    <div class="mt-6">
      <p class="muted mb-4">
        Umbenennen oder Deaktivieren ändert keine Beträge. Bestehende Zuordnungen bleiben erhalten. Beim Löschen bleiben
        die Buchungen bestehen und verlieren nur diese Kategorie.
      </p>
      <p v-if="!loading && !categories.length && !error" class="empty-copy">
        Noch keine Kategorien. Lege oben deine erste Kategorie an.
      </p>
      <div v-for="category in categories" :key="category.id" class="editable-row">
        <UInput v-model="category.name" aria-label="Kategoriename" /><USelect
          v-model="category.kind"
          aria-label="Kategorieart"
          :items="kinds"
        /><label><input v-model="category.isActive" type="checkbox" /> Aktiv</label
        ><UButton variant="soft" @click="save(category)">Speichern</UButton
        ><UButton color="error" variant="ghost" @click="remove(category)">Löschen</UButton>
      </div>
    </div>
  </details>
</template>
