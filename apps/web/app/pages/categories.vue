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
const { validation, formError, formInvalid } = useFormFeedback();
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
const pendingDelete = ref<Category | null>(null);
const deleting = ref(false);
const deleteOpen = computed({
  /** The dialog owns exactly one pending category. */ get: () => pendingDelete.value !== null,
  /** Dismissing it never deletes an assignment. */ set: (open: boolean) => {
    if (!open && !deleting.value) pendingDelete.value = null;
  },
});
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
  pendingDelete.value = category;
}
/** Delete only after the visible Nuxt UI confirmation. */
async function confirmDelete() {
  const category = pendingDelete.value;
  if (!category || deleting.value) return;
  deleting.value = true;
  try {
    await api.request(`/categories/${category.id}`, z.object({ ok: z.boolean() }), {
      method: 'DELETE',
      body: { confirm: true },
    });
    pendingDelete.value = null;
    await load();
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    deleting.value = false;
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
  <UNavigationMenu
    :items="[
      { label: 'Analysen', to: '/analytics', exact: true },
      { label: 'Kategorien & Regeln', to: '/categories' },
    ]"
    class="mb-5"
    aria-label="Analysebereiche"
  />
  <div class="page-heading">
    <div>
      <h1>Kategorien & Auswertung</h1>
    </div>
    <div class="heading-actions">
      <label class="month-control">Monat<MonthPicker v-model="month" @change="load" /></label
      ><UButton variant="soft" :loading="loading" @click="load">Aktualisieren</UButton>
    </div>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <p v-if="loading" role="status" class="muted mb-5">Deine Auswertung wird geladen …</p>
  <template v-if="report && !loading && !error">
    <div class="category-insights mb-6">
      <FinanceTile
        variant="insight"
        :label="`Ausgegeben · ${monthName(report.month)}`"
        :value="money(report.expenseCents)"
        financial
      />
      <FinanceTile variant="insight" label="Eingenommen" :value="money(report.incomeCents)" financial />
      <FinanceTile
        variant="insight"
        label="Noch ohne Kategorie"
        :value="`${unclassified?.count ?? 0} Buchungen`"
        context="Bereits mitgezählt"
        ><template #actions
          ><NuxtLink v-if="unclassified?.count" :to="unclassifiedLink" class="text-link mt-3"
            >Buchungen zuordnen</NuxtLink
          ></template
        >
      </FinanceTile>
    </div>
    <ExpenseBreakdown :report="report" />
  </template>
  <div class="toolbar my-5">
    <UButton :to="unclassifiedLink" variant="soft">Umsätze ohne Kategorie öffnen</UButton
    ><HelpPopover
      title="So entstehen deine Kategorien"
      text="Ordne unter Umsätze eine Kategorie zu oder erstelle eine Regel. Manuelle Entscheidungen haben Vorrang."
    />
  </div>
  <DisclosurePanel class="panel category-management" title="Kategorien verwalten"
    ><div class="mt-6">
      <h2 class="mb-4">Kategorie anlegen</h2>
      <UForm
        ref="validation"
        :schema="categoryInputSchema"
        :state="form"
        :validate-on="[]"
        class="form-row"
        @submit="create"
        @error="formInvalid"
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
      <div
        v-for="category in categories"
        :key="category.id"
        class="editable-row"
        role="group"
        :aria-label="`Kategorie ${category.name}`"
      >
        <UInput v-model="category.name" aria-label="Kategoriename" /><USelect
          v-model="category.kind"
          aria-label="Kategorieart"
          :items="kinds"
        /><UCheckbox v-model="category.isActive" label="Aktiv" /><UButton variant="soft" @click="save(category)"
          >Speichern</UButton
        ><UButton color="error" variant="ghost" @click="remove(category)">Löschen</UButton>
      </div>
    </div></DisclosurePanel
  >
  <CategoryRules :categories="categories" @changed="load" />
  <FinanceDialog
    v-model:open="deleteOpen"
    title="Kategorie löschen?"
    :description="`„${pendingDelete?.name ?? ''}“ wird entfernt. Die Buchungen bleiben erhalten und verlieren nur diese Kategorie.`"
    :dismissible="!deleting"
  >
    <template #footer
      ><UButton color="neutral" variant="outline" :disabled="deleting" @click="pendingDelete = null">Abbrechen</UButton
      ><UButton color="error" :loading="deleting" @click="confirmDelete">Kategorie löschen</UButton></template
    >
  </FinanceDialog>
</template>
