<script setup lang="ts">
import { z } from 'zod';
import {
  issueSchema,
  runSchema,
  accountSchema,
  categorySchema,
  type ImportRun,
  type Account,
  type Category,
} from '@financial-tracking/contracts';

const api = useApi();
const route = useRoute();
const runs = ref<ImportRun[]>([]);
const issues = ref<z.infer<typeof issueSchema>[]>([]);
const selectedRun = ref(String(route.query.run ?? ''));
const matches = reactive<Record<string, string>>({});
const error = ref('');
const busy = ref(false);
const accounts = ref<Account[]>([]);
const categories = ref<Category[]>([]);
/** Resolve only the currently offered comparison target. */
function candidate(issue: z.infer<typeof issueSchema>) {
  return issue.candidates?.find(
    /** Do not infer a match merely from the first candidate. */ (row) => row.id === matches[issue.id],
  );
}
/** Keep unassigned entries visible alongside their true account associations. */
function accountName(id: string | null) {
  return accounts.value.find(/** Match a real account identifier. */ (row) => row.id === id)?.name ?? 'Ohne Konto';
}
/** Read the manual target annotation without changing it during comparison. */
function categoryName(id: string | null) {
  return (
    categories.value.find(/** Use the current public category name. */ (row) => row.id === id)?.name ??
    'Nicht kategorisiert'
  );
}
/** Describe source provenance in product language, including unknown migrated records. */
function sourceNames(values?: string[]) {
  return (
    values
      ?.map(
        /** Do not present a migrated unknown source as a verified bank read. */ (value) =>
          value === 'FINTS' ? 'Bank' : value === 'CSV' ? 'CSV' : 'Bestand',
      )
      .join(', ') || 'Bestand'
  );
}
const labels: Record<string, string> = {
  CREATED: 'Vorschau',
  RUNNING: 'Läuft',
  WAITING_FOR_AUTH: 'Freigabe ausstehend',
  COMMITTING: 'Wird gespeichert',
  COMPLETED: 'Abgeschlossen',
  PARTIAL_SUCCESS: 'Teilweise erfolgreich',
  FAILED: 'Fehlgeschlagen',
  CANCELLED: 'Abgebrochen',
};
/** Load recent history and the selected review queue. */
async function load() {
  busy.value = true;
  error.value = '';
  try {
    [runs.value, accounts.value, categories.value] = await Promise.all([
      api.request('/imports', z.array(runSchema)),
      api.request('/accounts', z.array(accountSchema)),
      api.request('/categories', z.array(categorySchema)),
    ]);
    if (selectedRun.value)
      issues.value = await api.request(`/imports/${selectedRun.value}/issues`, z.array(issueSchema));
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}
/** Select a run and keep the review page bookmarkable. */
async function select(id: string) {
  selectedRun.value = id;
  await navigateTo({ path: '/imports', query: { run: id } });
  await load();
}
/** Apply a deliberate duplicate decision to one staged row. */
async function resolve(issueId: string, action: 'NEW' | 'MATCH' | 'SKIP' | 'EXISTING' | 'INCOMING') {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await api.request(`/imports/${selectedRun.value}/resolutions`, runSchema, {
      method: 'POST',
      body: {
        resolutions: [
          {
            issueId,
            action,
            transactionId: matches[issueId] || undefined,
            candidateVersion: issues.value.find(
              /** Bind replacement to the version actually displayed. */ (issue) => issue.id === issueId,
            )?.candidateVersions?.[matches[issueId] ?? ''],
          },
        ],
      },
    });
    await load();
  } catch (cause) {
    error.value = (cause as Error).message;
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">NACHVOLLZIEHBAR BIS ZUR BUCHUNG</p>
      <h1>Importe & Prüfungen</h1>
      <p class="muted">Ergebnisse ansehen und mögliche Dubletten selbst entscheiden.</p>
    </div>
    <div class="toolbar">
      <UButton :loading="busy" variant="ghost" @click="load">Neu laden</UButton
      ><UButton to="/imports/csv">CSV importieren</UButton>
    </div>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <section class="panel mb-6">
    <p v-if="!runs.length" class="empty-copy">
      Noch keine Importe. Starte mit einer CSV-Datei oder deiner Bankverbindung.
    </p>
    <button
      v-for="run in runs"
      :key="run.id"
      type="button"
      class="import-row"
      :class="{ 'selected-row': selectedRun === run.id }"
      @click="select(run.id)"
    >
      <div>
        <strong>{{ run.source }} · {{ labels[run.status] }}</strong
        ><small
          >{{ observedTime(run.startedAt) }}<span v-if="run.errorCode"> · {{ run.errorCode }}</span></small
        >
      </div>
      <span>{{ run.importedCount }} neu · {{ run.knownCount }} bekannt · {{ run.reviewRequiredCount }} prüfen</span>
    </button>
  </section>
  <section v-if="selectedRun" class="panel">
    <div class="panel-heading">
      <h2>Offene Prüfungen</h2>
      <span class="subtle-tag">{{ issues.length }} Einträge angezeigt</span>
    </div>
    <p v-if="!issues.length" class="empty-copy">Keine offenen Hinweise für diesen Import.</p>
    <article v-for="issue in issues" :key="issue.id" class="review-card">
      <p class="eyebrow">ZEILE {{ issue.rowNumber ?? '–' }} · {{ issue.code }}</p>
      <h3>{{ issue.message }}</h3>
      <div v-if="issue.incoming" class="review-incoming">
        <strong>{{ issue.incoming.description }}</strong
        ><span
          >{{ calendarDate(issue.incoming.bookingDate) }} · {{ money(issue.incoming.amountCents) }} ·
          {{ issue.incoming.counterpartyName || 'Keine Gegenpartei' }}</span
        >
      </div>
      <template v-if="issue.incoming"
        ><p>
          {{ issue.incomingSource === 'FINTS' ? 'Bank' : 'CSV' }} · {{ accountName(issue.incoming.accountId) }} ·
          {{ issue.incoming.status === 'BOOKED' ? 'Gebucht' : 'Vorgemerkt' }}
        </p>
        <p class="reference-copy">Referenz: {{ issue.incomingReference || 'Nicht geliefert' }}</p>
        <label
          >Bekannte Buchung auswählen<select
            v-model="matches[issue.id]"
            aria-label="Bekannte Buchung auswählen"
            class="control"
          >
            <option value="">Kandidat wählen</option>
            <option v-for="option in issue.candidates" :key="option.id" :value="option.id">
              {{ calendarDate(option.bookingDate) }} · {{ option.description }} ·
              {{ money(option.amountCents) }}
            </option>
          </select></label
        >
        <div v-if="candidate(issue)" class="mt-4">
          <p>
            {{ candidate(issue)!.description }} · {{ calendarDate(candidate(issue)!.bookingDate) }} ·
            {{ money(candidate(issue)!.amountCents) }}
          </p>
          <p>
            {{ accountName(candidate(issue)!.accountId) }} ·
            {{ candidate(issue)!.status === 'BOOKED' ? 'Gebucht' : 'Vorgemerkt' }} ·
            {{ categoryName(candidate(issue)!.categoryId)
            }}<span v-if="candidate(issue)!.isTransfer"> · Umbuchung</span>
          </p>
          <p>Quelle: {{ sourceNames(issue.candidateSources?.[candidate(issue)!.id]) }}</p>
          <p class="reference-copy">
            Referenzen: {{ issue.candidateReferences?.[candidate(issue)!.id]?.join(', ') || 'Nicht geliefert' }}
          </p>
        </div>
        <div class="toolbar mt-4">
          <UButton :disabled="!matches[issue.id]" variant="soft" @click="resolve(issue.id, 'EXISTING')"
            >Vorhandene Daten behalten</UButton
          ><UButton :disabled="!matches[issue.id]" variant="soft" @click="resolve(issue.id, 'INCOMING')"
            >Importdaten übernehmen</UButton
          ><UButton variant="soft" @click="resolve(issue.id, 'NEW')">Separat behalten</UButton
          ><UButton color="neutral" variant="ghost" @click="resolve(issue.id, 'SKIP')">Überspringen</UButton>
        </div></template
      >
    </article>
    <p v-if="issues.length >= 1000" class="muted">
      Maximal 1.000 Hinweise gleichzeitig. Nach Entscheidungen erneut laden.
    </p>
  </section>
</template>

<style scoped>
.reference-copy {
  overflow-wrap: anywhere;
}
</style>
