<script setup lang="ts">
import { z } from 'zod';
import {
  CsvFileError,
  decodeCsv,
  csvHeaders,
  suggestCsvMapping,
  type CsvEncoding,
  type CsvDelimiter,
} from '../../utils/csv-file';
import { ApiError, userErrorMessage } from '../../utils/api-error';
import {
  accountSchema,
  csvPreviewInputSchema,
  csvPreviewSchema,
  csvCommitSchema,
  runSchema,
  type Account,
  type CsvMapping,
  type ImportRun,
} from '@financial-tracking/contracts';

const api = useApi();
const accounts = ref<Account[]>([]);
const accountId = ref('');
const encoding = ref<CsvEncoding | 'auto'>('auto');
const delimiter = ref<CsvDelimiter | 'auto'>('auto');
const detectedEncoding = ref<CsvEncoding>('utf-8');
const detectedDelimiter = ref<CsvDelimiter>(';');
const fileBytes = shallowRef<Uint8Array | null>(null);
const readingFile = ref(false);
const formatExpanded = ref(false);
const needsMapping = ref(false);
const headers = ref<string[]>([]);
const content = ref('');
const filename = ref('');
const error = ref('');
const busy = ref(false);
const saving = ref(false);
const commitUncertain = ref(false);
const allowPartial = ref(false);
const preview = ref<z.infer<typeof csvPreviewSchema> | null>(null);
const committed = ref(false);
const mapping = reactive<CsvMapping>({ bookingDate: '', amount: '', description: '' });
let fileGeneration = 0;
let disposed = false;
const encodingNames: Record<CsvEncoding, string> = {
  'utf-8': 'UTF-8',
  'windows-1252': 'Windows-1252 / ANSI',
  'iso-8859-15': 'ISO-8859-15 / Latin-9',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
};
const delimiterNames: Record<CsvDelimiter, string> = { ';': 'Semikolon (;)', ',': 'Komma (,)', '\t': 'Tabulator' };
const requiredFields = [
  {
    key: 'bookingDate',
    label: 'Buchungsdatum',
    help: 'Tag der Buchung; bestimmt den Monat der Auswertung. TT.MM.JJ, TT.MM.JJJJ oder JJJJ-MM-TT. Zweistellige Jahre bedeuten 2000–2099.',
  },
  {
    key: 'amount',
    label: 'Betrag',
    help: 'Geldbetrag mit Dezimalkomma, z. B. -49,90. Minus bedeutet Ausgabe, Plus bedeutet Einnahme.',
  },
  {
    key: 'description',
    label: 'Buchungstext',
    help: 'Beschreibung der Zahlung, meist die Spalte Verwendungszweck oder Buchungstext.',
  },
] as const;
const optionalFields = [
  {
    key: 'valueDate',
    label: 'Wertstellung',
    help: 'Optionales Datum, ab dem die Bank den Betrag verzinst. Im Zweifel nicht zuordnen.',
  },
  {
    key: 'counterpartyName',
    label: 'Gegenpartei',
    help: 'Name der Person oder Firma, von der Geld kommt oder an die du zahlst.',
  },
  {
    key: 'counterpartyIban',
    label: 'Gegenkonto-IBAN',
    help: 'IBAN der anderen Person oder Firma; nicht die IBAN deines eigenen Kontos.',
  },
  {
    key: 'reference',
    label: 'Eindeutige Bankreferenz',
    help: 'Nur eine Kennung, die genau eine Buchung identifiziert. Wiederholte Mandats- oder Kundenreferenzen hier nicht auswählen; im Zweifel leer lassen.',
  },
  {
    key: 'currency',
    label: 'Währung',
    help: 'Spalte mit EUR. Ohne Zuordnung wird EUR angenommen; andere Währungen werden nicht umgerechnet.',
  },
] as const;
const missingFields = computed(
  /** Describe missing required choices before enabling preview. */ () =>
    requiredFields
      .filter(/** A mapping must reference the current file. */ (field) => !headers.value.includes(mapping[field.key]))
      .map(/** Use user-facing field names. */ (field) => field.label),
);
/** Discard old file state and prevent previous mappings from leaking into the next upload. */
function resetFile() {
  fileBytes.value = null;
  content.value = '';
  headers.value = [];
  filename.value = '';
  allowPartial.value = false;
  commitUncertain.value = false;
  needsMapping.value = false;
  for (const key of Object.keys(mapping)) delete (mapping as Record<string, string>)[key];
  Object.assign(mapping, { bookingDate: '', amount: '', description: '' });
}
/** Read an explicitly selected bounded file into transient page memory. */
async function selectFile(event: Event) {
  if (busy.value || readingFile.value) return;
  const generation = ++fileGeneration;
  error.value = '';
  resetFile();
  readingFile.value = false;
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    error.value = 'Die Datei ist größer als 10 MiB. Exportiere im Online-Banking einen kleineren Zeitraum.';
    return;
  }
  filename.value = file.name;
  readingFile.value = true;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (generation !== fileGeneration) return;
    fileBytes.value = bytes;
    readFile();
  } catch {
    if (generation === fileGeneration)
      error.value = 'Die Datei konnte nicht geöffnet werden. Speichere sie lokal und wähle sie erneut aus.';
  } finally {
    if (generation === fileGeneration) readingFile.value = false;
  }
  if (generation === fileGeneration && !error.value && content.value && !missingFields.value.length)
    await makePreview();
}
/** Re-decode the selected bytes after an override without asking the user to upload again. */
function readFile() {
  if (!fileBytes.value) return;
  error.value = '';
  headers.value = [];
  content.value = '';
  try {
    const decoded = decodeCsv(fileBytes.value, encoding.value);
    const parsed = csvHeaders(decoded.content, delimiter.value);
    content.value = decoded.content;
    headers.value = parsed.headers;
    detectedEncoding.value = decoded.encoding;
    detectedDelimiter.value = parsed.delimiter;
    const suggested = suggestCsvMapping(parsed.headers);
    for (const key of [...requiredFields, ...optionalFields].map(
      /** Reuse only choices still present in this file. */ (field) => field.key,
    )) {
      if (!parsed.headers.includes(mapping[key] ?? '')) (mapping as Record<string, string>)[key] = suggested[key] ?? '';
    }
    needsMapping.value = missingFields.value.length > 0;
  } catch (cause) {
    formatExpanded.value = true;
    error.value = cause instanceof CsvFileError ? cause.message : userErrorMessage(cause);
  }
}
/** Validate a selected file and automatically accept only a fully valid normal import. */
async function makePreview() {
  if (busy.value || disposed || !content.value || missingFields.value.length) return;
  busy.value = true;
  error.value = '';
  try {
    const body = csvPreviewInputSchema.parse({
      accountId: accountId.value || null,
      content: content.value,
      encoding: detectedEncoding.value,
      delimiter: detectedDelimiter.value,
      mapping: Object.fromEntries(
        Object.entries(mapping).filter(/** Omit unassigned optional columns. */ ([, value]) => !!value),
      ),
    });
    const result = await api.request('/imports/csv/preview', csvPreviewSchema, { method: 'POST', body });
    if (disposed) {
      await api.request(`/import-runs/${result.run.id}/cancel`, runSchema, { method: 'POST', body: {} });
      return;
    }
    preview.value = result;
    if (!result.invalidRows) await commit();
  } catch (cause) {
    if (!disposed) error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
/** Release raw bytes and open actual persisted analytics or the remaining duplicate decisions. */
async function finish(run: ImportRun) {
  committed.value = true;
  const month = preview.value?.period?.to.slice(0, 7) ?? preview.value?.rows[0]?.bookingDate.slice(0, 7);
  content.value = '';
  fileBytes.value = null;
  if (!disposed)
    await navigateTo(
      run.reviewRequiredCount
        ? `/imports?run=${run.id}`
        : `/?${new URLSearchParams({ ...(month ? { month } : {}), import: run.id })}`,
    );
}
/** Recover a lost commit response by reading its existing run, never by creating another preview. */
async function checkImportStatus() {
  if (!preview.value) return;
  busy.value = true;
  try {
    const run = await api.request(`/import-runs/${preview.value.run.id}`, runSchema);
    if (run.status === 'COMPLETED' || run.status === 'PARTIAL_SUCCESS') await finish(run);
    else if (!disposed) {
      preview.value.run = run;
      commitUncertain.value = run.status !== 'CREATED';
      error.value =
        run.status === 'CREATED'
          ? 'Die Übernahme ist noch nicht abgeschlossen. Du kannst dieselbe Übernahme erneut anfordern; dieselbe Buchung wird dadurch nicht doppelt gespeichert.'
          : 'Der Import ist noch nicht abgeschlossen. Prüfe den Status erneut oder sieh in der Importhistorie nach.';
    }
  } catch (cause) {
    if (!disposed) error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
/** Commit valid rows automatically; partial imports still require the user's explicit consent. */
async function commit() {
  if (
    !preview.value ||
    disposed ||
    saving.value ||
    commitUncertain.value ||
    (preview.value.invalidRows && !allowPartial.value)
  )
    return;
  busy.value = true;
  saving.value = true;
  error.value = '';
  try {
    const body = csvCommitSchema.parse({ allowPartial: allowPartial.value });
    const run = await api.request(`/imports/csv/${preview.value.run.id}/commit`, runSchema, { method: 'POST', body });
    await finish(run);
  } catch (cause) {
    if (disposed) return;
    const uncertain =
      !(cause instanceof ApiError) || cause.status === 0 || cause.status >= 500 || cause.code === 'IMPORT_STATE';
    if (uncertain) {
      commitUncertain.value = true;
      error.value =
        'Die Antwort auf die Übernahme fehlt. Wir prüfen den bestehenden Import, damit keine zweite Übernahme gestartet wird.';
      await checkImportStatus();
    } else error.value = userErrorMessage(cause);
  } finally {
    saving.value = false;
    busy.value = false;
  }
}
/** Cancel the preview before discarding its staged data. */
async function cancel() {
  if (busy.value || saving.value || commitUncertain.value) return;
  try {
    if (preview.value?.run.status === 'CREATED')
      await api.request(`/import-runs/${preview.value.run.id}/cancel`, runSchema, { method: 'POST', body: {} });
    preview.value = null;
    error.value = '';
    resetFile();
  } catch (cause) {
    if (!disposed) error.value = userErrorMessage(cause);
  }
}
watch(
  [encoding, delimiter],
  /** Retry decoding the same transient bytes after an explicit format correction. */ () => {
    if (busy.value || readingFile.value || preview.value || disposed) return;
    readFile();
    if (!error.value && content.value && !missingFields.value.length) void makePreview();
  },
);
onMounted(
  /** Load explicit active target accounts. */ async () => {
    try {
      const loaded = (await api.request('/accounts', z.array(accountSchema))).filter(
        /** Hide inactive import targets. */ (account) => account.isActive,
      );
      if (!disposed) accounts.value = loaded;
    } catch (cause) {
      if (!disposed) error.value = userErrorMessage(cause);
    }
  },
);
onBeforeUnmount(
  /** Raw file data never survives this view; cancel abandoned previews. */ () => {
    content.value = '';
    fileBytes.value = null;
    fileGeneration++;
    disposed = true;
    if (preview.value && !committed.value && !saving.value && !commitUncertain.value) void cancel();
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">DEINE AUSWERTUNG BEGINNT HIER</p>
      <h1>CSV importieren</h1>
      <p class="muted">Datei auswählen. Den Rest übernehmen wir.</p>
    </div>
    <UButton to="/imports" variant="ghost">Importhistorie</UButton>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <div v-if="readingFile || busy" role="status" class="panel upload-progress mb-5">
    <strong>{{
      readingFile ? 'Datei wird gelesen …' : saving ? 'Buchungen werden übernommen …' : 'Datei wird ausgewertet …'
    }}</strong>
    <p class="muted">Format erkennen, Buchungen prüfen und deine Monatsübersicht vorbereiten.</p>
  </div>
  <section v-if="!preview" class="panel import-upload">
    <form class="space-y-6" @submit.prevent="makePreview">
      <label class="upload-zone quick-upload" :class="{ 'upload-disabled': busy || readingFile }">
        <svg
          aria-hidden="true"
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
        </svg>
        <strong>CSV-Datei auswählen</strong
        ><span>{{ filename || 'Dein Bankexport genügt. Kein Konto und keine Einrichtung nötig.' }}</span>
        <span class="upload-action">Datei hochladen</span>
        <input
          aria-label="CSV-Datei"
          class="sr-only"
          type="file"
          accept=".csv,text/csv"
          :disabled="busy || readingFile"
          @change="selectFile"
        />
      </label>
      <p class="muted text-sm">
        Mit der Dateiauswahl werden erkannte, gültige Buchungen automatisch übernommen und ausgewertet. Nur wenn etwas
        unklar ist, fragen wir nach.
      </p>
      <details
        class="import-format"
        :open="formatExpanded"
        @toggle="formatExpanded = ($event.target as HTMLDetailsElement).open"
      >
        <summary>Importoptionen (nur bei Bedarf)</summary>
        <p class="muted text-sm my-3">
          Normalerweise ist hier nichts nötig. Änderungen am Dateiformat lesen dieselbe Datei erneut.
        </p>
        <div class="form-row csv-columns">
          <label
            >Zielkonto (optional)<select
              v-model="accountId"
              aria-label="Zielkonto (optional)"
              class="control"
              :disabled="busy || readingFile"
            >
              <option value="">Ohne Konto — später zuordnen</option>
              <option v-for="account in accounts" :key="account.id" :value="account.id">
                {{ account.name }}
              </option></select
            ><span class="field-help"
              >Ohne Konto zählen Buchungen sofort in deiner Auswertung. Eine spätere Zuordnung ist möglich.</span
            ></label
          >
          <label
            >Kodierung<select v-model="encoding" class="control" :disabled="busy || readingFile">
              <option value="auto">Automatisch (empfohlen)</option>
              <option v-for="(name, value) in encodingNames" :key="value" :value="value">{{ name }}</option></select
            ><span class="field-help"
              >Bestimmt, wie Umlaute und Sonderzeichen gelesen werden. Bei älteren Bankexporten hilft Windows-1252; für
              ein falsch dargestelltes Eurozeichen kann Latin-9 passen.</span
            ></label
          >
          <label
            >Trennzeichen<select v-model="delimiter" class="control" :disabled="busy || readingFile">
              <option value="auto">Automatisch (empfohlen)</option>
              <option v-for="(name, value) in delimiterNames" :key="value" :value="value">{{ name }}</option></select
            ><span class="field-help"
              >Zeichen zwischen den Spalten. Automatisch erkennt Semikolon, Komma oder Tabulator.</span
            ></label
          >
        </div>
      </details>
      <template v-if="needsMapping && !busy">
        <div>
          <h2>Eine kurze Zuordnung fehlt</h2>
          <p class="muted text-sm mt-2">
            Wir kennen diese Spaltennamen noch nicht eindeutig. Wähle, welche Spalte Datum, Betrag und Beschreibung
            enthält. Danach übernehmen wir die Auswertung.
          </p>
        </div>
        <div class="filter-grid csv-columns">
          <label v-for="field in requiredFields" :key="field.key"
            >{{ field.label }} *<select v-model="mapping[field.key]" required class="control">
              <option value="">Spalte wählen</option>
              <option v-for="header in headers" :key="header">{{ header }}</option></select
            ><span class="field-help">{{ field.help }}</span></label
          >
        </div>
        <details class="import-format">
          <summary>Weitere Angaben zuordnen (optional)</summary>
          <div class="filter-grid csv-columns mt-4">
            <label v-for="field in optionalFields" :key="field.key"
              >{{ field.label
              }}<select v-model="mapping[field.key]" class="control">
                <option value="">Nicht zugeordnet</option>
                <option v-for="header in headers" :key="header">{{ header }}</option></select
              ><span class="field-help">{{ field.help }}</span></label
            >
          </div>
        </details>
        <p v-if="missingFields.length" role="status" class="muted text-sm">
          Noch zuordnen: {{ missingFields.join(', ') }}.
        </p>
        <UButton type="submit" :disabled="!!missingFields.length || !content" :loading="busy">Jetzt auswerten</UButton>
      </template>
    </form>
  </section>
  <section v-else-if="!busy" class="panel">
    <div class="panel-heading">
      <h2>Einmal kurz prüfen</h2>
      <span class="subtle-tag">{{ preview.totalRows }} Zeilen · {{ preview.invalidRows }} fehlerhaft</span>
    </div>
    <p v-if="preview.invalidRows" class="muted mb-5">
      Diese Datei enthält ungültige Zeilen. Entscheide, ob wir nur die gültigen Buchungen übernehmen sollen, oder
      korrigiere den Export.
    </p>
    <p v-else class="muted mb-5">
      Die Übernahme konnte noch nicht bestätigt werden. Prüfe den bestehenden Importstatus, bevor du fortfährst.
    </p>
    <UAlert v-if="preview.invalidRows" color="warning" title="Diese Zeilen brauchen Aufmerksamkeit" class="my-5"
      ><template #description
        ><p v-for="issue in preview.issues.slice(0, 20)" :key="issue.id">
          Zeile {{ issue.rowNumber }}: {{ issue.message }}
        </p>
        <p v-if="preview.invalidRows > 20">Weitere Hinweise findest du in der Importhistorie.</p></template
      ></UAlert
    >
    <details v-if="preview.rows.length" class="import-format my-5">
      <summary>Gültige Buchungen ansehen</summary>
      <div v-for="(row, index) in preview.rows" :key="index" class="transaction-row">
        <div>
          <strong>{{ row.description }}</strong
          ><small>{{ calendarDate(row.bookingDate) }} · {{ row.counterpartyName || 'Keine Gegenpartei' }}</small>
        </div>
        <strong>{{ money(row.amountCents) }}</strong>
      </div>
    </details>
    <p v-else class="muted mb-5">
      Es wurden keine gültigen Buchungen erkannt. Bitte prüfe die Zuordnung oder exportiere die Datei erneut.
    </p>
    <label v-if="preview.invalidRows && preview.rows.length" class="block my-5"
      ><input v-model="allowPartial" type="checkbox" :disabled="commitUncertain" /> Nur gültige Zeilen übernehmen;
      fehlerhafte Zeilen auslassen.</label
    >
    <div class="toolbar mt-6">
      <UButton v-if="commitUncertain" :loading="busy" @click="checkImportStatus">Importstatus prüfen</UButton>
      <UButton
        v-else
        :disabled="!preview.rows.length || (preview.invalidRows > 0 && !allowPartial)"
        :loading="busy"
        @click="commit"
        >{{ preview.invalidRows ? 'Gültige Buchungen übernehmen' : 'Übernahme erneut versuchen' }}</UButton
      >
      <UButton :disabled="busy || commitUncertain" variant="ghost" @click="cancel">Datei wechseln</UButton>
    </div>
  </section>
</template>
