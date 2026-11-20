<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
const props = defineProps<{ runId: string }>();
const emit = defineEmits<{ removed: [] }>();
const api = useApi();
const open = ref(false);
const preview = ref<z.infer<typeof c.rollbackPreviewSchema> | null>(null);
const policy = ref<'KEEP' | 'REMOVE'>('KEEP');
const confirmLinks = ref(false);
const busy = ref(false);
const error = ref('');
let disposed = false;
let generation = 0;
/** Refresh impact before showing or retrying a destructive decision. */
async function load() {
  if (busy.value) return;
  const request = ++generation;
  open.value = true;
  busy.value = true;
  preview.value = null;
  error.value = '';
  policy.value = 'KEEP';
  confirmLinks.value = false;
  try {
    const result = await api.request(`/imports/${props.runId}/rollback-preview`, c.rollbackPreviewSchema);
    if (!disposed && request === generation) preview.value = result;
  } catch (cause) {
    if (!disposed && request === generation) error.value = userErrorMessage(cause);
  } finally {
    if (!disposed && request === generation) busy.value = false;
  }
}
/** Delete only after the shared server preview and required link consent. */
async function remove() {
  if (!preview.value || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await api.request(`/imports/${props.runId}/rollback`, c.rollbackResultSchema, {
      method: 'POST',
      body: c.rollbackInputSchema.parse({
        token: preview.value.token,
        confirm: true,
        linked: policy.value,
        confirmLinks: confirmLinks.value,
      }),
    });
    if (!disposed) {
      open.value = false;
      emit('removed');
    }
  } catch (cause) {
    if (disposed) return;
    error.value = userErrorMessage(cause);
    preview.value = null;
  } finally {
    if (!disposed) busy.value = false;
  }
}
onBeforeUnmount(
  /** A removed history row cannot reopen or publish late rollback results. */ () => {
    disposed = true;
    generation++;
  },
);
</script>

<template>
  <UButton size="xs" color="error" variant="ghost" @click="load">{{ tr('Import rückgängig machen') }}</UButton>
  <FinanceDialog
    v-model:open="open"
    :title="tr('Import rückgängig machen?')"
    :description="tr('Entfernte Buchungen können durch erneuten Upload wieder eingelesen werden.')"
    :dismissible="!busy"
  >
    <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" />
    <p v-if="busy" role="status">{{ tr('Wird geprüft …') }}</p>
    <template v-if="preview">
      <p class="mb-3">
        <strong
          >{{ preview.owned - (policy === 'KEEP' ? preview.linked : 0) }} {{ tr('Buchungen werden gelöscht.') }}</strong
        >
      </p>
      <p v-if="preview.shared || preview.uncertain" class="mb-3">
        {{ preview.shared }} {{ tr('mit weiteren Quellen und') }} {{ preview.uncertain }}
        {{ tr('mit unklarer Herkunft bleiben erhalten.') }}
      </p>
      <p v-if="preview.manual" class="mb-3">
        {{ preview.manual }}
        {{ tr('import-eigene Buchungen enthalten manuelle Zuordnungen. Beim Löschen gehen diese verloren.') }}
      </p>
      <URadioGroup
        v-if="preview.linked"
        v-model="policy"
        legend="Verknüpfte Buchungen"
        :disabled="busy"
        :items="[
          { label: tr('Verknüpfte Buchungen behalten ({0})', [preview.linked]), value: 'KEEP' },
          { label: tr('Verknüpfungen und import-eigene Buchungen entfernen'), value: 'REMOVE' },
        ]"
      />
      <UCheckbox
        v-if="preview.linked && policy === 'REMOVE'"
        v-model="confirmLinks"
        class="mt-4"
        :label="
          tr(
            'Vertrags- und Umbuchungszuordnungen ausdrücklich entfernen. Verträge und Gegenbuchungen bleiben erhalten.',
          )
        "
      />
      <p class="muted mt-4">
        {{
          tr(
            'Importverlauf und offene Klärungen werden entfernt. Änderungen an erhaltenen Buchungen werden nicht zurückgesetzt.',
          )
        }}
      </p>
      <DisclosurePanel :title="tr('Betroffene Buchungen')" class="mt-4">
        <ul class="grid gap-3">
          <li v-for="item in preview.items" :key="item.id">
            <strong>{{ item.description }}</strong> · {{ money(item.amountCents) }}
            <p class="muted">
              {{ calendarDate(item.bookingDate) }} ·
              {{
                item.protection === 'SHARED'
                  ? tr('Weitere Quelle – bleibt erhalten')
                  : item.protection === 'UNCERTAIN'
                    ? tr('Herkunft unklar – bleibt erhalten')
                    : (item.contractName || item.transfer) && policy === 'KEEP'
                      ? tr('Verknüpft – bleibt erhalten')
                      : tr('Wird gelöscht')
              }}<span v-if="item.contractName"> · {{ item.contractName }}</span
              ><span v-if="item.transfer"> {{ tr('· Umbuchung') }}</span>
            </p>
          </li>
        </ul>
        <p v-if="preview.truncated" class="muted">
          {{ tr('Erste 100 Buchungen; die Gesamtzahlen berücksichtigen alle.') }}
        </p>
      </DisclosurePanel>
    </template>
    <UButton v-else-if="!busy" variant="soft" @click="load">{{ tr('Vorschau neu laden') }}</UButton>
    <template #footer>
      <UButton color="neutral" variant="ghost" :disabled="busy" @click="open = false">{{ tr('Abbrechen') }}</UButton>
      <UButton
        color="error"
        :loading="busy"
        :disabled="!preview || (preview.linked > 0 && policy === 'REMOVE' && !confirmLinks)"
        @click="remove"
        >{{ tr('Import zurücknehmen') }}</UButton
      >
    </template>
  </FinanceDialog>
</template>
