<script setup lang="ts">
import { z } from 'zod';
import {
  accountSchema,
  accountInputSchema,
  connectionSchema,
  ibanSchema,
  type Connection,
} from '@financial-tracking/contracts';
const api = useApi();
const { validation, formError, formInvalid } = useFormFeedback();
const connections = ref<Connection[]>([]);
const error = ref('');
const loading = ref(true);
const busy = ref(false);
const formSchema = accountInputSchema.extend({ iban: ibanSchema.or(z.literal('')) });
const form = reactive({
  bankConnectionId: '',
  name: '',
  iban: '',
  accountType: 'CHECKING' as 'CHECKING' | 'SAVINGS' | 'OTHER',
});
let disposed = false;
const options = computed(
  /** Build form choices from persisted connections. */ () =>
    connections.value.map(
      /** Keep display labels independent of IDs. */ (connection) => ({ label: connection.name, value: connection.id }),
    ),
);

/** Load real connection choices without clearing an existing account draft on a failed retry. */
async function load() {
  loading.value = true;
  error.value = '';
  try {
    const choices = await api.request('/bank-connections', z.array(connectionSchema));
    if (disposed) return;
    connections.value = choices;
    if (!form.bankConnectionId) form.bankConnectionId = choices[0]?.id ?? '';
  } catch (cause) {
    if (!disposed) error.value = formError(cause);
  } finally {
    if (!disposed) loading.value = false;
  }
}
/** Create a zero-history manual account without inventing its balance. */
async function create() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const created = await api.request('/accounts', accountSchema, {
      method: 'POST',
      body: accountInputSchema.parse({ ...form, iban: form.iban || null }),
    });
    if (!disposed) await navigateTo(`/accounts/${created.id}`);
  } catch (cause) {
    if (!disposed) error.value = formError(cause);
  } finally {
    if (!disposed) busy.value = false;
  }
}
onMounted(
  /** Surface load errors without hiding the account form; connection retries retain the user's existing draft. */ load,
);
onBeforeUnmount(
  /** Ignore read/save completion owned by an abandoned creation page. */ () => {
    disposed = true;
  },
);
</script>

<template>
  <div class="page-heading">
    <h1>{{ tr('Konto hinzufügen') }}</h1>
    <UButton to="/accounts" variant="soft">{{ tr('Alle Konten') }}</UButton>
  </div>
  <SectionPanel :title="tr('Manuelles Konto')" icon="accounts"
    ><p class="muted mb-5">
      {{
        tr(
          'Ein neues Konto startet ohne beobachteten Saldo. CSV-Umsätze ersetzen keinen Kontostand. CSV-Import funktioniert auch ohne Konto; eine spätere Zuordnung bleibt möglich.',
        )
      }}
    </p>
    <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" />
    <p v-if="loading" role="status">{{ tr('Verbindungen werden geladen …') }}</p>
    <template v-if="connections.length"
      ><UForm
        ref="validation"
        :schema="translatedSchema(formSchema)"
        :state="form"
        :validate-on="[]"
        class="filter-grid"
        @submit="create"
        @error="formInvalid"
        ><UFormField :label="tr('Name')" name="name"
          ><UInput v-model="form.name" :placeholder="tr('Mein Girokonto')" :disabled="busy" /></UFormField
        ><UFormField :label="tr('Bankverbindung')" name="bankConnectionId"
          ><USelect v-model="form.bankConnectionId" :items="options" :disabled="busy" /></UFormField
        ><UFormField :label="tr('IBAN (optional)')" name="iban"
          ><UInput v-model="form.iban" :placeholder="tr('DE…')" :disabled="busy" /></UFormField
        ><UFormField :label="tr('Kontotyp')" name="accountType"
          ><USelect
            v-model="form.accountType"
            :items="[
              { label: tr('Girokonto'), value: 'CHECKING' },
              { label: tr('Sparkonto'), value: 'SAVINGS' },
              { label: tr('Sonstiges Konto'), value: 'OTHER' },
            ]"
            :disabled="busy" /></UFormField
        ><UButton type="submit" :loading="busy" :disabled="loading">{{ tr('Konto anlegen') }}</UButton></UForm
      ></template
    >
    <div v-else-if="!loading" class="empty-copy">
      {{ tr('Lege zuerst eine Verbindung an, um das Konto einer echten Quelle zuzuordnen.') }}
      <div class="toolbar mt-4">
        <UButton to="/connections" variant="soft">{{ tr('Bankverbindung anlegen') }}</UButton
        ><UButton to="/imports/csv" variant="ghost">{{ tr('CSV ohne Konto importieren') }}</UButton>
      </div>
    </div>
    <UButton v-if="error" variant="soft" :disabled="loading" @click="load">{{
      tr('Erneut versuchen')
    }}</UButton></SectionPanel
  >
</template>
