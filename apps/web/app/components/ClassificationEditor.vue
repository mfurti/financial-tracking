<script setup lang="ts">
import { z } from 'zod';
import { bulkClassificationSchema } from '@financial-tracking/contracts';
const props = defineProps<{ ids: string[]; value?: 'FIXED' | 'VARIABLE' | null }>();
const emit = defineEmits<{ changed: [] }>();
const api = useApi();
const choice = ref(props.value ?? '');
const busy = ref(false);
const error = ref('');
watch(
  /** Follow a newly loaded transaction without submitting a change. */ () => props.value,
  /** Keep null as the explicit automatic fallback. */ (value) => {
    choice.value = value ?? '';
  },
);
/** Persist only the explicit selected transaction identities, preserving categories and amounts. */
async function save() {
  busy.value = true;
  error.value = '';
  try {
    await api.request('/transactions/bulk-classification', z.object({ updated: z.number().int() }), {
      method: 'POST',
      body: bulkClassificationSchema.parse({ ids: props.ids, classification: choice.value || null }),
    });
    emit('changed');
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="my-4">
    <UFormField
      label="Fix oder variabel"
      help="Manuelle Auswahl hat Vorrang. Automatisch: bestätigte Vertragszahlung = fix, sonst nicht eingeordnet."
    >
      <div class="toolbar">
        <ChoiceSelect
          v-model="choice"
          aria-label="Fix oder variabel"
          :searchable="false"
          :items="[
            { label: 'Automatisch / nicht eingeordnet', value: '' },
            { label: 'Fix', value: 'FIXED' },
            { label: 'Variabel', value: 'VARIABLE' },
          ]"
        /><UButton variant="soft" :loading="busy" :disabled="!ids.length" @click="save"
          >Kennzeichnung speichern</UButton
        >
      </div>
    </UFormField>
    <UAlert v-if="error" role="alert" color="error" :description="error" class="mt-3" />
  </div>
</template>
