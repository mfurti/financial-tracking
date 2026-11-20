<script setup lang="ts">
import { z } from 'zod';
import {
  connectionSchema,
  connectionInputSchema,
  syncInputSchema,
  runSchema,
  bankSetupSchema,
  type Connection,
  type ImportRun,
} from '@financial-tracking/contracts';

const api = useApi();
const { validation, formError, formInvalid } = useFormFeedback();
const route = useRoute();
const router = useRouter();
const connections = ref<Connection[]>([]);
const error = ref('');
const busy = ref(false);
const editing = ref('');
const form = reactive({
  name: tr('Sparkasse Bodensee'),
  bankCode: '69050001',
  connectorType: 'CSV' as 'CSV' | 'FINTS',
  username: '',
});
const selected = ref('');
const pin = ref('');
const tan = ref('');
const method = ref<number | ''>('');
const medium = ref('');
const activeRun = ref<ImportRun | null>(null);
const setup = ref<z.infer<typeof bankSetupSchema> | null>(null);
const fromDate = ref('');
const toDate = ref('');
const loading = ref(true);
const statusLabels: Record<string, string> = {
  CREATED: tr('Vorbereitet'),
  RUNNING: tr('Bankabfrage läuft'),
  WAITING_FOR_AUTH: tr('Bankfreigabe erforderlich'),
  COMMITTING: tr('Umsätze werden gespeichert'),
  COMPLETED: tr('Abgeschlossen'),
  PARTIAL_SUCCESS: tr('Teilweise erfolgreich'),
  FAILED: tr('Abruf fehlgeschlagen'),
  CANCELLED: tr('Abgebrochen'),
};
const failureHints: Record<string, string> = {
  BANK_NOT_CONFIGURED: tr('Eigene Produktregistrierung und bestätigte Bankadresse müssen zuerst eingerichtet werden.'),
  BANK_INVALID_CREDENTIALS: tr(
    'Zugang abgelehnt. Anmeldename und PIN bei deiner Bank prüfen. Es erfolgt kein automatischer neuer Versuch.',
  ),
  BANK_AUTH_REJECTED: tr(
    'Bankfreigabe abgelehnt oder maximale Prüfversuche erreicht. Freigabe in der Banking-App prüfen.',
  ),
  BANK_AUTH_TIMEOUT: tr('Bankfreigabe abgelaufen. Starte bei Bedarf einen neuen manuellen Abruf.'),
  BANK_UNAVAILABLE: tr(
    'Bank vorübergehend nicht erreichbar. Vorhandene Daten bleiben erhalten; später manuell erneut versuchen.',
  ),
  BANK_UNSUPPORTED: tr(
    'Zugang oder Freigabeverfahren wird noch nicht unterstützt. Nutze CSV und prüfe das angebotene Verfahren.',
  ),
  BANK_ACCOUNT_FAILED: tr(
    'Mindestens ein Konto konnte nicht vollständig gelesen werden. Erfolgreiche Konten wurden übernommen; übrige Daten bleiben erhalten.',
  ),
  SYNC_INTERRUPTED: tr(
    'Der Server wurde während des Abrufs neu gestartet. Neue manuelle Anmeldung bei der Bank erforderlich.',
  ),
};
let timer: ReturnType<typeof setTimeout> | undefined;
let started = Date.now();
let stopped = false;
let pollGeneration = 0;
let loadGeneration = 0;
/** Invalidate in-flight status reads before a newer authorization decision and clear the owned timer. */
function stopPolling() {
  pollGeneration++;
  if (timer) clearTimeout(timer);
}
const finished = computed(
  /** Terminal states stop browser status polling. */ () =>
    !!activeRun.value && ['COMPLETED', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED'].includes(activeRun.value.status),
);
/** Reload configured connections without credentials. */
async function load() {
  const generation = ++loadGeneration;
  loading.value = true;
  error.value = '';
  try {
    const [choices, configuration] = await Promise.all([
      api.request('/bank-connections', z.array(connectionSchema)),
      api.request('/bank-setup', bankSetupSchema),
    ]);
    if (stopped || generation !== loadGeneration) return;
    connections.value = choices;
    setup.value = configuration;
    selected.value ||=
      connections.value.find(
        /** Only FinTS connections can start a live run. */ (connection) => connection.connectorType === 'FINTS',
      )?.id ?? '';
  } catch (cause) {
    if (!stopped && generation === loadGeneration) error.value = formError(cause);
  } finally {
    if (!stopped && generation === loadGeneration) loading.value = false;
  }
}
/** Save explicit connection settings; the bank URL remains server configuration. */
async function save() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const body = connectionInputSchema.parse({ ...form, username: form.username || undefined });
    await api.request(editing.value ? `/bank-connections/${editing.value}` : '/bank-connections', connectionSchema, {
      method: editing.value ? 'PATCH' : 'POST',
      body,
    });
    if (stopped) return;
    editing.value = '';
    await load();
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    busy.value = false;
  }
}
/** Edit public settings in the same form. */
function edit(connection: Connection) {
  editing.value = connection.id;
  Object.assign(form, {
    name: connection.name,
    bankCode: connection.bankCode,
    connectorType: connection.connectorType,
    username: connection.username ?? '',
  });
}
/** Disable a connection without deleting its historical records. */
async function toggle(connection: Connection) {
  try {
    await api.request(`/bank-connections/${connection.id}`, connectionSchema, {
      method: 'PATCH',
      body: { status: connection.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' },
    });
    await load();
  } catch (cause) {
    error.value = formError(cause);
  }
}
/** Poll an existing run; reloading this page never starts another bank request. */
async function poll() {
  if (!activeRun.value || stopped) return;
  const generation = ++pollGeneration;
  const id = activeRun.value.id;
  if (timer) clearTimeout(timer);
  try {
    const response = await api.request(`/import-runs/${id}`, runSchema);
    if (stopped || generation !== pollGeneration || activeRun.value?.id !== id) return;
    activeRun.value = response;
    if (!finished.value && !stopped) timer = setTimeout(poll, Date.now() - started > 30_000 ? 5000 : 2000);
  } catch (cause) {
    if (!stopped && generation === pollGeneration) error.value = formError(cause);
  }
}
/** Start a manual refresh and erase the PIN after the request completes. */
async function start() {
  if (stopped || busy.value || !setup.value?.configured || (activeRun.value && !finished.value)) return;
  stopPolling();
  busy.value = true;
  error.value = '';
  try {
    const body = syncInputSchema.parse({
      pin: pin.value,
      fromDate: fromDate.value || undefined,
      toDate: toDate.value || undefined,
    });
    method.value = '';
    medium.value = '';
    const response = await api.request(`/bank-connections/${selected.value}/sync`, runSchema, {
      method: 'POST',
      body,
    });
    if (stopped) return;
    activeRun.value = response;
    started = Date.now();
    await router.replace({ query: { run: activeRun.value.id } });
    await poll();
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    pin.value = '';
    busy.value = false;
  }
}
/** Submit only the current authorization response, never storing it outside the component. */
async function approve() {
  if (stopped || busy.value || !activeRun.value?.challenge) return;
  stopPolling();
  busy.value = true;
  error.value = '';
  try {
    const response = await api.request(`/import-runs/${activeRun.value.id}/challenge`, runSchema, {
      method: 'POST',
      body: {
        tan: tan.value || undefined,
        tanMethodId: method.value || undefined,
        tanMediaName: medium.value || undefined,
      },
    });
    if (stopped) return;
    activeRun.value = response;
    await poll();
  } catch (cause) {
    if (!stopped) {
      error.value = formError(cause);
      if (!finished.value) void poll();
    }
  } finally {
    tan.value = '';
    busy.value = false;
  }
}
/** Request worker termination before presenting cancellation as complete. */
async function cancel() {
  if (stopped || busy.value || !activeRun.value) return;
  stopPolling();
  busy.value = true;
  error.value = '';
  try {
    const response = await api.request(`/import-runs/${activeRun.value.id}/cancel`, runSchema, {
      method: 'POST',
      body: {},
    });
    if (!stopped) activeRun.value = response;
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    pin.value = '';
    tan.value = '';
    busy.value = false;
    if (!stopped && !finished.value) void poll();
  }
}
onMounted(
  /** Restore only a run identifier from the URL, never a credential. */ async () => {
    try {
      await load();
      if (stopped) return;
      if (typeof route.query.run === 'string') {
        const restored = await api.request(`/import-runs/${route.query.run}`, runSchema);
        if (stopped) return;
        activeRun.value = restored;
        await poll();
      }
    } catch (cause) {
      error.value = formError(cause);
    }
  },
);
onBeforeUnmount(
  /** Release browser secrets and polling; the backend run retains its own bounded lifetime. */ () => {
    stopped = true;
    stopPolling();
    loadGeneration++;
    pin.value = '';
    tan.value = '';
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">{{ tr('VERBUNDEN, WENN DU ES MÖCHTEST') }}</p>
      <h1>{{ tr('Bankverbindungen') }}</h1>
      <p class="muted">{{ tr('Manueller FinTS-Abruf oder CSV – die Kontrolle bleibt bei dir.') }}</p>
    </div>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" /><UAlert
    v-if="setup && !setup.configured"
    color="info"
    :title="tr('Bankanbindung vorbereiten')"
    :description="
      tr(
        'Eigene FinTS-Produktregistrierung und bestätigte Bankadresse fehlen noch. Richte diese zuerst mit dem Administrator ein. CSV funktioniert sofort ohne Bankverbindung.',
      )
    "
    class="mb-6"
  />
  <p v-if="loading" role="status" class="muted mb-5">{{ tr('Bankkonfiguration wird geladen …') }}</p>
  <UButton v-if="error" variant="soft" class="mb-5" :loading="loading" @click="load">{{
    tr('Konfiguration erneut laden')
  }}</UButton>
  <p v-if="setup?.configured" class="muted mb-5">
    {{ tr('Konfiguration vorhanden. Konten und Bankfreigabe müssen mit deinem Zugang geprüft werden.') }}
  </p>
  <div class="connection-maintenance">
    <SectionPanel :title="editing ? tr('Verbindung bearbeiten') : tr('Verbindung anlegen')" icon="settings" compact>
      <UForm
        ref="validation"
        :schema="translatedSchema(connectionInputSchema)"
        :state="form"
        :validate-on="[]"
        class="connection-form"
        @submit="save"
        @error="formInvalid"
        ><fieldset :disabled="busy" class="grid min-w-0 gap-4">
          <UFormField :label="tr('Name')" name="name"><UInput v-model="form.name" /></UFormField
          ><UFormField :label="tr('Bankleitzahl')" name="bankCode"
            ><UInput v-model="form.bankCode" maxlength="8" /></UFormField
          ><UFormField :label="tr('Verfahren')" name="connectorType"
            ><USelect
              v-model="form.connectorType"
              :items="[
                { label: tr('CSV-Import'), value: 'CSV' },
                { label: tr('FinTS (manuell)'), value: 'FINTS' },
              ]" /></UFormField
          ><UFormField v-if="form.connectorType === 'FINTS'" :label="tr('Online-Banking-Anmeldename')" name="username"
            ><UInput v-model="form.username" autocomplete="off" /></UFormField
          ><UButton type="submit" :loading="busy">{{
            editing ? tr('Änderungen speichern') : tr('Verbindung anlegen')
          }}</UButton>
        </fieldset></UForm
      >
    </SectionPanel>
    <SectionPanel :title="tr('Deine Verbindungen')" icon="accounts" compact>
      <p v-if="!connections.length && !loading && !error" class="empty-copy">
        {{ tr('Noch keine Bankverbindung angelegt.') }}
      </p>
      <div v-for="connection in connections" :key="connection.id" class="editable-row">
        <div class="grow">
          <strong>{{ connection.name }}</strong
          ><small class="block muted"
            >{{ connection.bankCode }} · {{ connection.connectorType }} ·
            {{ connection.status === 'ACTIVE' ? tr('Aktiv') : tr('Inaktiv') }}</small
          >
        </div>
        <UButton :disabled="busy" variant="soft" @click="edit(connection)">{{ tr('Bearbeiten') }}</UButton
        ><UButton :disabled="busy" variant="ghost" color="neutral" @click="toggle(connection)">{{
          connection.status === 'ACTIVE' ? tr('Deaktivieren') : tr('Aktivieren')
        }}</UButton>
      </div>
    </SectionPanel>
  </div>
  <SectionPanel :title="tr('Konten aktualisieren')" icon="accounts" compact>
    <p class="muted mb-5">
      {{
        tr(
          'Deine PIN wird nur für diesen Abruf im Arbeitsspeicher verwendet. Eine Bankfreigabe kann erforderlich sein.',
        )
      }}
    </p>
    <form class="form-row" @submit.prevent="start">
      <label
        >{{ tr('FinTS-Verbindung')
        }}<ChoiceSelect
          v-model="selected"
          :searchable="true"
          :disabled="busy || (!!activeRun && !finished)"
          :items="[
            { label: tr('Verbindung wählen'), value: '' },
            ...connections
              .filter((c) => c.connectorType === 'FINTS' && c.status === 'ACTIVE')
              .map(
                /** Build a persisted choice. */ (connection) => ({
                  label: `${connection.name}`,
                  value: connection.id,
                }),
              ),
          ]" /></label
      ><UFormField :label="tr('Bank-PIN')"
        ><UInput
          v-model="pin"
          type="password"
          autocomplete="off"
          :disabled="!setup?.configured || (!!activeRun && !finished)" /></UFormField
      ><label>{{ tr('Von (optional)') }}<DatePicker v-model="fromDate" :label="tr('Von (optional)')" /></label>
      <label>{{ tr('Bis (optional)') }}<DatePicker v-model="toDate" :label="tr('Bis (optional)')" /></label>
      <UButton
        type="submit"
        :loading="busy"
        :disabled="!setup?.configured || !selected || !pin || (!!activeRun && !finished)"
        >{{ tr('Aktualisieren') }}</UButton
      >
    </form>
    <article v-if="activeRun" class="sync-status mt-6" aria-live="polite">
      <p class="eyebrow">{{ statusLabels[activeRun.status] }}</p>
      <p>
        {{ activeRun.importedCount }} {{ tr('neue Umsätze ·') }} {{ activeRun.knownCount }} {{ tr('bekannte ·') }}
        {{ activeRun.reviewRequiredCount }} {{ tr('zur Prüfung') }}
      </p>
      <UAlert
        v-if="activeRun.errorCode"
        color="warning"
        :title="activeRun.errorCode"
        :description="
          failureHints[activeRun.errorCode] ??
          tr('Vorhandene Kontodaten bleiben erhalten. Prüfe Bankkonfiguration und Freigabe.')
        "
        class="my-4"
      />
      <form v-if="activeRun.challenge" class="space-y-4 mt-4" @submit.prevent="approve">
        <fieldset :disabled="busy" class="space-y-4 min-w-0">
          <p>{{ activeRun.challenge.message }}</p>
          <ChoiceSelect
            v-if="activeRun.challenge.type === 'SELECT_METHOD'"
            v-model="method"
            required
            :aria-label="tr('TAN-Verfahren')"
            :searchable="true"
            :items="[
              { label: tr('Verfahren wählen'), value: '' },
              ...(activeRun.challenge.methods ?? []).map(
                /** Build a persisted choice. */ (choice) => ({ label: `${choice.name}`, value: choice.id }),
              ),
            ]"
          />
          <label v-if="activeRun.challenge.type === 'SELECT_MEDIA'"
            >{{ tr('TAN-Medium')
            }}<ChoiceSelect
              v-model="medium"
              required
              :aria-label="tr('TAN-Medium')"
              :searchable="true"
              :items="[
                { label: tr('Medium wählen'), value: '' },
                ...(activeRun.challenge.media ?? []).map(
                  /** Build a persisted choice. */ (choice) => ({ label: `${choice}`, value: choice }),
                ),
              ]"
          /></label>
          <UFormField v-if="activeRun.challenge.type === 'TAN'" :label="tr('TAN')"
            ><UInput v-model="tan" type="password" autocomplete="off" /></UFormField
          ><UButton type="submit" :loading="busy">{{
            activeRun.challenge.type === 'APP_APPROVAL' ? tr('Freigabe in Banking-App erfolgt') : 'Fortsetzen'
          }}</UButton>
        </fieldset>
      </form>
      <div class="toolbar mt-4">
        <UButton
          v-if="!finished"
          :disabled="busy || activeRun.status === 'COMMITTING'"
          variant="ghost"
          color="neutral"
          @click="cancel"
          >{{ tr('Abruf abbrechen') }}</UButton
        ><UButton v-if="finished" :to="`/imports?run=${activeRun.id}`" variant="soft">{{
          tr('Ergebnis ansehen')
        }}</UButton>
      </div>
    </article>
  </SectionPanel>
</template>

<style scoped>
.connection-maintenance {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  margin-bottom: 24px;
  align-items: start;
}
.connection-maintenance > * {
  min-width: 0;
}
.editable-row {
  min-height: 56px;
  gap: 12px;
}
.sync-status {
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--soft);
  overflow-wrap: anywhere;
}
@media (max-width: 1100px) {
  .connection-maintenance {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }
}
</style>
