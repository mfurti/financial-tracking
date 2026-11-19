<script setup lang="ts">
import { z } from 'zod';
import {
  categoryRuleSchema,
  categoryRuleInputSchema,
  categoryRuleBackfillResultSchema,
  categorySchema,
  categoryTemplateInputSchema,
  type Category,
} from '@financial-tracking/contracts';
const props = defineProps<{ categories: Category[] }>();
const emit = defineEmits<{ changed: [] }>();
const api = useApi();
const { validation, formError, formInvalid } = useFormFeedback();
const rules = ref<z.infer<typeof categoryRuleSchema>[]>([]);
const error = ref('');
const notice = ref('');
const busy = ref(false);
const loading = ref(true);
let disposed = false;
const editing = ref(false);
const editId = ref<string | null>(null);
const backfillOpen = ref(false);
const deleteId = ref<string | null>(null);
const deleteOpen = computed({
  get: /** Show a specific rule's removal confirmation. */ () => deleteId.value !== null,
  set: /** Dismiss without deleting. */ (value: boolean) => {
    if (!value) deleteId.value = null;
  },
});
const selectedTemplates = ref<z.infer<typeof categoryTemplateInputSchema>['names']>(['Mode', 'Technik', 'Essen gehen']);
const templateNames = categoryTemplateInputSchema.shape.names.element.options;
const form = reactive({
  name: '',
  categoryId: '',
  matchType: 'COUNTERPARTY' as 'COUNTERPARTY' | 'DESCRIPTION',
  text: '',
  direction: 'ANY' as 'ANY' | 'INCOME' | 'EXPENSE',
  priority: 100,
  isActive: true,
});
const categories = computed(
  /** Do not offer inactive categories for new rule targets. */ () =>
    props.categories
      .filter(/** Retain historical categories elsewhere. */ (category) => category.isActive)
      .map(/** Select by immutable identity. */ (category) => ({ label: category.name, value: category.id })),
);
/** Load current rules without applying them to existing transactions. */
async function load() {
  loading.value = true;
  try {
    const result = await api.request('/category-rules', z.array(categoryRuleSchema));
    if (!disposed) rules.value = result;
  } finally {
    if (!disposed) loading.value = false;
  }
}
/** Prepare a new or existing rule; edits are inert until saved. */
function edit(rule?: z.infer<typeof categoryRuleSchema>) {
  error.value = '';
  editId.value = rule?.id ?? null;
  Object.assign(
    form,
    rule ?? {
      name: '',
      categoryId: '',
      matchType: 'COUNTERPARTY',
      text: '',
      direction: 'ANY',
      priority: 100,
      isActive: true,
    },
  );
  editing.value = true;
}
/** Save only a validated rule, leaving existing assignments untouched. */
async function save() {
  busy.value = true;
  error.value = '';
  try {
    await api.request(editId.value ? `/category-rules/${editId.value}` : '/category-rules', categoryRuleSchema, {
      method: editId.value ? 'PATCH' : 'POST',
      body: categoryRuleInputSchema.parse(form),
    });
    editing.value = false;
    await load();
    notice.value = 'Regel gespeichert. Sie gilt für neue Buchungen. Bestehende Buchungen bleiben unverändert.';
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    busy.value = false;
  }
}
/** Delete after visible confirmation; existing origin snapshots remain readable. */
async function remove() {
  if (!deleteId.value) return;
  busy.value = true;
  error.value = '';
  try {
    await api.request(`/category-rules/${deleteId.value}`, z.object({ ok: z.boolean() }), { method: 'DELETE' });
    deleteId.value = null;
    await load();
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    busy.value = false;
  }
}
/** Enable selected templates without renaming or duplicating existing suitable categories. */
async function templates() {
  busy.value = true;
  error.value = '';
  try {
    await api.request('/categories/templates', z.array(categorySchema), {
      method: 'POST',
      body: categoryTemplateInputSchema.parse({ names: selectedTemplates.value }),
    });
    emit('changed');
    notice.value = 'Vorlagen hinzugefügt; passende vorhandene Kategorien wurden wiederverwendet.';
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    busy.value = false;
  }
}
/** Apply the explicit historical action and explain skipped manual decisions/conflicts. */
async function apply() {
  busy.value = true;
  error.value = '';
  try {
    const result = await api.request('/category-rules/apply', categoryRuleBackfillResultSchema, {
      method: 'POST',
      body: { confirm: true },
    });
    backfillOpen.value = false;
    notice.value = `${result.updated} zugeordnet · ${result.protected} manuelle Entscheidungen geschützt · ${result.conflicting} Regelkonflikte bleiben offen.`;
    emit('changed');
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    busy.value = false;
  }
}
onMounted(
  /** Surface recoverable load failures. */ async () => {
    try {
      await load();
    } catch (cause) {
      error.value = formError(cause);
    }
  },
);
onBeforeUnmount(
  /** An abandoned category page cannot publish a late rule list. */ () => {
    disposed = true;
  },
);
</script>

<template>
  <SectionPanel title="Kategorien & Regeln" icon="categories" compact>
    <template #actions><UButton :disabled="busy || loading" @click="edit()">Regel erstellen</UButton></template>
    <p class="muted">
      Sichere Regeln ordnen neue Buchungen automatisch zu. Manuelle Kategorien und bewusst leere Zuordnungen bleiben
      geschützt. Kleinere Prioritätszahlen greifen zuerst; gleichrangige widersprüchliche Treffer bleiben offen.
    </p>
    <UAlert v-if="error" role="alert" color="error" :description="error" class="my-4" />
    <p v-if="notice" role="status" class="my-4">{{ notice }}</p>
    <p v-if="loading" role="status" class="muted mt-4">Regeln werden geladen …</p>
    <p v-if="!rules.length && !loading && !error" class="empty-copy">
      Noch keine Regeln. Beginne mit einer eindeutigen Gegenpartei, zum Beispiel deinem Supermarkt.
    </p>
    <div v-for="rule in rules" :key="rule.id" class="editable-row" role="group" :aria-label="`Regel ${rule.name}`">
      <div>
        <strong>{{ rule.name }}</strong>
        <p class="muted">
          {{ rule.matchType === 'COUNTERPARTY' ? 'Gegenpartei genau' : 'Buchungstext enthält' }}: {{ rule.text }} ·
          Priorität {{ rule.priority }} · {{ rule.isActive ? 'Aktiv' : 'Deaktiviert' }}
        </p>
      </div>
      <UButton color="neutral" variant="outline" @click="edit(rule)">Bearbeiten</UButton
      ><UButton color="error" variant="ghost" @click="deleteId = rule.id">Löschen</UButton>
    </div>
    <UButton variant="soft" class="mt-4" :disabled="!rules.length || busy" @click="backfillOpen = true"
      >Regeln auf Bestandsbuchungen anwenden</UButton
    >
    <DisclosurePanel title="Kategorienvorlagen hinzufügen" class="mt-6">
      <p class="muted mb-4">
        Vorhandene passende Kategorien werden wiederverwendet. Eigene Bezeichnungen bleiben erhalten.
      </p>
      <UCheckboxGroup v-model="selectedTemplates" :items="templateNames" legend="Vorlagen" />
      <UButton class="mt-4" :disabled="!selectedTemplates.length" :loading="busy" @click="templates"
        >Vorlagen hinzufügen</UButton
      >
    </DisclosurePanel>
  </SectionPanel>
  <FinanceDialog
    v-model:open="editing"
    :title="editId ? 'Regel bearbeiten' : 'Regel erstellen'"
    description="Nur eindeutige, bewusst gewählte Texte verwenden. Bestehende Buchungen ändern sich erst nach ausdrücklicher Bestandsaktion."
    :dismissible="!busy"
  >
    <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" />
    <UForm
      ref="validation"
      :state="form"
      :schema="categoryRuleInputSchema"
      :validate-on="[]"
      class="grid gap-4"
      @submit="save"
      @error="formInvalid"
    >
      <UFormField name="name" label="Regelname"><UInput v-model="form.name" /></UFormField>
      <UFormField name="categoryId" label="Zielkategorie"
        ><ChoiceSelect v-model="form.categoryId" :items="categories"
      /></UFormField>
      <UFormField name="matchType" label="Vergleich"
        ><USelect
          v-model="form.matchType"
          :items="[
            { label: 'Gegenpartei stimmt genau überein', value: 'COUNTERPARTY' },
            { label: 'Buchungstext enthält', value: 'DESCRIPTION' },
          ]"
      /></UFormField>
      <UFormField
        name="text"
        label="Gesuchter Text"
        :help="
          form.matchType === 'COUNTERPARTY'
            ? 'Der ganze Name muss passen. Groß-/Kleinschreibung spielt keine Rolle.'
            : 'Dieser Textbestandteil muss vorkommen. Keine Platzhalter oder regulären Ausdrücke.'
        "
        ><UInput v-model="form.text"
      /></UFormField>
      <UFormField name="direction" label="Gilt für"
        ><USelect
          v-model="form.direction"
          :items="[
            { label: 'Alle Buchungen', value: 'ANY' },
            { label: 'Ausgaben', value: 'EXPENSE' },
            { label: 'Einnahmen', value: 'INCOME' },
          ]"
      /></UFormField>
      <UFormField
        name="priority"
        label="Priorität"
        help="Kleinere Zahl zuerst; gleiche Priorität mit verschiedenen Kategorien bleibt ungeklärt."
        ><UInput v-model.number="form.priority" type="number" min="0" max="10000"
      /></UFormField>
      <USwitch v-model="form.isActive" label="Regel aktiv" />
      <div class="toolbar">
        <UButton type="submit" :loading="busy">Regel speichern</UButton
        ><UButton color="neutral" variant="outline" :disabled="busy" @click="editing = false">Abbrechen</UButton>
      </div>
    </UForm>
  </FinanceDialog>
  <FinanceDialog
    v-model:open="backfillOpen"
    title="Bestandsbuchungen neu zuordnen?"
    description="Aktuelle Regeln werden auf nicht manuell kategorisierte Buchungen angewendet. Bisherige automatische Zuordnungen können ersetzt oder bei Konflikten entfernt werden. Manuelle Entscheidungen einschließlich leerer Auswahl bleiben erhalten."
    :dismissible="!busy"
  >
    <template #footer
      ><UButton :loading="busy" @click="apply">Jetzt anwenden</UButton
      ><UButton color="neutral" variant="outline" :disabled="busy" @click="backfillOpen = false"
        >Abbrechen</UButton
      ></template
    >
  </FinanceDialog>
  <FinanceDialog
    v-model:open="deleteOpen"
    title="Regel löschen?"
    description="Neue Buchungen verwenden diese Regel nicht mehr. Bereits zugeordnete Kategorien und deren Herkunft bleiben erhalten."
    :dismissible="!busy"
  >
    <template #footer
      ><UButton color="error" :loading="busy" @click="remove">Regel löschen</UButton
      ><UButton color="neutral" variant="outline" :disabled="busy" @click="deleteId = null"
        >Abbrechen</UButton
      ></template
    >
  </FinanceDialog>
</template>
