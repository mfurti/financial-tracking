<script setup lang="ts">
import {
  positiveCentsSchema,
  transactionSchema,
  transactionSplitLimit,
  transactionSplitsInputSchema,
  type Category,
  type Transaction,
} from '@financial-tracking/contracts';
import { userErrorMessage } from '../utils/api-error';
import { editableEuro, euroCents } from '../utils/euro-input';

const props = defineProps<{ transaction: Transaction; categories: Category[] }>();
const emit = defineEmits<{ changed: [transaction: Transaction] }>();
const api = useApi();
const editing = ref(false);
const busy = ref(false);
const error = ref('');
const drafts = ref<{ id: number; category: string; euros: string }[]>([]);
const uncategorized = 'uncategorized';
let draftId = 0;
const total = computed(() => {
  const signed = BigInt(props.transaction.amountCents);
  return signed < 0n ? -signed : signed;
});
const choices = computed(() => [
  { label: tr('Nicht kategorisiert'), value: uncategorized },
  ...props.categories.map((category) => ({ label: category.name, value: category.id })),
]);

function readAmount(euros: string) {
  try {
    return positiveCentsSchema.parse(euroCents(euros));
  } catch {
    return undefined;
  }
}

const remaining = computed(() =>
  drafts.value.reduce((left, draft) => left - BigInt(readAmount(draft.euros) ?? '0'), total.value),
);

function add(category = '', euros = '') {
  drafts.value.push({ id: ++draftId, category, euros });
}

function begin() {
  error.value = '';
  drafts.value = [];
  const amounts = new Map<string, bigint>();
  for (const split of props.transaction.splits ?? []) {
    const category = split.categoryId ?? uncategorized;
    amounts.set(category, (amounts.get(category) ?? 0n) + BigInt(split.amountCents));
  }
  for (const [category, cents] of amounts) add(category, amountsMasked() ? '' : editableEuro(String(cents)));
  if (!drafts.value.length) add(props.transaction.categoryId ?? '');
  if (drafts.value.length < 2) add();
  editing.value = true;
}

function cancel() {
  editing.value = false;
  error.value = '';
}

async function persist(clear = false) {
  if (busy.value) return;
  error.value = '';
  const splits = clear
    ? []
    : drafts.value.map((draft) => ({
        categoryId: draft.category === uncategorized ? null : draft.category,
        amountCents: readAmount(draft.euros),
      }));
  if (!clear && splits.some((split) => !split.amountCents)) {
    error.value = tr('Gib für jede Teilbuchung einen Betrag über 0 € ein.');
    return;
  }
  const body = transactionSplitsInputSchema.safeParse({ splits });
  if (!body.success) {
    error.value = tr('Wähle mindestens zwei unterschiedliche Kategorien.');
    return;
  }
  if (!clear && remaining.value !== 0n) {
    error.value = tr('Die Teilbeträge müssen zusammen dem Originalbetrag entsprechen.');
    return;
  }
  busy.value = true;
  try {
    const saved = await api.request(`/transactions/${props.transaction.id}/splits`, transactionSchema, {
      method: 'PUT',
      body: body.data,
    });
    emit('changed', saved);
    cancel();
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="split-editor my-4">
    <h3 class="mb-2 font-semibold">{{ tr('Teilbuchungen') }}</h3>
    <form v-if="editing" class="split-form" @submit.prevent="persist()">
      <div v-for="(draft, index) in drafts" :key="draft.id" class="split-fields">
        <UFormField :label="tr('Kategorie')">
          <ChoiceSelect
            v-model="draft.category"
            :aria-label="tr('Kategorie für Teil {0}', [index + 1])"
            :placeholder="tr('Kategorie wählen')"
            :items="choices"
            :portal="false"
            :disabled="busy"
          />
        </UFormField>
        <UFormField :label="tr('Teilbetrag in Euro')">
          <UInput
            v-model="draft.euros"
            :aria-label="tr('Teilbetrag {0} in Euro', [index + 1])"
            inputmode="decimal"
            :disabled="busy"
            class="w-full"
          />
        </UFormField>
        <UButton
          v-if="drafts.length > 2"
          type="button"
          variant="ghost"
          :aria-label="tr('Teilbuchung {0} entfernen', [index + 1])"
          :disabled="busy"
          @click="drafts.splice(index, 1)"
          >×</UButton
        >
      </div>
      <p v-if="!amountsMasked()" class="muted" aria-live="polite" data-financial>
        {{ remaining < 0n ? tr('{0} zu viel', [money(-remaining)]) : tr('{0} offen', [money(remaining)]) }}
      </p>
      <div class="toolbar">
        <UButton
          type="button"
          variant="soft"
          :disabled="busy || drafts.length >= transactionSplitLimit"
          @click="add()"
          >{{ tr('Teilbuchung hinzufügen') }}</UButton
        >
        <UButton type="submit" :loading="busy">{{ tr('Aufteilung speichern') }}</UButton>
        <UButton type="button" variant="ghost" :disabled="busy" @click="cancel">{{ tr('Abbrechen') }}</UButton>
      </div>
    </form>
    <template v-else>
      <ul v-if="transaction.splits?.length" class="split-list">
        <li v-for="(split, index) in transaction.splits" :key="index">
          <span>{{ choices.find((choice) => choice.value === (split.categoryId ?? uncategorized))?.label }}</span>
          <strong data-financial>{{
            money(BigInt(transaction.amountCents) < 0n ? -BigInt(split.amountCents) : split.amountCents)
          }}</strong>
        </li>
      </ul>
      <div class="toolbar">
        <UButton variant="soft" :disabled="busy" @click="begin">
          {{ tr(transaction.splits?.length ? 'Aufteilung bearbeiten' : 'Betrag aufteilen') }}
        </UButton>
        <UButton v-if="transaction.splits?.length" variant="ghost" :loading="busy" @click="persist(true)">
          {{ tr('Aufteilung aufheben') }}
        </UButton>
      </div>
    </template>
    <UAlert v-if="error" role="alert" color="error" :description="error" class="mt-2" />
  </section>
</template>

<style scoped>
.split-form,
.split-list {
  display: grid;
  gap: 8px;
}
.split-list {
  margin-bottom: 8px;
}
.split-list li {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 12px;
  overflow-wrap: anywhere;
}
.split-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
}
</style>
