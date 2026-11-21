<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
import { ApiError } from '../utils/api-error';
const api = useApi();
const records = ref<z.infer<typeof c.wealthRecordSchema>[]>([]);
const preview = ref<z.infer<typeof c.wealthPreviewSchema> | null>(null);
const cursor = ref<string | null>(null);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const captureError = ref('');
const open = ref(false);
const retryKey = ref<string | null>(null);
const uncertain = ref(false);
const notice = ref('');
let generation = 0;
let disposed = false;
const blockLabels: Record<string, string> = {
  NO_ACCOUNTS: tr('Noch keine aktiven Quellkonten vorhanden.'),
  TOTAL_OUT_OF_RANGE: tr(
    'Die bekannte Summe liegt außerhalb des speicherbaren Cent-Bereichs. Quellen prüfen; Beträge werden nicht gekürzt.',
  ),
  SOURCE_LABEL_TOO_LONG: tr(
    'Ein Kontoname ist länger als 120 Zeichen. Kürze ihn ausdrücklich in den Kontoeinstellungen, bevor du aufzeichnest.',
  ),
  SOURCE_TYPE_TOO_LONG: tr('Eine Quellbezeichnung ist zu lang. Prüfe die Quelle, bevor du aufzeichnest.'),
  SOURCE_METADATA_INVALID: tr('Eine Quellbezeichnung fehlt. Prüfe die Kontoeinstellungen.'),
};
/** Explain observation provenance without presenting internal state tokens as product labels. */
function sourceDescription(value: string) {
  if (value === 'CSV') return 'CSV';
  if (value === 'FINTS') return tr('Bank');
  if (value === 'MISSING') return tr('Kein gebuchter Saldo geliefert');
  if (value.startsWith('UNSUPPORTED_CURRENCY:')) return tr('Andere Währung, nicht in EUR umgerechnet');
  return tr('Bestand, Quelle nicht bestätigt');
}
/** Count only actually observed components, preserving an all-unknown record as unknown rather than observed zero. */
function observedCount(record: z.infer<typeof c.wealthRecordSchema>) {
  return record.components.filter(/** Explicit zero is observed; null is not. */ (item) => item.amountCents !== null)
    .length;
}
/** Read immutable history independently of current-source freshness, rejecting superseded reads. */
async function load(append = false) {
  if (append && loading.value) return;
  const request = ++generation;
  loading.value = true;
  error.value = '';
  if (!append) {
    records.value = [];
    preview.value = null;
    cursor.value = null;
  }
  try {
    const result = await api.request('/wealth-records', c.wealthRecordsSchema, {
      query: { limit: 5, ...(append && cursor.value ? { cursor: cursor.value } : {}) },
    });
    if (disposed || request !== generation) return;
    records.value = append
      ? [
          ...records.value,
          ...result.items.filter(
            /** A concurrent read must not duplicate an already displayed immutable identity. */ (item) =>
              !records.value.some(/** Match only public immutable IDs. */ (current) => current.id === item.id),
          ),
        ]
      : result.items;
    preview.value = result.preview;
    cursor.value = result.nextCursor;
  } catch (cause) {
    if (!disposed && request === generation) error.value = userErrorMessage(cause);
  } finally {
    if (!disposed && request === generation) loading.value = false;
  }
}
/** Begin explicit source review; an unresolved transport retry retains its existing confirmation identity. */
function review() {
  if (!preview.value?.recordable || loading.value || saving.value) return;
  retryKey.value ??= crypto.randomUUID();
  captureError.value = '';
  open.value = true;
}
/** Capture only server-derived observations, retaining one identity until a successful confirmation. */
async function capture() {
  if (!retryKey.value || saving.value) return;
  saving.value = true;
  captureError.value = '';
  try {
    await api.request('/wealth-records', c.wealthRecordSchema, {
      method: 'POST',
      body: c.wealthRecordInputSchema.parse({ idempotencyKey: retryKey.value }),
    });
    if (disposed) return;
    open.value = false;
    retryKey.value = null;
    uncertain.value = false;
    await load();
    if (!disposed) notice.value = tr('Werte aufgezeichnet. Spätere Bankdaten ändern diese Aufzeichnung nicht.');
  } catch (cause) {
    if (!disposed) {
      uncertain.value = !(cause instanceof ApiError) || cause.status === 0 || cause.status >= 500;
      captureError.value = uncertain.value
        ? tr('Die Antwort fehlt. Bestätige erneut; dieselbe Aufzeichnung wird nicht doppelt angelegt.')
        : userErrorMessage(cause);
    }
  } finally {
    if (!disposed) saving.value = false;
  }
}
onMounted(/** Load only real existing records; mounting never captures a value. */ () => load());
onBeforeUnmount(
  /** Revoke reads/capture feedback owned by the abandoned wealth view. */ () => {
    disposed = true;
    generation++;
  },
);
</script>

<template>
  <div class="recorded-wealth">
    <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" />
    <p v-if="notice" role="status" class="muted mb-4">{{ notice }}</p>
    <div class="toolbar mb-5">
      <UButton variant="soft" :disabled="loading || saving || open" @click="load()">{{
        tr('Quellen und Verlauf aktualisieren')
      }}</UButton
      ><UButton :disabled="!preview?.recordable || loading || saving" @click="review">{{
        tr('Werte aufzeichnen')
      }}</UButton>
    </div>
    <FinanceTile v-if="loading && !preview" :label="tr('Aktuelle Quellen')" state="loading" />
    <FinanceTile
      v-else-if="preview"
      :label="tr('Aktuelle Quellen')"
      :value="preview.totalCents === null ? tr('Keine bekannten Beträge') : money(preview.totalCents)"
      :financial="preview.totalCents !== null"
      :context="
        tr('{0} von {1} Quellen beobachtet · {2} · {3}', [
          preview.observedCount,
          preview.componentCount,
          preview.coverage === 'COMPLETE' ? tr('Beobachtungen vollständig') : tr('Unvollständige Beobachtungen'),
          observedTime(preview.asOf),
        ])
      "
      variant="insight"
    />
    <p v-if="preview?.blockingReason" role="status" class="muted my-4">{{ blockLabels[preview.blockingReason] }}</p>
    <p class="muted my-5">
      {{
        tr(
          'Aktive Konten, neuester beobachteter gebuchter EUR-Saldo. Verfügbare Beträge und Fremdwährungen werden nicht als EUR mitgerechnet. Aufzeichnungen zeigen nur ausdrücklich gespeicherte Beobachtungen; sie rekonstruieren keine frühere Bankhistorie.',
        )
      }}
    </p>
    <SectionPanel :title="tr('Aufgezeichnete Werte')" icon="history" compact>
      <p v-if="loading" role="status">{{ tr('Aufzeichnungen werden geladen …') }}</p>
      <p v-if="!records.length && !loading && !error" class="empty-copy">
        {{ tr('Noch keine Vermögenswerte aufgezeichnet.') }}
      </p>
      <UButton v-if="error && !loading" variant="soft" @click="load()">{{ tr('Erneut laden') }}</UButton>
      <article v-for="record in records" :key="record.id" :data-wealth-record="record.id" class="wealth-record">
        <details>
          <summary>
            <strong>{{ observedTime(record.recordedAt) }}</strong
            ><strong :data-financial="observedCount(record) > 0 || undefined">{{
              observedCount(record) ? money(record.totalCents) : tr('Keine bekannten Beträge')
            }}</strong>
          </summary>
          <p class="muted mb-4">
            {{ observedCount(record) }} {{ tr('von') }} {{ record.components.length }} {{ tr('Quellen beobachtet ·') }}
            {{ record.coverage === 'COMPLETE' ? tr('Beobachtungen vollständig') : tr('Unvollständige Beobachtungen') }}
            {{ tr('. Eingefrorener Stand der Aufzeichnung.') }}
          </p>
          <div v-for="item in record.components" :key="item.id" class="wealth-source">
            <NuxtLink v-if="item.accountId" :to="`/accounts/${item.accountId}`"
              ><strong>{{ item.sourceLabel }}</strong></NuxtLink
            ><strong v-else>{{ item.sourceLabel }}</strong>
            <p v-if="item.amountCents !== null" data-financial>
              <template v-if="!amountsMasked()">{{ money(item.amountCents) }}</template
              ><template v-else>{{ tr('Betrag ausgeblendet') }}</template>
            </p>
            <p v-else>{{ tr('Unbekannter Betrag') }}</p>
            <p class="muted">
              {{ item.observedAt ? observedTime(item.observedAt) : tr('Keine Beobachtungszeit geliefert') }} ·
              {{ sourceDescription(item.sourceType)
              }}<span v-if="!item.accountId"> {{ tr('· Quellkonto nicht mehr verknüpft') }}</span>
            </p>
          </div>
        </details>
      </article>
      <UButton v-if="cursor" variant="soft" :loading="loading" class="mt-4" @click="load(true)">{{
        tr('Weitere Aufzeichnungen laden')
      }}</UButton>
    </SectionPanel>
    <FinanceDialog
      v-model:open="open"
      :title="tr('Werte aufzeichnen')"
      :description="
        tr(
          'Prüfe Quellen, Beträge und fehlende Beobachtungen. Beim Bestätigen werden die Quellen erneut konsistent gelesen und der Stand unveränderlich gespeichert.',
        )
      "
      :dismissible="!saving"
      :close="!saving"
    >
      <UAlert v-if="captureError" role="alert" color="error" :description="captureError" class="mb-4" />
      <template v-if="preview">
        <p class="muted mb-3">
          {{ tr('Vorschau vom') }} {{ observedTime(preview.asOf) }} · {{ preview.observedCount }} {{ tr('von') }}
          {{ preview.componentCount }} {{ tr('Quellen beobachtet. Unbekannte Beträge bleiben unbekannt.') }}
        </p>
        <div v-for="item in preview.components" :key="item.accountId" class="wealth-source">
          <strong>{{ item.sourceLabel }}</strong>
          <p v-if="item.amountCents !== null" data-financial>
            <template v-if="!amountsMasked()">{{ money(item.amountCents) }}</template
            ><template v-else>{{ tr('Betrag ausgeblendet') }}</template>
          </p>
          <p v-else>{{ tr('Unbekannter Betrag') }}</p>
          <p class="muted">
            {{ item.currency }} ·
            {{ item.observedAt ? observedTime(item.observedAt) : tr('Keine Beobachtungszeit geliefert') }} ·
            {{ sourceDescription(item.sourceType) }}<span v-if="item.stale"> {{ tr('· älter als 48 Stunden') }}</span>
          </p>
        </div>
      </template>
      <template #footer
        ><UButton :loading="saving" @click="capture">{{ tr('Jetzt aufzeichnen') }}</UButton
        ><UButton variant="ghost" :disabled="saving" @click="open = false">{{ tr('Abbrechen') }}</UButton></template
      >
    </FinanceDialog>
  </div>
</template>

<style scoped>
.wealth-record {
  border-bottom: 1px solid var(--line);
  padding: 12px 0;
}
.wealth-record:last-child {
  border: 0;
}
.wealth-record summary {
  cursor: pointer;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  overflow-wrap: anywhere;
}
.wealth-record summary::before {
  content: '▸';
  color: var(--muted);
}
.wealth-record details[open] > summary::before {
  content: '▾';
}
.wealth-source {
  padding: 12px 0;
  border-top: 1px solid var(--line);
  overflow-wrap: anywhere;
}
</style>
