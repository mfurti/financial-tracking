<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
const props = defineProps<{
  contract?: z.infer<typeof c.contractSchema> | null;
  suggestion?: z.infer<typeof c.contractSuggestionSchema> | null;
  accounts: c.Account[];
  categories: c.Category[];
  submitLabel?: string;
}>();
const emit = defineEmits<{ saved: [id: string]; dirty: [value: boolean]; busy: [value: boolean] }>();
const api = useApi();
const { validation, formError } = useFormFeedback();
const error = ref('');
const busy = ref(false);
const baseline = ref('');
const kinds = [
  { label: 'Abo', value: 'SUBSCRIPTION' },
  { label: 'Miete', value: 'RENT' },
  { label: 'Versicherung', value: 'INSURANCE' },
  { label: 'Energie', value: 'ENERGY' },
  { label: 'Telefon & Internet', value: 'TELECOM' },
  { label: 'Sonstiges', value: 'OTHER' },
];
const intervals = [
  { label: 'Monatlich', value: 1 },
  { label: 'Vierteljährlich', value: 3 },
  { label: 'Halbjährlich', value: 6 },
  { label: 'Jährlich', value: 12 },
];
const form = reactive({
  name: '',
  provider: '',
  kind: 'SUBSCRIPTION',
  accountId: '',
  categoryId: '',
  startDate: '',
  endDate: '',
  cancellationDate: '',
  amountEuro: '',
  intervalMonths: 1,
});
watchEffect(
  /** Initialize only when the selected record/confirmation changes. */ () => {
    const record = props.contract,
      suggestion = props.suggestion;
    const initial = {
      name: record?.name ?? suggestion?.provider ?? '',
      provider: record?.provider ?? suggestion?.provider ?? '',
      kind: record?.kind ?? 'SUBSCRIPTION',
      accountId: record?.accountId ?? suggestion?.accountId ?? '',
      categoryId: record?.categoryId ?? '',
      startDate:
        record?.startDate ??
        suggestion?.startDate ??
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()),
      endDate: record?.endDate ?? '',
      cancellationDate: record?.cancellationDate ?? '',
      amountEuro: editableEuro(record?.revisions.at(-1)?.amountCents ?? suggestion?.amountCents ?? '0'),
      intervalMonths: record?.revisions.at(-1)?.intervalMonths ?? suggestion?.intervalMonths ?? 1,
    };
    Object.assign(form, initial);
    baseline.value = JSON.stringify(initial);
  },
);
const dirty = computed(
  /** Compare only editable local values against the current card's initial values. */ () =>
    JSON.stringify(form) !== baseline.value,
);
watch(dirty, /** Let the card coordinator protect uncommitted edits. */ (value) => emit('dirty', value));
watch(busy, /** Block carousel navigation during the actual save request. */ (value) => emit('busy', value));
/** Reset only this local form after explicit discard; persistence remains unchanged. */
function reset() {
  Object.assign(form, JSON.parse(baseline.value) as typeof form);
}
defineExpose({ reset });
/** Validate exact cents and explicitly confirm the contract, never merely accept a suggestion on read. */
async function save() {
  busy.value = true;
  error.value = '';
  try {
    const metadata = {
      name: form.name,
      provider: form.provider,
      kind: form.kind,
      accountId: form.accountId || null,
      categoryId: form.categoryId || null,
      endDate: form.endDate || null,
      cancellationDate: form.cancellationDate || null,
    };
    const body = props.contract
      ? c.contractPatchSchema.parse(metadata)
      : c.contractInputSchema.parse({
          ...metadata,
          startDate: form.startDate,
          amountCents: euroCents(form.amountEuro),
          intervalMonths: form.intervalMonths,
          suggestionKey: props.suggestion?.key,
        });
    const saved = await api.request(
      props.contract ? `/contracts/${props.contract.id}` : '/contracts',
      c.contractSchema,
      { method: props.contract ? 'PATCH' : 'POST', body },
    );
    emit('saved', saved.id);
  } catch (cause) {
    error.value =
      cause instanceof Error && cause.message.startsWith('Betrag als Euro') ? cause.message : formError(cause);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <UForm ref="validation" :state="form" class="grid gap-4" @submit="save">
    <UAlert v-if="error" role="alert" color="error" :description="error" /><HelpPopover
      title="Vertragsangaben"
      text="Automatische Zahlungszuordnung verlangt die genaue Gegenpartei. Die Vertragskategorie überschreibt keine manuellen Buchungskategorien. Ein Enddatum gilt einschließlich dieses Tages; ein Kündigungsdatum löst keine Kündigung aus."
    />
    <UFormField name="name" label="Vertragsname" required
      ><UInput v-model="form.name" placeholder="Zum Beispiel Streaming oder Miete"
    /></UFormField>
    <UFormField name="provider" label="Anbieter / Gegenpartei" required><UInput v-model="form.provider" /></UFormField>
    <UFormField name="kind" label="Vertragsart"><USelect v-model="form.kind" :items="kinds" /></UFormField>
    <UFormField name="accountId" label="Konto"
      ><ChoiceSelect
        v-model="form.accountId"
        :items="[
          { label: 'Alle Konten, auch ohne Konto', value: '' },
          ...accounts.map(/** Bind by stable identity. */ (account) => ({ label: account.name, value: account.id })),
        ]"
    /></UFormField>
    <UFormField name="categoryId" label="Vertragskategorie"
      ><ChoiceSelect
        v-model="form.categoryId"
        :items="[
          { label: 'Keine Vertragskategorie', value: '' },
          ...categories.map(
            /** Reuse existing category identities. */ (category) => ({ label: category.name, value: category.id }),
          ),
        ]"
    /></UFormField>
    <template v-if="!contract">
      <UFormField name="startDate" label="Erste Fälligkeit"
        ><DatePicker v-model="form.startDate" label="Erste Fälligkeit"
      /></UFormField>
      <UFormField name="amountCents" label="Betrag in Euro" required
        ><UInput v-model="form.amountEuro" inputmode="decimal"
      /></UFormField>
      <UFormField name="intervalMonths" label="Zahlungsrhythmus"
        ><ChoiceSelect v-model="form.intervalMonths" :searchable="false" :items="intervals"
      /></UFormField>
    </template>
    <p v-else class="muted">
      Betrag und Rhythmus ändern sich unten über eine zukünftige Zahlungsregel. Bisherige Regeln bleiben erhalten.
    </p>
    <UFormField name="endDate" label="Letzte mögliche Fälligkeit"
      ><DatePicker v-model="form.endDate" label="Vertragsende"
    /></UFormField>
    <UFormField name="cancellationDate" label="Kündigungsdatum"
      ><DatePicker v-model="form.cancellationDate" label="Kündigungsdatum"
    /></UFormField>
    <UButton type="submit" :loading="busy">{{
      submitLabel ?? (contract ? 'Vertrag speichern' : 'Vertrag bestätigen')
    }}</UButton>
  </UForm>
</template>
