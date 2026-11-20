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
        title: tr('Mögliche Doppelbuchungen'),
        explanation: tr(
          'Vorhandene Daten behalten zählt die bekannte Buchung einmal. Importdaten übernehmen ersetzt deren Quellwerte und erhält manuelle Anmerkungen. Separat behalten zählt beide Buchungen. Überspringen verwirft nur die neue Zeile.',
        ),
        items: issues.value.filter(/** Only staged ambiguous rows require a decision. */ (issue) => !!issue.incoming),
      },
      {
        title: tr('Fehlerhafte Zeilen'),
        explanation: tr(
          'Diese Zeilen konnten nicht übernommen werden. Korrigiere die Datei und lade sie erneut hoch. Es gibt hier keine pauschale Bestätigungspflicht; bereits übernommene gültige Buchungen bleiben erhalten.',
        ),
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
let generation = 0;
let disposed = false;
/** Resolve only the currently offered comparison target. */
function candidate(issue: z.infer<typeof issueSchema>) {
  return issue.candidates?.find(
    /** Do not infer a match merely from the first candidate. */ (row) => row.id === matches[issue.id],
  );
}
/** Keep unassigned entries visible alongside their true account associations. */
function accountName(id: string | null) {
  return accounts.value.find(/** Match a real account identifier. */ (row) => row.id === id)?.name ?? tr('Ohne Konto');
}
/** Read the manual target annotation without changing it during comparison. */
function categoryName(id: string | null) {
  return (
    categories.value.find(/** Use the current public category name. */ (row) => row.id === id)?.name ??
    tr('Nicht kategorisiert')
  );
}
/** Describe source provenance in product language, including unknown migrated records. */
function sourceNames(values?: string[]) {
  return (
    values
      ?.map(
        /** Do not present a migrated unknown source as a verified bank read. */ (value) =>
          value === 'FINTS' ? tr('Bank') : value === 'CSV' ? 'CSV' : tr('Bestand'),
      )
      .join(', ') || tr('Bestand')
  );
}
const labels: Record<string, string> = {
  CREATED: tr('Vorschau'),
  RUNNING: tr('Läuft'),
  WAITING_FOR_AUTH: tr('Freigabe ausstehend'),
  COMMITTING: tr('Wird gespeichert'),
  COMPLETED: tr('Abgeschlossen'),
  PARTIAL_SUCCESS: tr('Teilweise erfolgreich'),
  FAILED: tr('Fehlgeschlagen'),
  CANCELLED: tr('Abgebrochen'),
};
/** Load recent history and the selected review queue. */
async function load() {
  const request = ++generation;
  const run = selectedRun.value;
  busy.value = true;
  error.value = '';
  try {
    const [history, accountRows, categoryRows] = await Promise.all([
      api.request('/imports', z.array(runSchema)),
      api.request('/accounts', z.array(accountSchema)),
      api.request('/categories', z.array(categorySchema)),
    ]);
    const queue = run ? await api.request(`/imports/${run}/issues`, z.array(issueSchema)) : [];
    if (disposed || request !== generation) return;
    runs.value = history;
    accounts.value = accountRows;
    categories.value = categoryRows;
    issues.value = queue;
  } catch (cause) {
    if (!disposed && request === generation) error.value = userErrorMessage(cause);
  } finally {
    if (!disposed && request === generation) busy.value = false;
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
  if (selectedRun.value !== id) issues.value = [];
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
watch(
  /** Restore the selected review when browser history changes its bookmark. */ () => route.query.run,
  /** A different run owns a different queue; never show the previous run's candidates. */ (value) => {
    const id = typeof value === 'string' ? value : '';
    if (id === selectedRun.value) return;
    selectedRun.value = id;
    issues.value = [];
    void load();
  },
);
onBeforeUnmount(
  /** Late history and queue reads cannot publish into an abandoned maintenance view. */ () => {
    disposed = true;
    generation++;
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>{{ tr('Importhistorie') }}</h1>
    </div>
    <div class="toolbar">
      <UButton :loading="busy" variant="ghost" @click="load">{{ tr('Neu laden') }}</UButton
      ><UButton to="/imports/csv">{{ tr('CSV importieren') }}</UButton>
    </div>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <p v-if="busy" role="status" class="muted mb-4">{{ tr('Importdaten werden geladen …') }}</p>
  <div class="import-workspace">
    <SectionPanel :title="tr('Letzte Importe')" icon="history" compact>
      <p v-if="!runs.length && !busy && !error" class="empty-copy">
        {{ tr('Noch keine Importe. Starte mit einer CSV-Datei oder deiner Bankverbindung.') }}
      </p>
      <div v-for="run in runs" :key="run.id" class="import-entry">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="import-row"
          :class="{ 'selected-row': selectedRun === run.id }"
          :aria-pressed="selectedRun === run.id"
          :disabled="busy"
          @click="select(run.id)"
        >
          <div>
            <strong>{{ run.source }} · {{ labels[run.status] }}</strong
            ><small
              >{{ observedTime(run.startedAt)
              }}<span v-if="run.errorCode"> {{ tr('· Nicht abgeschlossen; bitte Hinweise prüfen') }}</span></small
            >
          </div>
          <span
            >{{ run.importedCount }} {{ tr('neu ·') }} {{ run.knownCount }} {{ tr('bekannt ·') }}
            {{ run.reviewRequiredCount }} {{ tr('prüfen') }}</span
          >
        </UButton>
        <details class="import-metadata">
          <summary>{{ tr('Importdetails') }}</summary>
          <p>{{ tr('Begonnen:') }} {{ observedTime(run.startedAt) }}</p>
          <p v-if="run.finishedAt">{{ tr('Beendet:') }} {{ observedTime(run.finishedAt) }}</p>
          <p>
            {{ labels[run.status] }} · {{ run.importedCount }} {{ tr('neu ·') }} {{ run.knownCount }}
            {{ tr('bekannt ·') }} {{ run.reviewRequiredCount }} {{ tr('prüfen') }}
          </p>
        </details>
        <ImportRollback
          v-if="run.source === 'CSV' && ['COMPLETED', 'PARTIAL_SUCCESS'].includes(run.status)"
          :run-id="run.id"
          @removed="removed(run.id)"
        />
      </div>
    </SectionPanel>
    <SectionPanel v-if="selectedRun" :title="tr('Import prüfen')" icon="transactions" compact>
      <div class="panel-heading">
        <h2>{{ tr('Buchungen klären') }}</h2>
        <span class="subtle-tag">{{ issues.length }} {{ tr('Einträge angezeigt') }}</span>
      </div>
      <p v-if="!issues.length && !busy && !error" class="empty-copy">
        {{ tr('Keine offenen Hinweise für diesen Import.') }}
      </p>
      <section v-for="group in issueSections" :key="group.title" class="mt-5">
        <h3>{{ group.title }}</h3>
        <HelpPopover :title="group.title" :text="group.explanation" class="mb-4" />
        <article v-for="issue in group.items" :key="issue.id" class="review-card" data-import-issue>
          <details :open="!!issue.incoming">
            <summary>
              {{ issue.rowNumber ? tr('Zeile {0}', [issue.rowNumber]) : 'Hinweis' }} ·
              {{ issue.incoming?.description || tr('Zeile nicht übernommen') }}
            </summary>
            <UBadge
              :color="issue.incoming ? 'warning' : 'error'"
              :label="issue.incoming ? tr('Mögliche Doppelbuchung') : tr('Zeile nicht übernommen')"
              class="mb-3"
            />
            <h4>{{ issue.message }}</h4>
            <div v-if="issue.incoming" class="review-incoming">
              <strong>{{ issue.incoming.description }}</strong
              ><span
                >{{ calendarDate(issue.incoming.bookingDate) }} · {{ money(issue.incoming.amountCents) }} ·
                {{ issue.incoming.counterpartyName || tr('Keine Gegenpartei') }}</span
              >
            </div>
            <template v-if="issue.incoming"
              ><p>
                {{ issue.incomingSource === 'FINTS' ? tr('Bank') : 'CSV' }} ·
                {{ accountName(issue.incoming.accountId) }} ·
                {{ issue.incoming.status === 'BOOKED' ? tr('Gebucht') : tr('Vorgemerkt') }}
              </p>
              <p class="reference-copy">{{ tr('Referenz:') }} {{ issue.incomingReference || tr('Nicht geliefert') }}</p>
              <label class="import-candidate"
                >{{ tr('Bekannte Buchung auswählen')
                }}<ChoiceSelect
                  v-model="matches[issue.id]"
                  :aria-label="tr('Bekannte Buchung auswählen')"
                  :searchable="true"
                  :disabled="busy"
                  :items="[
                    { label: tr('Kandidat wählen'), value: '' },
                    ...(issue.candidates ?? []).map(
                      /** Build a persisted choice. */ (option) => ({
                        label: `${calendarDate(option.bookingDate)} · ${option.description} · ${money(option.amountCents)}`,
                        value: option.id,
                      }),
                    ),
                  ]"
              /></label>
              <div v-if="candidate(issue)" class="import-candidate-values mt-4">
                <strong>{{ tr('Bekannte Buchung') }}</strong>
                <p>
                  {{ candidate(issue)!.description }} · {{ calendarDate(candidate(issue)!.bookingDate) }} ·
                  {{ money(candidate(issue)!.amountCents) }}
                </p>
                <p>
                  {{ accountName(candidate(issue)!.accountId) }} ·
                  {{ candidate(issue)!.status === 'BOOKED' ? tr('Gebucht') : tr('Vorgemerkt') }} ·
                  {{ categoryName(candidate(issue)!.categoryId)
                  }}<span v-if="candidate(issue)!.isTransfer"> {{ tr('· Umbuchung') }}</span>
                </p>
                <p>{{ tr('Quelle:') }} {{ sourceNames(issue.candidateSources?.[candidate(issue)!.id]) }}</p>
                <p class="reference-copy">
                  {{ tr('Referenzen:') }}
                  {{ issue.candidateReferences?.[candidate(issue)!.id]?.join(', ') || tr('Nicht geliefert') }}
                </p>
              </div>
              <div class="toolbar mt-4">
                <UButton :disabled="busy || !matches[issue.id]" variant="soft" @click="resolve(issue.id, 'EXISTING')">{{
                  tr('Vorhandene Daten behalten')
                }}</UButton
                ><UButton
                  :disabled="busy || !matches[issue.id]"
                  variant="soft"
                  @click="resolve(issue.id, 'INCOMING')"
                  >{{ tr('Importdaten übernehmen') }}</UButton
                ><UButton :disabled="busy" variant="soft" @click="resolve(issue.id, 'NEW')">{{
                  tr('Separat behalten')
                }}</UButton
                ><UButton :disabled="busy" color="neutral" variant="ghost" @click="resolve(issue.id, 'SKIP')">{{
                  tr('Überspringen')
                }}</UButton>
              </div></template
            >
          </details>
        </article>
      </section>
      <p v-if="issues.length >= 1000" class="muted">
        {{ tr('Maximal 1.000 Hinweise gleichzeitig. Nach Entscheidungen erneut laden.') }}
      </p>
    </SectionPanel>
    <SectionPanel v-else :title="tr('Buchungen klären')" icon="transactions" compact>
      <p class="empty-copy">{{ tr('Wähle einen Import, um dessen Hinweise und Quellwerte zu prüfen.') }}</p>
    </SectionPanel>
  </div>
</template>

<style scoped>
.reference-copy {
  overflow-wrap: anywhere;
}
.import-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 24px;
  align-items: start;
}
.import-workspace > * {
  min-width: 0;
}
.import-entry {
  padding: 4px 0 12px;
}
.import-row {
  padding: 12px;
  gap: 12px;
  border: 0;
  min-height: 56px;
  border-radius: 12px;
  flex-wrap: wrap;
}
.import-metadata {
  margin: 8px 12px;
  font-size: 12px;
  color: var(--muted);
}
summary {
  cursor: pointer;
  padding: 10px 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.review-card {
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 12px 18px;
  margin-top: 12px;
}
.review-incoming,
.import-candidate-values {
  background: var(--soft);
  border-radius: 12px;
  padding: 12px;
}
.import-candidate {
  display: block;
  margin-top: 12px;
}
@media (max-width: 1100px) {
  .import-workspace {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}
</style>
