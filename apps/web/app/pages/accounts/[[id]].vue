<script setup lang="ts">
import { z } from 'zod';
import {
  accountSchema,
  accountPatchSchema,
  connectionSchema,
  idSchema,
  type Account,
  type Connection,
} from '@financial-tracking/contracts';
const api = useApi();
const { validation, formError, formInvalid } = useFormFeedback();
const route = useRoute();
const accounts = ref<Account[]>([]);
const connections = ref<Connection[]>([]);
const loadError = ref('');
const error = ref('');
const busy = ref(false);
const loading = ref(true);
const saved = ref(false);
const draft = reactive({ name: '', isActive: true, bankConnectionId: '' });
const formSchema = accountPatchSchema.required({ name: true, isActive: true });
let generation = 0,
  disposed = false;
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
const active = computed(
  /** Inactive accounts retain their own history without inflating the current observed summary. */ () =>
    accounts.value.filter(/** Include only explicitly active accounts. */ (row) => row.isActive),
);
const known = computed(
  /** Unknown BOOKED observations never become invented zero balances. */ () =>
    active.value.flatMap(
      /** Sum the latest actual booked observation of each active account only. */ (row) => {
        const value = booked(row);
        return value ? [value] : [];
      },
    ),
);
const total = computed(
  /** Aggregate observed integer cents without passing through floating-point numbers. */ () =>
    known.value.length
      ? String(
          known.value.reduce(
            /** Preserve signed source balances exactly. */ (sum, balance) => sum + BigInt(balance.amountCents),
            0n,
          ),
        )
      : null,
);
const connectionName = computed(
  /** Resolve confirmed account ownership to a persisted connection label. */ () =>
    connections.value.find(
      /** Match only the confirmed connection UUID. */ (row) => row.id === account.value?.bankConnectionId,
    )?.name ?? 'Nicht verfügbar',
);
const availableBalances = computed(
  /** Show available observations separately without replacing the booked balance. */ () =>
    account.value?.balances.filter(
      /** Retain only the explicit available source type. */ (row) => row.balanceType === 'AVAILABLE',
    ) ?? [],
);
const accountTypes = { CHECKING: 'Girokonto', SAVINGS: 'Sparkonto', OTHER: 'Sonstiges Konto' };

/** Resolve an actual booked balance; available credit is never substituted for missing booked observations. */
function booked(row: Account) {
  return row.balances.find(
    /** Match the explicit source balance type. */ (balance) => balance.balanceType === 'BOOKED',
  );
}
/** Keep source time and missing coverage distinct from current-month transaction actuals. */
function observation(row: Account) {
  const value = booked(row);
  return value
    ? `${observedTime(value.observedAt)}${Date.now() - Date.parse(value.observedAt) > 48 * 3600000 ? ' · älter als 48 Stunden' : ''}`
    : 'Kein beobachteter Saldo · CSV-Umsätze ersetzen keinen Kontostand.';
}
/** Load accounts and connection choices together. */
async function load() {
  if (disposed) return;
  const current = ++generation;
  loadError.value = '';
  loading.value = true;
  saved.value = false;
  try {
    if (route.params.id) idSchema.parse(route.params.id);
    const [records, choices] = await Promise.all([
      api.request('/accounts', z.array(accountSchema)),
      api.request('/bank-connections', z.array(connectionSchema)),
    ]);
    if (disposed || current !== generation) return;
    accounts.value = records;
    connections.value = choices;
    const selected = records.find(
      /** Initialize drafts from a confirmed persisted identity only. */ (row) => row.id === route.params.id,
    );
    if (selected)
      Object.assign(draft, {
        name: selected.name,
        isActive: selected.isActive,
        bankConnectionId: selected.bankConnectionId,
      });
    else if (route.params.id) loadError.value = 'Konto nicht gefunden.';
  } catch (cause) {
    if (!disposed && current === generation) loadError.value = userErrorMessage(cause);
  } finally {
    if (!disposed && current === generation) loading.value = false;
  }
}
/** Save a name, activation status, or explicitly selected bank assignment. */
async function save() {
  if (!account.value || busy.value) return;
  busy.value = true;
  error.value = '';
  saved.value = false;
  try {
    await api.request(`/accounts/${account.value.id}`, accountSchema, {
      method: 'PATCH',
      body: accountPatchSchema.parse({
        name: draft.name,
        isActive: draft.isActive,
        ...(account.value.iban ? { bankConnectionId: draft.bankConnectionId } : {}),
      }),
    });
    await load();
    if (!disposed && !loadError.value) saved.value = true;
  } catch (cause) {
    if (!disposed) error.value = formError(cause);
  } finally {
    if (!disposed) busy.value = false;
  }
}
onMounted(load);
onBeforeUnmount(
  /** Release page ownership so previous account reads cannot replace a later destination. */ () => {
    disposed = true;
    generation++;
  },
);
</script>

<template>
  <div class="page-heading">
    <h1>{{ account && route.params.id ? account.name : route.params.id ? 'Kontodetails' : 'Deine Konten' }}</h1>
    <div class="toolbar">
      <UButton v-if="route.params.id" to="/accounts" variant="soft">Alle Konten</UButton
      ><UButton v-else to="/accounts/add">Konto hinzufügen</UButton
      ><UButton to="/connections" variant="soft">Bankverbindungen</UButton
      ><UButton :disabled="loading || busy" variant="ghost" @click="load">Aktualisieren</UButton>
    </div>
  </div>
  <UAlert v-if="loadError" role="alert" color="error" :description="loadError" class="mb-4" />
  <UButton v-if="loadError" :disabled="loading" @click="load">Erneut versuchen</UButton>
  <FinanceTile v-if="loading" label="Konten" variant="stat" state="loading" />
  <template v-else-if="!loadError">
    <template v-if="!route.params.id">
      <FinanceTile
        label="Bekannte Kontostände"
        :value="total === null ? 'Noch kein Saldo' : money(total)"
        :financial="total !== null"
        variant="stat"
        :context="`${known.length} von ${active.length} aktiven Konten · fehlende Salden bleiben unbekannt`"
      />
      <p class="muted my-5">
        Beobachtete Kontostände sind von gebuchten Monatszahlen getrennt. Du kannst CSV-Dateien auch ohne Konto
        importieren.
      </p>
      <div class="finance-account-grid">
        <FinanceTile
          v-for="row in accounts"
          :key="row.id"
          :data-account-card="row.id"
          :label="row.name"
          :value="booked(row) ? money(booked(row)!.amountCents) : 'Kein Saldo'"
          :financial="Boolean(booked(row))"
          variant="account"
          :to="`/accounts/${row.id}`"
          ><template #context
            ><span
              >{{ accountTypes[row.accountType] }} · {{ row.isActive ? 'Aktiv' : 'Inaktiv' }} ·
              {{ row.iban ? `•••• ${row.iban.slice(-4)}` : 'Keine IBAN' }}</span
            ><span class="block mt-2">{{ observation(row) }}</span></template
          ><template #graphic><FinanceIcon name="accounts" /></template
        ></FinanceTile>
      </div>
      <div v-if="!accounts.length" class="empty-state">
        <h2>Noch keine Konten vorhanden.</h2>
        <p>Ein Konto ist optional. Importierte Buchungen bleiben auch ohne Zuordnung erhalten.</p>
        <UButton to="/accounts/add" variant="soft">Erstes Konto hinzufügen</UButton
        ><UButton to="/imports/csv" variant="ghost">CSV importieren</UButton>
      </div>
    </template>
    <template v-else-if="account">
      <FinanceTile
        label="Beobachteter gebuchter Saldo"
        :value="booked(account) ? money(booked(account)!.amountCents) : 'Kein Saldo'"
        :financial="Boolean(booked(account))"
        variant="account"
        :context="observation(account)"
      />
      <div class="toolbar my-5">
        <UButton :to="`/transactions?accountId=${account.id}`" variant="soft">Umsätze ansehen</UButton>
      </div>
      <SectionPanel title="Kontoinformationen" icon="accounts" class="mb-5"
        ><dl class="detail-list">
          <dt>Kontotyp</dt>
          <dd>{{ accountTypes[account.accountType] }}</dd>
          <dt>Währung</dt>
          <dd>{{ account.currency }}</dd>
          <dt>IBAN</dt>
          <dd>{{ account.iban || 'Keine IBAN hinterlegt' }}</dd>
          <dt>Verbindung</dt>
          <dd>{{ connectionName }}</dd>
          <dt>Letzter erfolgreicher Bankabruf</dt>
          <dd>
            {{ account.lastSuccessfulSyncAt ? observedTime(account.lastSuccessfulSyncAt) : 'Noch kein Bankabruf' }}
          </dd>
        </dl>
        <div v-for="balance in availableBalances" :key="balance.id" class="data-context">
          <span>Beobachteter verfügbarer Betrag</span><strong data-financial>{{ money(balance.amountCents) }}</strong
          ><small>{{ observedTime(balance.observedAt) }}</small>
        </div></SectionPanel
      >
      <SectionPanel title="Konto bearbeiten" icon="settings"
        ><UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" />
        <p v-if="saved" role="status">Änderungen gespeichert.</p>
        <UForm
          ref="validation"
          :schema="formSchema"
          :state="draft"
          :validate-on="[]"
          class="filter-grid"
          @submit="save"
          @error="formInvalid"
          ><UFormField label="Kontoname" name="name"><UInput v-model="draft.name" :disabled="busy" /></UFormField
          ><UFormField v-if="account.iban" label="Bankverbindung zuordnen" name="bankConnectionId"
            ><USelect v-model="draft.bankConnectionId" :items="options" :disabled="busy" /></UFormField
          ><UCheckbox v-model="draft.isActive" label="Aktiv" :disabled="busy" /><UButton type="submit" :loading="busy"
            >Speichern</UButton
          ></UForm
        ></SectionPanel
      >
    </template>
  </template>
</template>
