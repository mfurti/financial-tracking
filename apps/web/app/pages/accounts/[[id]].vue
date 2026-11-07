<script setup lang="ts">
import { z } from 'zod';
import {
  accountSchema,
  accountInputSchema,
  connectionSchema,
  ibanSchema,
  type Account,
  type Connection,
} from '@financial-tracking/contracts';

const api = useApi();
const { validation, formError } = useFormFeedback();
const route = useRoute();
const accounts = ref<Account[]>([]);
const connections = ref<Connection[]>([]);
const error = ref('');
const busy = ref(false);
const loading = ref(true);
const formSchema = accountInputSchema.extend({ iban: ibanSchema.or(z.literal('')) });
const form = reactive({ bankConnectionId: '', name: '', iban: '', accountType: 'CHECKING' as const });
const account = computed(
  /** Resolve optional account detail from the same source list. */ () =>
    accounts.value.find(/** Match the public UUID only. */ (row) => row.id === route.params.id),
);
const options = computed(
  /** Build form choices from persisted connections. */ () =>
    connections.value.map(
      /** Keep display labels independent of IDs. */ (connection) => ({ label: connection.name, value: connection.id }),
    ),
);
/** Load accounts and connection choices together. */
async function load() {
  error.value = '';
  loading.value = true;
  try {
    [accounts.value, connections.value] = await Promise.all([
      api.request('/accounts', z.array(accountSchema)),
      api.request('/bank-connections', z.array(connectionSchema)),
    ]);
    if (!form.bankConnectionId) form.bankConnectionId = connections.value[0]?.id ?? '';
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    loading.value = false;
  }
}
/** Create a zero-history manual account without inventing its balance. */
async function create() {
  busy.value = true;
  error.value = '';
  try {
    await api.request('/accounts', accountSchema, {
      method: 'POST',
      body: accountInputSchema.parse({ ...form, iban: form.iban || null }),
    });
    form.name = '';
    form.iban = '';
    await load();
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    busy.value = false;
  }
}
/** Save a name, activation status, or explicitly selected bank assignment. */
async function save(row: Account) {
  error.value = '';
  try {
    await api.request(`/accounts/${row.id}`, accountSchema, {
      method: 'PATCH',
      body: { name: row.name, isActive: row.isActive, ...(row.iban ? { bankConnectionId: row.bankConnectionId } : {}) },
    });
    await load();
  } catch (cause) {
    error.value = formError(cause);
  }
}
onMounted(
  /** Surface load errors without hiding the account form. */ async () => {
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
      <p class="eyebrow">ALLES AN EINEM ORT</p>
      <h1>{{ account ? account.name : 'Deine Konten' }}</h1>
      <p class="muted">Echte Banksalden und importierte Buchungen getrennt im Blick.</p>
    </div>
    <div class="toolbar">
      <UButton variant="soft" :loading="loading" @click="load">Aktualisieren</UButton
      ><UButton to="/connections" variant="soft">Bankverbindungen</UButton>
    </div>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <p v-if="loading" role="status">Konten werden geladen …</p>
  <section v-if="!route.params.id" class="panel mb-6">
    <h2 class="mb-4">Konto optional anlegen</h2>
    <p class="muted mb-4">Du kannst CSV-Dateien sofort ohne Konto importieren und später zuordnen.</p>
    <p v-if="!connections.length" class="empty-copy">
      Lege zuerst eine <NuxtLink to="/connections" class="text-link">Bankverbindung</NuxtLink> an.
    </p>
    <UForm v-else ref="validation" :schema="formSchema" :state="form" class="form-row" @submit="create"
      ><UFormField label="Name" name="name"><UInput v-model="form.name" placeholder="Mein Girokonto" /></UFormField
      ><UFormField label="Bankverbindung" name="bankConnectionId"
        ><USelect v-model="form.bankConnectionId" :items="options" /></UFormField
      ><UFormField label="IBAN (optional)" name="iban"><UInput v-model="form.iban" placeholder="DE…" /></UFormField
      ><UButton type="submit" :loading="busy">Konto anlegen</UButton></UForm
    >
  </section>
  <p v-if="!loading && !accounts.length" class="empty-copy">Noch keine Konten vorhanden.</p>
  <p v-if="route.params.id && !loading && !account" class="empty-copy">Konto nicht gefunden.</p>
  <section
    v-for="row in accounts.filter((a) => !route.params.id || a.id === route.params.id)"
    :key="row.id"
    class="panel mb-5"
  >
    <div class="panel-heading">
      <NuxtLink :to="`/accounts/${row.id}`"
        ><h2>{{ row.name }}</h2></NuxtLink
      ><span class="subtle-tag">{{ row.isActive ? 'Aktiv' : 'Inaktiv' }} · EUR</span>
    </div>
    <p class="muted">{{ row.iban || 'Keine IBAN hinterlegt' }}</p>
    <div class="account-balances">
      <div v-for="balance in row.balances" :key="balance.id">
        <p>{{ balance.balanceType === 'BOOKED' ? 'Gebuchter Saldo' : 'Verfügbar' }}</p>
        <strong>{{ money(balance.amountCents) }}</strong
        ><small>{{ observedTime(balance.observedAt) }}</small>
      </div>
      <p v-if="!row.balances.length" class="muted">
        Kein bankgemeldeter Saldo verfügbar. CSV-Umsätze ersetzen keinen Kontostand.
      </p>
    </div>
    <div class="editable-row mt-5">
      <UInput v-model="row.name" aria-label="Kontoname" /><USelect
        v-if="row.iban"
        v-model="row.bankConnectionId"
        aria-label="Bankverbindung zuordnen"
        :items="options"
      /><label><input v-model="row.isActive" type="checkbox" /> Aktiv</label
      ><UButton variant="soft" @click="save(row)">Speichern</UButton
      ><UButton :to="`/transactions?accountId=${row.id}`" variant="ghost">Umsätze ansehen</UButton>
    </div>
  </section>
</template>
