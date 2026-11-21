<script setup lang="ts">
import { z } from 'zod';
import { bulkClassificationSchema } from '@financial-tracking/contracts';
const props = defineProps<{ ids: string[]; value?: 'FIXED' | 'VARIABLE' | null }>();
const emit = defineEmits<{ changed: [] }>();
const api = useApi();
const choice = ref(props.value ?? '');
const busy = ref(false);
const error = ref('');
let disposed = false;
watch(
  /** Follow a newly loaded transaction without submitting a change. */ () => props.value,
  /** Keep null as the explicit automatic fallback. */ (value) => {
    choice.value = value ?? '';
  },
);
/** Persist only the explicit selected transaction identities, preserving categories and amounts. */
async function save() {
  if (busy.value || !props.ids.length) return;
  busy.value = true;
  error.value = '';
  try {
    await api.request('/transactions/bulk-classification', z.object({ updated: z.number().int() }), {
      method: 'POST',
      body: bulkClassificationSchema.parse({ ids: props.ids, classification: choice.value || null }),
    });
    if (!disposed) emit('changed');
  } catch (cause) {
    if (!disposed) error.value = userErrorMessage(cause);
  } finally {
    if (!disposed) busy.value = false;
  }
}
onBeforeUnmount(
  /** Ignore late annotation feedback after the owning selection is gone. */ () => {
    disposed = true;
  },
);
</script>
<template>
  <SectionPanel :title="tr('Kennzeichnung')" icon="transactions" compact>
    <UFormField
      :label="tr('Fix oder variabel')"
      :help="
        tr('Manuelle Auswahl hat Vorrang. Automatisch: bestätigte Vertragszahlung = fix, sonst nicht eingeordnet.')
      "
    >
      <div class="toolbar">
        <ChoiceSelect
          v-model="choice"
          :aria-label="tr('Fix oder variabel')"
          :searchable="false"
          :disabled="busy"
          :items="[
            { label: tr('Automatisch / nicht eingeordnet'), value: '' },
            { label: tr('Fix'), value: 'FIXED' },
            { label: tr('Variabel'), value: 'VARIABLE' },
          ]"
        /><UButton variant="soft" :loading="busy" :disabled="!ids.length" @click="save">{{
          tr('Kennzeichnung speichern')
        }}</UButton>
      </div>
    </UFormField>
    <UAlert v-if="error" role="alert" color="error" :description="error" class="mt-3" />
  </SectionPanel>
</template>
