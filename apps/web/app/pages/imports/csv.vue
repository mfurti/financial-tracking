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
const selectedFile = shallowRef<File | null | undefined>();
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
  'windows-1252': tr('Windows-1252 / ANSI'),
  'iso-8859-15': tr('ISO-8859-15 / Latin-9'),
  'utf-16le': tr('UTF-16 LE'),
  'utf-16be': tr('UTF-16 BE'),
};
const delimiterNames: Record<CsvDelimiter, string> = {
  ';': 'Semikolon (;)',
  ',': tr('Komma (,)'),
  '\t': tr('Tabulator'),
};
const requiredFields = [
  {
    key: 'bookingDate',
    label: tr('Buchungsdatum'),
    help: tr(
      'Tag der Buchung; bestimmt den Monat der Auswertung. TT.MM.JJ, TT.MM.JJJJ oder JJJJ-MM-TT. Zweistellige Jahre bedeuten 2000–2099.',
    ),
  },
  {
    key: 'amount',
    label: tr('Betrag'),
    help: tr('Geldbetrag mit Dezimalkomma, z. B. -49,90. Minus bedeutet Ausgabe, Plus bedeutet Einnahme.'),
  },
  {
    key: 'description',
    label: tr('Buchungstext'),
    help: tr('Beschreibung der Zahlung, meist die Spalte Verwendungszweck oder Buchungstext.'),
  },
] as const;
const optionalFields = [
  {
    key: 'descriptionFallback',
    label: tr('Buchungstext bei leerer Beschreibung'),
    help: tr(
      'Nur bei leerem Buchungstext wird diese Quellspalte verwendet. Sind beide leer, bleibt die Zeile zur Prüfung offen.',
    ),
  },
  {
    key: 'valueDate',
    label: tr('Wertstellung'),
    help: tr('Optionales Datum, ab dem die Bank den Betrag verzinst. Im Zweifel nicht zuordnen.'),
  },
  {
    key: 'counterpartyName',
    label: tr('Gegenpartei'),
    help: tr('Name der Person oder Firma, von der Geld kommt oder an die du zahlst.'),
  },
  {
    key: 'counterpartyIban',
    label: tr('Gegenkonto-IBAN'),
    help: tr('IBAN der anderen Person oder Firma; nicht die IBAN deines eigenen Kontos.'),
  },
  {
    key: 'reference',
    label: tr('Eindeutige Bankreferenz'),
    help: tr(
      'Nur eine Kennung, die genau eine Buchung identifiziert. Wiederholte Mandats- oder Kundenreferenzen hier nicht auswählen; im Zweifel leer lassen.',
    ),
  },
  {
    key: 'currency',
    label: tr('Währung'),
    help: tr('Spalte mit EUR. Ohne Zuordnung wird EUR angenommen; andere Währungen werden nicht umgerechnet.'),
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
  selectedFile.value = undefined;
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
async function selectFile(file?: File | null) {
  if (busy.value || readingFile.value) return;
  const generation = ++fileGeneration;
  error.value = '';
  resetFile();
  readingFile.value = false;
  if (!file) return;
  selectedFile.value = file;
  if (file.size > 10 * 1024 * 1024) {
    error.value = tr('Die Datei ist größer als 10 MiB. Exportiere im Online-Banking einen kleineren Zeitraum.');
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
      error.value = tr('Die Datei konnte nicht geöffnet werden. Speichere sie lokal und wähle sie erneut aus.');
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
  selectedFile.value = undefined;
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
          ? tr(
              'Die Übernahme ist noch nicht abgeschlossen. Du kannst dieselbe Übernahme erneut anfordern; dieselbe Buchung wird dadurch nicht doppelt gespeichert.',
            )
          : tr(
              'Der Import ist noch nicht abgeschlossen. Prüfe den Status erneut oder sieh in der Importhistorie nach.',
            );
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
      error.value = tr(
        'Die Antwort auf die Übernahme fehlt. Wir prüfen den bestehenden Import, damit keine zweite Übernahme gestartet wird.',
      );
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
    selectedFile.value = undefined;
    fileGeneration++;
    disposed = true;
    if (preview.value && !committed.value && !saving.value && !commitUncertain.value) void cancel();
  },
);
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>{{ tr('CSV importieren') }}</h1>
    </div>
    <UButton to="/imports" variant="ghost">{{ tr('Importhistorie') }}</UButton>
  </div>
  <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-5" />
  <div v-if="readingFile || busy" role="status" class="panel upload-progress mb-5">
    <strong>{{
      readingFile
        ? tr('Datei wird gelesen …')
        : saving
          ? tr('Buchungen werden übernommen …')
          : tr('Datei wird ausgewertet …')
    }}</strong>
  </div>
  <section v-if="!preview" class="panel import-upload">
    <form class="space-y-6" @submit.prevent="makePreview">
      <UFormField :label="tr('CSV-Datei')" name="file"
        ><UFileUpload
          v-model="selectedFile"
          accept=".csv,text/csv"
          :label="tr('CSV-Datei auswählen')"
          :description="filename || tr('CSV-Bankexport · Datei wählen oder hier ablegen · maximal 10 MiB')"
          :disabled="busy || readingFile"
          @update:model-value="selectFile"
      /></UFormField>
      <p class="muted text-sm">{{ tr('Gültige Buchungen werden nach der Dateiauswahl automatisch übernommen.') }}</p>
      <p v-if="mapping.descriptionFallback" class="muted text-sm" role="status">
        {{ tr('Beschreibung:') }} {{ mapping.description }} {{ tr('; bei leerem Inhalt:') }}
        {{ mapping.descriptionFallback }}.
      </p>
      <DisclosurePanel
        v-model:open="formatExpanded"
        class="import-format"
        :title="tr('Importoptionen (nur bei Bedarf)')"
        ><p class="muted text-sm my-3">
          {{ tr('Normalerweise ist hier nichts nötig. Änderungen am Dateiformat lesen dieselbe Datei erneut.') }}
        </p>
        <div class="form-row csv-columns">
          <label
            >{{ tr('Zielkonto (optional)')
            }}<ChoiceSelect
              v-model="accountId"
              :aria-label="tr('Zielkonto (optional)')"
              :disabled="busy || readingFile"
              :searchable="true"
              :items="[
                { label: tr('Ohne Konto — später zuordnen'), value: '' },
                ...accounts.map(
                  /** Build a persisted choice. */ (account) => ({ label: `${account.name}`, value: account.id }),
                ),
              ]"
            /><span class="field-help">{{
              tr('Ohne Konto zählen Buchungen sofort in deiner Auswertung. Eine spätere Zuordnung ist möglich.')
            }}</span></label
          >
          <label
            >{{ tr('Kodierung')
            }}<ChoiceSelect
              v-model="encoding"
              :disabled="busy || readingFile"
              :searchable="false"
              :items="[
                { label: tr('Automatisch (empfohlen)'), value: 'auto' },
                ...Object.entries(encodingNames).map(
                  /** Build a format choice. */ ([value, name]) => ({ label: `${name}`, value: value }),
                ),
              ]"
            /><span class="field-help">{{
              tr(
                'Bestimmt, wie Umlaute und Sonderzeichen gelesen werden. Bei älteren Bankexporten hilft Windows-1252; für ein falsch dargestelltes Eurozeichen kann Latin-9 passen.',
              )
            }}</span></label
          >
          <label
            >{{ tr('Trennzeichen')
            }}<ChoiceSelect
              v-model="delimiter"
              :disabled="busy || readingFile"
              :searchable="false"
              :items="[
                { label: tr('Automatisch (empfohlen)'), value: 'auto' },
                ...Object.entries(delimiterNames).map(
                  /** Build a format choice. */ ([value, name]) => ({ label: `${name}`, value: value }),
                ),
              ]"
            /><span class="field-help">{{
              tr('Zeichen zwischen den Spalten. Automatisch erkennt Semikolon, Komma oder Tabulator.')
            }}</span></label
          >
        </div></DisclosurePanel
      >
      <template v-if="needsMapping && !busy">
        <div>
          <h2>{{ tr('Eine kurze Zuordnung fehlt') }}</h2>
          <p class="muted text-sm mt-2">
            {{
              tr(
                'Wir kennen diese Spaltennamen noch nicht eindeutig. Wähle, welche Spalte Datum, Betrag und Beschreibung enthält. Danach übernehmen wir die Auswertung.',
              )
            }}
          </p>
        </div>
        <div class="filter-grid csv-columns">
          <label v-for="field in requiredFields" :key="field.key"
            >{{ field.label }} *<ChoiceSelect
              v-model="mapping[field.key]"
              required
              :searchable="true"
              :items="[
                { label: tr('Spalte wählen'), value: '' },
                ...headers.map(
                  /** Build a persisted choice. */ (header) => ({ label: `${header}`, value: `${header}` }),
                ),
              ]"
            /><span class="field-help">{{ field.help }}</span></label
          >
        </div>
        <DisclosurePanel class="import-format" :title="tr('Weitere Angaben zuordnen (optional)')"
          ><div class="filter-grid csv-columns mt-4">
            <label v-for="field in optionalFields" :key="field.key"
              >{{ field.label
              }}<ChoiceSelect
                v-model="mapping[field.key]"
                :searchable="true"
                :items="[
                  { label: tr('Nicht zugeordnet'), value: '' },
                  ...headers.map(
                    /** Build a persisted choice. */ (header) => ({ label: `${header}`, value: `${header}` }),
                  ),
                ]"
              /><span class="field-help">{{ field.help }}</span></label
            >
          </div></DisclosurePanel
        >
        <p v-if="missingFields.length" role="status" class="muted text-sm">
          {{ tr('Noch zuordnen:') }} {{ missingFields.join(', ') }}.
        </p>
        <UButton type="submit" :disabled="!!missingFields.length || !content" :loading="busy">{{
          tr('Jetzt auswerten')
        }}</UButton>
      </template>
    </form>
  </section>
  <section v-else-if="!busy" class="panel">
    <div class="panel-heading">
      <h2>{{ tr('Einmal kurz prüfen') }}</h2>
      <span class="subtle-tag"
        >{{ preview.totalRows }} {{ tr('Zeilen ·') }} {{ preview.invalidRows }} {{ tr('fehlerhaft') }}</span
      >
    </div>
    <p v-if="preview.invalidRows" class="muted mb-5">
      {{
        tr(
          'Diese Datei enthält ungültige Zeilen. Entscheide, ob wir nur die gültigen Buchungen übernehmen sollen, oder korrigiere den Export.',
        )
      }}
    </p>
    <p v-else class="muted mb-5">
      {{
        tr('Die Übernahme konnte noch nicht bestätigt werden. Prüfe den bestehenden Importstatus, bevor du fortfährst.')
      }}
    </p>
    <UAlert v-if="preview.invalidRows" color="warning" :title="tr('Diese Zeilen brauchen Aufmerksamkeit')" class="my-5"
      ><template #description
        ><p v-for="issue in preview.issues.slice(0, 20)" :key="issue.id">
          {{ tr('Zeile') }} {{ issue.rowNumber }}: {{ issue.message }}
        </p>
        <p v-if="preview.invalidRows > 20">{{ tr('Weitere Hinweise findest du in der Importhistorie.') }}</p></template
      ></UAlert
    >
    <DisclosurePanel v-if="preview.rows.length" class="import-format my-5" :title="tr('Gültige Buchungen ansehen')"
      ><div v-for="(row, index) in preview.rows" :key="index" class="transaction-row">
        <div>
          <strong>{{ row.description }}</strong
          ><small>{{ calendarDate(row.bookingDate) }} · {{ row.counterpartyName || tr('Keine Gegenpartei') }}</small>
        </div>
        <strong>{{ money(row.amountCents) }}</strong>
      </div></DisclosurePanel
    >
    <p v-else class="muted mb-5">
      {{
        tr('Es wurden keine gültigen Buchungen erkannt. Bitte prüfe die Zuordnung oder exportiere die Datei erneut.')
      }}
    </p>
    <UCheckbox
      v-if="preview.invalidRows && preview.rows.length"
      v-model="allowPartial"
      class="block my-5"
      :disabled="commitUncertain"
      :label="tr('Nur gültige Zeilen übernehmen; fehlerhafte Zeilen auslassen.')"
    />
    <div class="toolbar mt-6">
      <UButton v-if="commitUncertain" :loading="busy" @click="checkImportStatus">{{
        tr('Importstatus prüfen')
      }}</UButton>
      <UButton
        v-else
        :disabled="!preview.rows.length || (preview.invalidRows > 0 && !allowPartial)"
        :loading="busy"
        @click="commit"
        >{{ preview.invalidRows ? tr('Gültige Buchungen übernehmen') : tr('Übernahme erneut versuchen') }}</UButton
      >
      <UButton :disabled="busy || commitUncertain" variant="ghost" @click="cancel">{{ tr('Datei wechseln') }}</UButton>
    </div>
  </section>
</template>
