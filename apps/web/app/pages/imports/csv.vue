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
import { userErrorMessage } from '../../utils/api-error';
import {
  accountSchema,
  csvPreviewInputSchema,
  csvPreviewSchema,
  csvCommitSchema,
  runSchema,
  type Account,
  type CsvMapping,
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
const headers = ref<string[]>([]);
const content = ref('');
const filename = ref('');
const error = ref('');
const busy = ref(false);
const allowPartial = ref(false);
const preview = ref<z.infer<typeof csvPreviewSchema> | null>(null);
const committed = ref(false);
const mapping = reactive<CsvMapping>({ bookingDate: '', amount: '', description: '' });
let fileGeneration = 0;
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
    help: 'Tag der Buchung; bestimmt den Monat der Auswertung. Format: TT.MM.JJJJ oder JJJJ-MM-TT.',
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
  for (const key of Object.keys(mapping)) delete (mapping as Record<string, string>)[key];
  Object.assign(mapping, { bookingDate: '', amount: '', description: '' });
}
/** Read an explicitly selected bounded file into transient page memory. */
async function selectFile(event: Event) {
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
  } catch (cause) {
    error.value = cause instanceof CsvFileError ? cause.message : userErrorMessage(cause);
  }
}
/** Stage a server-validated preview and release the raw file content. */
async function makePreview() {
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
    preview.value = await api.request('/imports/csv/preview', csvPreviewSchema, { method: 'POST', body });
    content.value = '';
    fileBytes.value = null;
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
/** Commit only after preview and explicit partial-import consent. */
async function commit() {
  if (!preview.value) return;
  busy.value = true;
  error.value = '';
  try {
    const body = csvCommitSchema.parse({ allowPartial: allowPartial.value });
    const run = await api.request(`/imports/csv/${preview.value.run.id}/commit`, runSchema, { method: 'POST', body });
    committed.value = true;
    await navigateTo(`/imports?run=${run.id}`);
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
/** Cancel the preview before discarding its staged data. */
async function cancel() {
  if (preview.value)
    try {
      await api.request(`/import-runs/${preview.value.run.id}/cancel`, runSchema, { method: 'POST', body: {} });
      preview.value = null;
      resetFile();
    } catch (cause) {
      error.value = userErrorMessage(cause);
    }
}
watch([encoding, delimiter], readFile);
onMounted(
  /** Load explicit active target accounts. */ async () => {
    try {
      accounts.value = (await api.request('/accounts', z.array(accountSchema))).filter(
        /** Hide inactive import targets. */ (account) => account.isActive,
      );
    } catch (cause) {
      error.value = userErrorMessage(cause);
    }
  },
);
onBeforeUnmount(
  /** Raw file data never survives this view; cancel abandoned previews. */ () => {
    content.value = '';
    fileBytes.value = null;
    fileGeneration++;
    if (preview.value && !committed.value) void cancel();
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <p class="eyebrow">DEINE DATEN, DEIN ÜBERBLICK</p>
      <h1>CSV importieren</h1>
      <p class="muted">Datei auswählen. Spalten prüfen. Bewusst übernehmen.</p>
    </div>
    <UButton to="/imports" variant="ghost">Importhistorie</UButton>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <div class="stepper">
    <span :class="{ selected: !headers.length }">1 · Datei</span
    ><span :class="{ selected: headers.length && !preview }">2 · Spalten</span
    ><span :class="{ selected: preview }">3 · Prüfen</span>
  </div>
  <section v-if="!preview" class="panel">
    <p v-if="!accounts.length" class="empty-copy">Du kannst ohne Konto importieren und Buchungen später zuordnen.</p>
    <form class="space-y-6" @submit.prevent="makePreview">
      <div>
        <label
          >Zielkonto (optional)<select v-model="accountId" aria-label="Zielkonto (optional)" class="control">
            <option value="">Ohne Konto — später zuordnen</option>
            <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option>
          </select></label
        >
        <p class="muted text-sm mt-2">
          Ohne Konto werden Buchungen bereits in der Übersicht gezählt. Du kannst sie später einem Konto zuordnen. Bei
          einem Zielkonto landen sie direkt dort.
        </p>
      </div>
      <label class="upload-zone"
        ><strong>CSV-Datei auswählen</strong
        ><span>Bis 10 MiB · bis 50.000 Zeilen · {{ filename || 'CSV-Export deiner Bank' }}</span
        ><input aria-label="CSV-Datei" type="file" accept=".csv,text/csv" @change="selectFile"
      /></label>
      <p v-if="readingFile" role="status">Datei wird gelesen …</p>
      <p v-if="headers.length" role="status" class="text-sm">
        Dateiformat: {{ encodingNames[detectedEncoding] }} · {{ delimiterNames[detectedDelimiter] }} ·
        {{ headers.length }} Spalten. Bitte prüfe, ob Umlaute in den Spaltennamen richtig aussehen.
      </p>
      <details class="import-format" :open="!!error && !!fileBytes">
        <summary>Dateiformat anpassen (optional)</summary>
        <p class="muted text-sm my-3">
          Normalerweise funktioniert „Automatisch“. Einstellungen wirken sofort auf dieselbe Datei; erneutes Auswählen
          ist nicht nötig.
        </p>
        <div class="form-row">
          <label
            >Kodierung<select v-model="encoding" class="control" :disabled="readingFile">
              <option value="auto">Automatisch (empfohlen)</option>
              <option v-for="(name, value) in encodingNames" :key="value" :value="value">{{ name }}</option></select
            ><span class="field-help"
              >Legt fest, wie Umlaute und Sonderzeichen gelesen werden. Automatisch prüft UTF-8, UTF-16 mit Markierung
              und sonst Windows-1252. Latin-9 bei falsch dargestelltem Eurozeichen manuell wählen.</span
            ></label
          >
          <label
            >Trennzeichen<select v-model="delimiter" class="control" :disabled="readingFile">
              <option value="auto">Automatisch (empfohlen)</option>
              <option v-for="(name, value) in delimiterNames" :key="value" :value="value">{{ name }}</option></select
            ><span class="field-help"
              >Zeichen zwischen den Spalten. Bleibt nur eine lange Spalte übrig, passt diese Einstellung meist
              nicht.</span
            ></label
          >
        </div>
      </details>
      <div v-if="headers.length">
        <h2>Welche Spalte enthält was?</h2>
        <p class="muted text-sm mt-2">
          Spaltenüberschriften sind die Namen in der ersten CSV-Zeile. Bekannte Namen sind vorausgewählt; prüfe sie vor
          der Vorschau. Mit * markierte Angaben sind nötig.
        </p>
      </div>
      <div v-if="headers.length" class="filter-grid">
        <label v-for="field in requiredFields" :key="field.key"
          >{{ field.label }} *<select v-model="mapping[field.key]" required class="control">
            <option value="">Spalte wählen</option>
            <option v-for="header in headers" :key="header">{{ header }}</option></select
          ><span class="field-help">{{ field.help }}</span></label
        >
      </div>
      <details v-if="headers.length" class="import-format">
        <summary>Weitere Angaben zuordnen (optional)</summary>
        <p class="muted text-sm my-3">
          Diese Angaben können leer bleiben. Wähle nur Spalten aus, deren Bedeutung du kennst.
        </p>
        <div class="filter-grid">
          <label v-for="field in optionalFields" :key="field.key"
            >{{ field.label
            }}<select v-model="mapping[field.key]" class="control">
              <option value="">Nicht zugeordnet</option>
              <option v-for="header in headers" :key="header">{{ header }}</option></select
            ><span class="field-help">{{ field.help }}</span></label
          >
        </div>
      </details>
      <p v-if="headers.length && missingFields.length" role="status" class="muted text-sm">
        Noch zuordnen: {{ missingFields.join(', ') }}.
      </p>
      <p class="muted text-sm">
        Die Vorschau übernimmt noch keine Buchungen. Erst „Import bestätigen“ speichert die gültigen Zeilen; mögliche
        Dubletten werden geprüft.
      </p>
      <UButton
        type="submit"
        :disabled="!headers.length || !content || !!missingFields.length || readingFile"
        :loading="busy"
        >Vorschau erstellen</UButton
      >
    </form>
  </section>
  <section v-else class="panel">
    <div class="panel-heading">
      <h2>Vorschau prüfen</h2>
      <span class="subtle-tag">{{ preview.totalRows }} Zeilen · {{ preview.invalidRows }} fehlerhaft</span>
    </div>
    <p class="muted mb-5">Noch keine Umsätze übernommen. Die ersten {{ preview.rows.length }} gültigen Zeilen:</p>
    <div v-for="(row, index) in preview.rows" :key="index" class="transaction-row">
      <div>
        <strong>{{ row.description }}</strong
        ><small>{{ calendarDate(row.bookingDate) }} · {{ row.counterpartyName || 'Keine Gegenpartei' }}</small>
      </div>
      <strong>{{ money(row.amountCents) }}</strong>
    </div>
    <UAlert v-if="preview.invalidRows" color="warning" title="Fehlerhafte Zeilen" class="mt-5"
      ><template #description
        ><p v-for="issue in preview.issues.slice(0, 20)" :key="issue.id">
          Zeile {{ issue.rowNumber }}: {{ issue.message }}
        </p>
        <p v-if="preview.invalidRows > 20">Weitere Fehler in der Importhistorie.</p></template
      ></UAlert
    ><label v-if="preview.invalidRows" class="block my-5"
      ><input v-model="allowPartial" type="checkbox" /> Nur gültige Zeilen übernehmen; fehlerhafte Zeilen
      auslassen.</label
    >
    <div class="toolbar mt-6">
      <UButton :disabled="preview.invalidRows > 0 && !allowPartial" :loading="busy" @click="commit"
        >Import bestätigen</UButton
      ><UButton :disabled="busy" variant="ghost" @click="cancel">Abbrechen</UButton>
    </div>
  </section>
</template>
