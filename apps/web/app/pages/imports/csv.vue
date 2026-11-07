<script setup lang="ts">
import { z } from 'zod';
import { parse } from 'csv-parse/browser/esm/sync';
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
const encoding = ref('utf-8');
const delimiter = ref(';');
const headers = ref<string[]>([]);
const content = ref('');
const filename = ref('');
const error = ref('');
const busy = ref(false);
const allowPartial = ref(false);
const preview = ref<z.infer<typeof csvPreviewSchema> | null>(null);
const committed = ref(false);
const mapping = reactive<CsvMapping>({ bookingDate: '', amount: '', description: '' });
const requiredFields = [
  { key: 'bookingDate', label: 'Buchungsdatum' },
  { key: 'amount', label: 'Betrag' },
  { key: 'description', label: 'Buchungstext' },
] as const;
const optionalFields = [
  { key: 'valueDate', label: 'Wertstellung' },
  { key: 'counterpartyName', label: 'Gegenpartei' },
  { key: 'counterpartyIban', label: 'Gegenkonto-IBAN' },
  { key: 'reference', label: 'Eindeutige Bankreferenz' },
  { key: 'currency', label: 'Währung' },
] as const;
/** Read an explicitly selected bounded file into transient page memory. */
async function selectFile(event: Event) {
  error.value = '';
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    error.value = 'Maximal 10 MiB pro Datei.';
    return;
  }
  try {
    content.value = new TextDecoder(encoding.value, { fatal: true }).decode(await file.arrayBuffer());
    filename.value = file.name;
    readHeaders();
  } catch {
    content.value = '';
    error.value = 'Datei kann mit dieser Kodierung nicht gelesen werden. Kodierung wählen und Datei erneut auswählen.';
  }
}
/** Parse quoted CSV headers using the same parser family as the backend. */
function readHeaders() {
  error.value = '';
  try {
    const records = parse(content.value, {
      delimiter: delimiter.value,
      bom: true,
      skip_empty_lines: true,
      to: 1,
    }) as string[][];
    headers.value = records[0]?.map(/** Trim imported header whitespace. */ (value) => value.trim()) ?? [];
    const guesses: Record<string, string[]> = {
      bookingDate: ['Buchungstag', 'Buchungsdatum', 'Datum'],
      amount: ['Betrag', 'Umsatz'],
      description: ['Verwendungszweck', 'Buchungstext', 'Text'],
      valueDate: ['Wertstellung', 'Valutadatum'],
      counterpartyName: ['Beguenstigter/Zahlungspflichtiger', 'Begünstigter/Zahlungspflichtiger', 'Gegenpartei'],
      reference: ['Bankreferenz'],
      currency: ['Waehrung', 'Währung'],
    };
    for (const [key, options] of Object.entries(guesses)) {
      const candidate = options.find(
        /** Match known headings without guessing financial values. */ (option) => headers.value.includes(option),
      );
      if (candidate) (mapping as Record<string, string>)[key] = candidate;
    }
  } catch {
    headers.value = [];
    error.value = 'CSV-Kopfzeile ungültig. Trennzeichen prüfen.';
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
      encoding: encoding.value,
      delimiter: delimiter.value,
      mapping: Object.fromEntries(
        Object.entries(mapping).filter(/** Omit unassigned optional columns. */ ([, value]) => !!value),
      ),
    });
    preview.value = await api.request('/imports/csv/preview', csvPreviewSchema, { method: 'POST', body });
    content.value = '';
  } catch (cause) {
    error.value = (cause as Error).message;
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
    error.value = (cause as Error).message;
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
      headers.value = [];
      filename.value = '';
    } catch (cause) {
      error.value = (cause as Error).message;
    }
}
onMounted(
  /** Load explicit active target accounts. */ async () => {
    try {
      accounts.value = (await api.request('/accounts', z.array(accountSchema))).filter(
        /** Hide inactive import targets. */ (account) => account.isActive,
      );
    } catch (cause) {
      error.value = (cause as Error).message;
    }
  },
);
onBeforeUnmount(
  /** Raw file data never survives this view; cancel abandoned previews. */ () => {
    content.value = '';
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
      <div class="form-row">
        <label
          >Zielkonto (optional)<select v-model="accountId" aria-label="Zielkonto (optional)" class="control">
            <option value="">Ohne Konto — später zuordnen</option>
            <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option>
          </select></label
        ><label
          >Kodierung<select v-model="encoding" class="control">
            <option value="utf-8">UTF-8 / BOM</option>
            <option value="windows-1252">Windows-1252</option>
          </select></label
        ><label
          >Trennzeichen<select v-model="delimiter" class="control" @change="readHeaders">
            <option value=";">Semikolon</option>
            <option value=",">Komma</option>
          </select></label
        >
      </div>
      <label class="upload-zone"
        ><strong>CSV-Datei auswählen</strong
        ><span>Bis 10 MiB · bis 50.000 Zeilen · {{ filename || 'Sparkassen-Export' }}</span
        ><input aria-label="CSV-Datei" type="file" accept=".csv,text/csv" @change="selectFile"
      /></label>
      <div v-if="headers.length" class="filter-grid">
        <label v-for="field in requiredFields" :key="field.key"
          >{{ field.label }} *<select v-model="mapping[field.key]" required class="control">
            <option value="">Spalte wählen</option>
            <option v-for="header in headers" :key="header">{{ header }}</option>
          </select></label
        ><label v-for="field in optionalFields" :key="field.key"
          >{{ field.label
          }}<select v-model="mapping[field.key]" class="control">
            <option value="">Nicht zugeordnet</option>
            <option v-for="header in headers" :key="header">{{ header }}</option>
          </select></label
        >
      </div>
      <p class="muted text-sm">
        Nur tatsächlich eindeutige Bankreferenzen zuordnen. Andere Referenzen leer lassen; mögliche Dubletten werden zur
        Prüfung vorgelegt.
      </p>
      <UButton type="submit" :disabled="!headers.length || !content" :loading="busy">Vorschau erstellen</UButton>
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
