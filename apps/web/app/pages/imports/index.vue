<script setup lang="ts">
import { z } from 'zod';
import { userErrorMessage } from '../../utils/api-error';
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
const issueSections = computed(
  /** Separate decisions about real duplicate candidates from non-imported row diagnostics. */ () =>
    [
      {
        title: 'Mögliche Doppelbuchungen',
        explanation:
          'Vorhandene Daten behalten zählt die bekannte Buchung einmal. Importdaten übernehmen ersetzt deren Quellwerte und erhält manuelle Anmerkungen. Separat behalten zählt beide Buchungen. Überspringen verwirft nur die neue Zeile.',
        items: issues.value.filter(/** Only staged ambiguous rows require a decision. */ (issue) => !!issue.incoming),
      },
      {
        title: 'Fehlerhafte Zeilen',
        explanation:
          'Diese Zeilen konnten nicht übernommen werden. Korrigiere die Datei und lade sie erneut hoch. Es gibt hier keine pauschale Bestätigungspflicht; bereits übernommene gültige Buchungen bleiben erhalten.',
        items: issues.value.filter(
          /** Diagnostics never become fake duplicate decisions. */ (issue) => !issue.incoming,
        ),
      },
    ].filter(/** Hide empty groups without hiding actual issues. */ (group) => group.items.length),
);
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
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
/** Clear a removed selection before refreshing the remaining history. */
async function removed(id: string) {
  if (selectedRun.value === id) {
    selectedRun.value = '';
    issues.value = [];
    await navigateTo('/imports');
  }
  await load();
}
/** Select a run without changing its persisted bookings. */
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
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>Importhistorie</h1>
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
    <div v-for="run in runs" :key="run.id" class="import-entry">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        class="import-row"
        :class="{ 'selected-row': selectedRun === run.id }"
        @click="select(run.id)"
      >
        <div>
          <strong>{{ run.source }} · {{ labels[run.status] }}</strong
          ><small
            >{{ observedTime(run.startedAt)
            }}<span v-if="run.errorCode"> · Nicht abgeschlossen; bitte Hinweise prüfen</span></small
          >
        </div>
        <span>{{ run.importedCount }} neu · {{ run.knownCount }} bekannt · {{ run.reviewRequiredCount }} prüfen</span>
      </UButton>
      <ImportRollback
        v-if="run.source === 'CSV' && ['COMPLETED', 'PARTIAL_SUCCESS'].includes(run.status)"
        :run-id="run.id"
        @removed="removed(run.id)"
      />
    </div>
  </section>
  <section v-if="selectedRun" class="panel">
    <div class="panel-heading">
      <h2>Buchungen klären</h2>
      <span class="subtle-tag">{{ issues.length }} Einträge angezeigt</span>
    </div>
    <p v-if="!issues.length" class="empty-copy">Keine offenen Hinweise für diesen Import.</p>
    <section v-for="group in issueSections" :key="group.title" class="mt-5">
      <h3>{{ group.title }}</h3>
      <HelpPopover :title="group.title" :text="group.explanation" class="mb-4" />
      <article v-for="issue in group.items" :key="issue.id" class="review-card">
        <UBadge
          :color="issue.incoming ? 'warning' : 'error'"
          :label="issue.incoming ? 'Mögliche Doppelbuchung' : 'Zeile nicht übernommen'"
          class="mb-3"
        />
        <h4>{{ issue.message }}</h4>
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
            >Bekannte Buchung auswählen<ChoiceSelect
              v-model="matches[issue.id]"
              aria-label="Bekannte Buchung auswählen"
              :searchable="true"
              :items="[
                { label: `Kandidat wählen`, value: '' },
                ...(issue.candidates ?? []).map(
                  /** Build a persisted choice. */ (option) => ({
                    label: `${calendarDate(option.bookingDate)} · ${option.description} · ${money(option.amountCents)}`,
                    value: option.id,
                  }),
                ),
              ]"
          /></label>
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
    </section>
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
