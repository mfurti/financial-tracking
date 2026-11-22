<script setup lang="ts">
import { z } from 'zod';
import {
  accountSchema,
  accountTableItemSchema,
  accountTablePageSchema,
  accountPatchSchema,
  connectionSchema,
  idSchema,
  type Account,
  type Connection,
} from '@financial-tracking/contracts';
const api = useApi();
const { validation, formError, formInvalid } = useFormFeedback();
const route = useRoute();
const router = useRouter();
const accounts = ref<Account[]>([]);
const accountType = computed({
  /** Restore the account type filter from the list bookmark. */
  get: () => (typeof route.query.accountType === 'string' ? route.query.accountType : ''),
  /** Changing account type starts a new first page. */
  set: (value) => {
    void router.push({ query: { ...route.query, accountType: value || undefined, page: undefined } });
  },
});
const listing = useLedgerTable({
  endpoint: 'accounts/table',
  schema: accountTablePageSchema.extend({ items: z.array(accountTableItemSchema) }),
  fields: Object.keys(accountTableItemSchema.shape),
  sortable: ['name', 'accountType'],
  /** Pass account type and bookmarked group scope to the backend before paging. */
  filters: () => ({
    accountType: accountType.value || undefined,
    groupId: typeof route.query.groupId === 'string' ? route.query.groupId : undefined,
  }),
});
const {
  items: visibleAccounts,
  page: tablePage,
  sorting: tableSorting,
  itemsPerPage: tableSize,
  totalItems: tableTotal,
} = listing;
const sortFields = [
  { value: 'name', label: tr('Name') },
  { value: 'accountType', label: tr('Kontotyp') },
];
const tableError = computed(
  /** Keep the list error independent of account details and the latest balance summary. */ () =>
    listing.error.value ? userErrorMessage(listing.error.value) : '',
);

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
/** A recorded balance is known only for a real active EUR account with a booked observation. */
function knownTotal(rows: readonly Account[]) {
  const balances = rows.filter((row) => row.currency === 'EUR').flatMap((row) => booked(row) ?? []);
  return balances.length ? balances.reduce((sum, value) => sum + BigInt(value.amountCents), 0n) : null;
}
const balanceSummary = computed(() => {
  const providers = new Set(
    connections.value
      .filter((connection) => /^scalable(?: capital)?$/i.test(connection.name.trim()))
      .map((connection) => connection.id),
  );
  const brokerage = active.value.filter((row) => providers.has(row.bankConnectionId));
  const bank = active.value.filter((row) => !providers.has(row.bankConnectionId));
  return [
    { label: 'Gesamtvermögen', balance: knownTotal(active.value) },
    { label: 'Bankguthaben', balance: knownTotal(bank) },
    { label: 'Scalable', balance: knownTotal(brokerage) },
  ];
});
const connectionName = computed(
  /** Resolve confirmed account ownership to a persisted connection label. */ () =>
    connections.value.find(
      /** Match only the confirmed connection UUID. */ (row) => row.id === account.value?.bankConnectionId,
    )?.name ?? tr('Nicht verfügbar'),
);
const availableBalances = computed(
  /** Show available observations separately without replacing the booked balance. */ () =>
    account.value?.balances.filter(
      /** Retain only the explicit available source type. */ (row) => row.balanceType === 'AVAILABLE',
    ) ?? [],
);
const accountTypes = { CHECKING: tr('Girokonto'), SAVINGS: tr('Sparkonto'), OTHER: tr('Sonstiges Konto') };

/** Resolve an actual booked balance; available credit is never substituted for missing booked observations. */
function booked(row: Pick<Account, 'balances'>) {
  return row.balances.find(
    /** Match the explicit source balance type. */ (balance) => balance.balanceType === 'BOOKED',
  );
}
/** Keep source time and missing coverage distinct from current-month transaction actuals. */
function observation(row: Account) {
  const value = booked(row);
  return value
    ? `${observedTime(value.observedAt)}${Date.now() - Date.parse(value.observedAt) > 48 * 3600000 ? tr('· älter als 48 Stunden') : ''}`
    : tr('Kein beobachteter Saldo · CSV-Umsätze ersetzen keinen Kontostand.');
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
    if (!route.params.id) await listing.start();
    if (disposed || current !== generation) return;
    const selected = records.find(
      /** Initialize drafts from a confirmed persisted identity only. */ (row) => row.id === route.params.id,
    );
    if (selected)
      Object.assign(draft, {
        name: selected.name,
        isActive: selected.isActive,
        bankConnectionId: selected.bankConnectionId,
      });
    else if (route.params.id) loadError.value = tr('Konto nicht gefunden.');
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
    <h1>{{ account && route.params.id ? account.name : route.params.id ? tr('Kontodetails') : tr('Konten') }}</h1>
    <div v-if="route.params.id" class="toolbar">
      <UButton to="/accounts" variant="soft">{{ tr('Alle Konten') }}</UButton>
      <UButton to="/connections" variant="soft">{{ tr('Bankverbindungen') }}</UButton>
      <UButton :disabled="loading || busy" variant="ghost" @click="load">{{ tr('Aktualisieren') }}</UButton>
    </div>
  </div>
  <UAlert v-if="loadError" role="alert" color="error" :description="loadError" class="mb-4" />
  <UButton v-if="loadError" :disabled="loading" @click="load">{{ tr('Erneut versuchen') }}</UButton>
  <FinanceTile v-if="loading" :label="tr('Konten')" variant="stat" state="loading" />
  <template v-else-if="!loadError">
    <template v-if="!route.params.id">
      <div class="toolbar finance-accounts-actions">
        <ChoiceSelect
          v-model="accountType"
          :aria-label="tr('Kontotyp')"
          :items="[
            { label: tr('Alle Konten'), value: '' },
            ...Object.entries(accountTypes).map(([value, label]) => ({ value, label })),
          ]"
        />
        <UButton to="/accounts/add">{{ tr('Konto hinzufügen') }}</UButton>
        <UButton to="/transactions?period=all&amp;mode=transfer" variant="soft">{{ tr('Geld verschieben') }}</UButton>
        <UPopover>
          <UButton variant="ghost" color="neutral" :aria-label="tr('Weitere Aktionen')"
            ><FinanceIcon name="more"
          /></UButton>
          <template #content
            ><div class="finance-overview-actions">
              <UButton to="/connections" variant="ghost">{{ tr('Bankverbindungen') }}</UButton>
              <UButton to="/wealth" variant="ghost">{{ tr('Reserve & Vermögen') }}</UButton>
              <UButton :disabled="loading || busy" variant="ghost" @click="load">{{ tr('Aktualisieren') }}</UButton>
              <small>{{ tr('Nur bekannte EUR-Kontostände') }}</small>
            </div></template
          >
        </UPopover>
      </div>
      <div class="finance-summary-grid finance-account-summary">
        <FinanceTile
          v-for="item in balanceSummary"
          :key="item.label"
          :class="{ 'finance-summary-primary': item.label === 'Gesamtvermögen' }"
          :label="tr(item.label)"
          :value="item.balance === null ? tr('Noch kein Saldo') : money(item.balance)"
          :financial="item.balance !== null"
          variant="stat"
        />
      </div>
      <LedgerTableSorting v-if="accounts.length" v-model="tableSorting" :fields="sortFields" />
      <UAlert v-if="tableError" role="alert" color="error" :description="tableError" class="mb-4" />
      <UButton v-if="tableError" variant="soft" @click="listing.refresh">{{ tr('Erneut versuchen') }}</UButton>
      <p v-if="listing.loading.value" role="status" class="muted">{{ tr('Wird geladen …') }}</p>
      <p
        v-else-if="listing.loaded.value && accounts.length && !visibleAccounts.length && !tableError"
        class="empty-copy"
      >
        {{ tr('Keine Konten für diese Auswahl.') }}
      </p>
      <div class="finance-account-grid mt-5">
        <FinanceTile
          v-for="row in visibleAccounts"
          :key="row.id"
          :data-account-card="row.id"
          :label="row.name"
          :value="booked(row) ? money(booked(row)!.amountCents) : tr('Kein Saldo')"
          :financial="Boolean(booked(row))"
          variant="account"
          :to="`/accounts/${row.id}`"
          ><template #context
            ><span
              >{{ accountTypes[row.accountType] }}<template v-if="!row.isActive"> · {{ tr('Inaktiv') }}</template></span
            ></template
          ><template #graphic><FinanceIcon name="accounts" /></template
        ></FinanceTile>
      </div>
      <LedgerTablePagination
        v-if="tableTotal > 0"
        v-model:page="tablePage"
        :per-page="tableSize"
        :total="tableTotal"
        @page-size="listing.setPageSize"
      />
      <div v-if="!accounts.length" class="empty-state">
        <h2>{{ tr('Noch keine Konten vorhanden.') }}</h2>
        <UButton to="/accounts/add" variant="soft">{{ tr('Erstes Konto hinzufügen') }}</UButton
        ><UButton to="/imports/csv" variant="ghost">{{ tr('CSV importieren') }}</UButton>
      </div>
    </template>
    <template v-else-if="account">
      <FinanceTile
        :label="tr('Beobachteter gebuchter Saldo')"
        :value="booked(account) ? money(booked(account)!.amountCents) : tr('Kein Saldo')"
        :financial="Boolean(booked(account))"
        variant="account"
        :context="observation(account)"
      />
      <div class="toolbar my-5">
        <UButton :to="`/transactions?accountId=${account.id}`" variant="soft">{{ tr('Umsätze ansehen') }}</UButton>
      </div>
      <ReserveGoalTile :account="account" />
      <SectionPanel :title="tr('Kontoinformationen')" icon="accounts" class="mb-5"
        ><dl class="detail-list">
          <dt>{{ tr('Kontotyp') }}</dt>
          <dd>{{ accountTypes[account.accountType] }}</dd>
          <dt>{{ tr('Währung') }}</dt>
          <dd>{{ account.currency }}</dd>
          <dt>IBAN</dt>
          <dd>{{ account.iban || tr('Keine IBAN hinterlegt') }}</dd>
          <dt>{{ tr('Verbindung') }}</dt>
          <dd>{{ connectionName }}</dd>
          <dt>{{ tr('Letzter erfolgreicher Bankabruf') }}</dt>
          <dd>
            {{ account.lastSuccessfulSyncAt ? observedTime(account.lastSuccessfulSyncAt) : tr('Noch kein Bankabruf') }}
          </dd>
        </dl>
        <div v-for="balance in availableBalances" :key="balance.id" class="data-context">
          <span>{{ tr('Beobachteter verfügbarer Betrag') }}</span
          ><strong data-financial
            ><template v-if="!amountsMasked()">{{ money(balance.amountCents) }}</template
            ><template v-else>{{ tr('Betrag ausgeblendet') }}</template></strong
          ><small>{{ observedTime(balance.observedAt) }}</small>
        </div></SectionPanel
      >
      <SectionPanel :title="tr('Konto bearbeiten')" icon="settings"
        ><UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" />
        <p v-if="saved" role="status">{{ tr('Änderungen gespeichert.') }}</p>
        <UForm
          ref="validation"
          :schema="translatedSchema(formSchema)"
          :state="draft"
          :validate-on="[]"
          class="filter-grid"
          @submit="save"
          @error="formInvalid"
          ><UFormField :label="tr('Kontoname')" name="name"><UInput v-model="draft.name" :disabled="busy" /></UFormField
          ><UFormField v-if="account.iban" :label="tr('Bankverbindung zuordnen')" name="bankConnectionId"
            ><USelect v-model="draft.bankConnectionId" :items="options" :disabled="busy" /></UFormField
          ><UCheckbox v-model="draft.isActive" :label="tr('Aktiv')" :disabled="busy" /><UButton
            type="submit"
            :loading="busy"
            >{{ tr('Speichern') }}</UButton
          ></UForm
        ></SectionPanel
      >
    </template>
  </template>
</template>
