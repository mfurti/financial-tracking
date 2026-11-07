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
const { validation, formError } = useFormFeedback();
const route = useRoute();
const router = useRouter();
const connections = ref<Connection[]>([]);
const error = ref('');
const busy = ref(false);
const editing = ref('');
const form = reactive({
  name: 'Sparkasse Bodensee',
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
  CREATED: 'Vorbereitet',
  RUNNING: 'Bankabfrage läuft',
  WAITING_FOR_AUTH: 'Bankfreigabe erforderlich',
  COMMITTING: 'Umsätze werden gespeichert',
  COMPLETED: 'Abgeschlossen',
  PARTIAL_SUCCESS: 'Teilweise erfolgreich',
  FAILED: 'Abruf fehlgeschlagen',
  CANCELLED: 'Abgebrochen',
};
const failureHints: Record<string, string> = {
  BANK_NOT_CONFIGURED: 'Eigene Produktregistrierung und bestätigte Bankadresse müssen zuerst eingerichtet werden.',
  BANK_INVALID_CREDENTIALS:
    'Zugang abgelehnt. Anmeldename und PIN bei deiner Bank prüfen. Es erfolgt kein automatischer neuer Versuch.',
  BANK_AUTH_REJECTED: 'Bankfreigabe abgelehnt oder maximale Prüfversuche erreicht. Freigabe in der Banking-App prüfen.',
  BANK_AUTH_TIMEOUT: 'Bankfreigabe abgelaufen. Starte bei Bedarf einen neuen manuellen Abruf.',
  BANK_UNAVAILABLE:
    'Bank vorübergehend nicht erreichbar. Vorhandene Daten bleiben erhalten; später manuell erneut versuchen.',
  BANK_UNSUPPORTED:
    'Zugang oder Freigabeverfahren wird noch nicht unterstützt. Nutze CSV und prüfe das angebotene Verfahren.',
  BANK_ACCOUNT_FAILED:
    'Mindestens ein Konto konnte nicht vollständig gelesen werden. Erfolgreiche Konten wurden übernommen; übrige Daten bleiben erhalten.',
  SYNC_INTERRUPTED:
    'Der Server wurde während des Abrufs neu gestartet. Neue manuelle Anmeldung bei der Bank erforderlich.',
};
let timer: ReturnType<typeof setTimeout> | undefined;
let started = Date.now();
let stopped = false;
const finished = computed(
  /** Terminal states stop browser status polling. */ () =>
    !!activeRun.value && ['COMPLETED', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED'].includes(activeRun.value.status),
);
/** Reload configured connections without credentials. */
async function load() {
  loading.value = true;
  error.value = '';
  try {
    [connections.value, setup.value] = await Promise.all([
      api.request('/bank-connections', z.array(connectionSchema)),
      api.request('/bank-setup', bankSetupSchema),
    ]);
    selected.value ||=
      connections.value.find(
        /** Only FinTS connections can start a live run. */ (connection) => connection.connectorType === 'FINTS',
      )?.id ?? '';
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    loading.value = false;
  }
}
/** Save explicit connection settings; the bank URL remains server configuration. */
async function save() {
  busy.value = true;
  error.value = '';
  try {
    const body = connectionInputSchema.parse({ ...form, username: form.username || undefined });
    await api.request(editing.value ? `/bank-connections/${editing.value}` : '/bank-connections', connectionSchema, {
      method: editing.value ? 'PATCH' : 'POST',
      body,
    });
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
  if (timer) clearTimeout(timer);
  try {
    activeRun.value = await api.request(`/import-runs/${activeRun.value.id}`, runSchema);
    if (!finished.value && !stopped) timer = setTimeout(poll, Date.now() - started > 30_000 ? 5000 : 2000);
  } catch (cause) {
    error.value = formError(cause);
  }
}
/** Start a manual refresh and erase the PIN after the request completes. */
async function start() {
  if (busy.value || !setup.value?.configured) return;
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
    activeRun.value = await api.request(`/bank-connections/${selected.value}/sync`, runSchema, {
      method: 'POST',
      body,
    });
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
  if (!activeRun.value) return;
  busy.value = true;
  error.value = '';
  try {
    activeRun.value = await api.request(`/import-runs/${activeRun.value.id}/challenge`, runSchema, {
      method: 'POST',
      body: {
        tan: tan.value || undefined,
        tanMethodId: method.value || undefined,
        tanMediaName: medium.value || undefined,
      },
    });
    await poll();
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    tan.value = '';
    busy.value = false;
  }
}
/** Request worker termination before presenting cancellation as complete. */
async function cancel() {
  if (!activeRun.value) return;
  try {
    activeRun.value = await api.request(`/import-runs/${activeRun.value.id}/cancel`, runSchema, {
      method: 'POST',
      body: {},
    });
    if (timer) clearTimeout(timer);
  } catch (cause) {
    error.value = formError(cause);
  } finally {
    pin.value = '';
    tan.value = '';
  }
}
onMounted(
  /** Restore only a run identifier from the URL, never a credential. */ async () => {
    try {
      await load();
      if (typeof route.query.run === 'string') {
        activeRun.value = await api.request(`/import-runs/${route.query.run}`, runSchema);
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
    if (timer) clearTimeout(timer);
    pin.value = '';
    tan.value = '';
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">VERBUNDEN, WENN DU ES MÖCHTEST</p>
      <h1>Bankverbindungen</h1>
      <p class="muted">Manueller FinTS-Abruf oder CSV – die Kontrolle bleibt bei dir.</p>
    </div>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" /><UAlert
    v-if="setup && !setup.configured"
    color="info"
    title="Bankanbindung vorbereiten"
    description="Eigene FinTS-Produktregistrierung und bestätigte Bankadresse fehlen noch. Richte diese zuerst mit dem Administrator ein. CSV funktioniert sofort ohne Bankverbindung."
    class="mb-6"
  />
  <p v-if="loading" role="status" class="muted mb-5">Bankkonfiguration wird geladen …</p>
  <UButton v-if="error" variant="soft" class="mb-5" :loading="loading" @click="load"
    >Konfiguration erneut laden</UButton
  >
  <p v-if="setup?.configured" class="muted mb-5">
    Konfiguration vorhanden. Konten und Bankfreigabe müssen mit deinem Zugang geprüft werden.
  </p>
  <section class="panel mb-6">
    <h2 class="mb-4">{{ editing ? 'Verbindung bearbeiten' : 'Verbindung anlegen' }}</h2>
    <UForm ref="validation" :schema="connectionInputSchema" :state="form" class="form-row" @submit="save"
      ><UFormField label="Name" name="name"><UInput v-model="form.name" /></UFormField
      ><UFormField label="Bankleitzahl" name="bankCode"><UInput v-model="form.bankCode" maxlength="8" /></UFormField
      ><UFormField label="Verfahren" name="connectorType"
        ><USelect
          v-model="form.connectorType"
          :items="[
            { label: 'CSV-Import', value: 'CSV' },
            { label: 'FinTS (manuell)', value: 'FINTS' },
          ]" /></UFormField
      ><UFormField v-if="form.connectorType === 'FINTS'" label="Online-Banking-Anmeldename" name="username"
        ><UInput v-model="form.username" autocomplete="off" /></UFormField
      ><UButton type="submit" :loading="busy">{{
        editing ? 'Änderungen speichern' : 'Verbindung anlegen'
      }}</UButton></UForm
    >
  </section>
  <section class="panel mb-6">
    <p v-if="!connections.length" class="empty-copy">Noch keine Bankverbindung angelegt.</p>
    <div v-for="connection in connections" :key="connection.id" class="editable-row">
      <div class="grow">
        <strong>{{ connection.name }}</strong
        ><small class="block muted"
          >{{ connection.bankCode }} · {{ connection.connectorType }} ·
          {{ connection.status === 'ACTIVE' ? 'Aktiv' : 'Inaktiv' }}</small
        >
      </div>
      <UButton variant="soft" @click="edit(connection)">Bearbeiten</UButton
      ><UButton variant="ghost" color="neutral" @click="toggle(connection)">{{
        connection.status === 'ACTIVE' ? 'Deaktivieren' : 'Aktivieren'
      }}</UButton>
    </div>
  </section>
  <section class="panel">
    <h2 class="mb-4">Konten aktualisieren</h2>
    <p class="muted mb-5">
      Deine PIN wird nur für diesen Abruf im Arbeitsspeicher verwendet. Eine Bankfreigabe kann erforderlich sein.
    </p>
    <form class="form-row" @submit.prevent="start">
      <label
        >FinTS-Verbindung<select v-model="selected" class="control">
          <option value="">Verbindung wählen</option>
          <option
            v-for="connection in connections.filter((c) => c.connectorType === 'FINTS' && c.status === 'ACTIVE')"
            :key="connection.id"
            :value="connection.id"
          >
            {{ connection.name }}
          </option>
        </select></label
      ><UFormField label="Bank-PIN"
        ><UInput
          v-model="pin"
          type="password"
          autocomplete="off"
          :disabled="!setup?.configured || (!!activeRun && !finished)" /></UFormField
      ><label>Von (optional)<input v-model="fromDate" type="date" class="control" /></label>
      <label>Bis (optional)<input v-model="toDate" type="date" class="control" /></label>
      <UButton
        type="submit"
        :loading="busy"
        :disabled="!setup?.configured || !selected || !pin || (!!activeRun && !finished)"
        >Aktualisieren</UButton
      >
    </form>
    <article v-if="activeRun" class="sync-status mt-6" aria-live="polite">
      <p class="eyebrow">{{ statusLabels[activeRun.status] }}</p>
      <p>
        {{ activeRun.importedCount }} neue Umsätze · {{ activeRun.knownCount }} bekannte ·
        {{ activeRun.reviewRequiredCount }} zur Prüfung
      </p>
      <UAlert
        v-if="activeRun.errorCode"
        color="warning"
        :title="activeRun.errorCode"
        :description="
          failureHints[activeRun.errorCode] ??
          'Vorhandene Kontodaten bleiben erhalten. Prüfe Bankkonfiguration und Freigabe.'
        "
        class="my-4"
      />
      <form v-if="activeRun.challenge" class="space-y-4 mt-4" @submit.prevent="approve">
        <p>{{ activeRun.challenge.message }}</p>
        <select
          v-if="activeRun.challenge.type === 'SELECT_METHOD'"
          v-model.number="method"
          required
          aria-label="TAN-Verfahren"
          class="control"
        >
          <option value="">Verfahren wählen</option>
          <option v-for="choice in activeRun.challenge.methods" :key="choice.id" :value="choice.id">
            {{ choice.name }}
          </option>
        </select>
        <label v-if="activeRun.challenge.type === 'SELECT_MEDIA'"
          >TAN-Medium<select v-model="medium" required class="control" aria-label="TAN-Medium">
            <option value="">Medium wählen</option>
            <option v-for="choice in activeRun.challenge.media" :key="choice" :value="choice">{{ choice }}</option>
          </select></label
        >
        <UFormField v-if="activeRun.challenge.type === 'TAN'" label="TAN"
          ><UInput v-model="tan" type="password" autocomplete="off" /></UFormField
        ><UButton type="submit" :loading="busy">{{
          activeRun.challenge.type === 'APP_APPROVAL' ? 'Freigabe in Banking-App erfolgt' : 'Fortsetzen'
        }}</UButton>
      </form>
      <div class="toolbar mt-4">
        <UButton v-if="!finished" variant="ghost" color="neutral" @click="cancel">Abruf abbrechen</UButton
        ><UButton v-if="finished" :to="`/imports?run=${activeRun.id}`" variant="soft">Ergebnis ansehen</UButton>
      </div>
    </article>
  </section>
</template>
