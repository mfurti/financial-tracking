<script setup lang="ts">
import { z } from 'zod';
import { categorySchema, categoryInputSchema, type Category } from '@financial-tracking/contracts';

const api = useApi();
const { validation, formError } = useFormFeedback();
const categories = ref<Category[]>([]);
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
  loading.value = true;
  error.value = '';
  try {
    categories.value = await api.request('/categories', z.array(categorySchema));
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    loading.value = false;
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
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">ORDNUNG FÜR DEINEN ALLTAG</p>
      <h1>Kategorien</h1>
      <p class="muted">Ordne deine Buchungen so, wie es für dich passt.</p>
    </div>
    <UButton variant="soft" :loading="loading" @click="load">Aktualisieren</UButton>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <section class="panel mb-6">
    <h2 class="mb-4">Kategorie anlegen</h2>
    <UForm ref="validation" :schema="categoryInputSchema" :state="form" class="form-row" @submit="create"
      ><UFormField label="Name" name="name"
        ><UInput v-model="form.name" placeholder="Zum Beispiel Lebensmittel" /></UFormField
      ><UFormField label="Art" name="kind"><USelect v-model="form.kind" :items="kinds" /></UFormField
      ><UButton type="submit" :loading="busy">Kategorie anlegen</UButton></UForm
    >
  </section>
  <section class="panel">
    <p v-if="loading" role="status" class="muted">Kategorien werden geladen …</p>
    <p v-else-if="!categories.length && !error" class="empty-copy">
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
  </section>
</template>
