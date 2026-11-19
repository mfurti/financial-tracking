<script setup lang="ts">
import { analysisModuleIds, type AnalysisModuleId } from '../utils/workspace-preferences';
import { analysisModuleLabels } from '../utils/analysis-modules';
const props = defineProps<{ available: readonly AnalysisModuleId[] }>();
const { preferences, updatePreferences, storageState } = useWorkspacePreferences();
const open = ref(false);
const draft = ref<AnalysisModuleId[]>([]);
const options = computed(
  /** Display the actual configured order before unselected options. */ () => [
    ...draft.value,
    ...analysisModuleIds.filter(
      /** Keep every declared identity selectable once, without duplicates. */ (id) => !draft.value.includes(id),
    ),
  ],
);

/** Edit only delivered module selections while preserving ordered future preferences without applying them. */
function toggle(id: AnalysisModuleId, checked: boolean | 'indeterminate') {
  if (!props.available.includes(id)) return;
  draft.value =
    checked === true
      ? [...new Set([...draft.value, id])]
      : draft.value.filter(/** Remove only the unchecked identity. */ (entry) => entry !== id);
}
/** Move one selected module without rewriting labels or unrelated device choices. */
function move(id: AnalysisModuleId, delta: -1 | 1) {
  const index = draft.value.indexOf(id),
    target = index + delta;
  if (!props.available.includes(id) || index < 0 || target < 0 || target >= draft.value.length) return;
  const next = [...draft.value];
  [next[index], next[target]] = [next[target]!, next[index]!];
  draft.value = next;
}
/** Commit the reviewed selection only on explicit Save; cancellation leaves preferences unchanged. */
function save() {
  updatePreferences({ analysisModules: [...draft.value] });
  open.value = false;
}
watch(
  open,
  /** Restore a fresh draft each time the existing dialog trigger opens. */ (value) => {
    if (value) draft.value = [...preferences.value.analysisModules];
  },
);
</script>

<template>
  <FinanceDialog
    v-model:open="open"
    title="Deine Analysen anpassen"
    description="Auswahl und Reihenfolge werden auf diesem Gerät gespeichert."
  >
    <template #trigger><UButton variant="ghost" aria-label="Analysen anpassen">Anpassen</UButton></template>
    <div v-for="id in options" :key="id" class="finance-module-option">
      <div>
        <UCheckbox
          :model-value="draft.includes(id)"
          :label="analysisModuleLabels[id]"
          :disabled="!available.includes(id)"
          @update:model-value="toggle(id, $event)"
        /><small v-if="!available.includes(id)" class="muted">Noch nicht verfügbar</small>
      </div>
      <div class="toolbar">
        <UButton
          size="sm"
          variant="ghost"
          :aria-label="`${analysisModuleLabels[id]} nach oben`"
          :disabled="!available.includes(id) || draft.indexOf(id) <= 0"
          @click="move(id, -1)"
          >↑</UButton
        ><UButton
          size="sm"
          variant="ghost"
          :aria-label="`${analysisModuleLabels[id]} nach unten`"
          :disabled="!available.includes(id) || draft.indexOf(id) < 0 || draft.indexOf(id) === draft.length - 1"
          @click="move(id, 1)"
          >↓</UButton
        >
      </div>
    </div>
    <p v-if="storageState === 'unavailable'" role="status" class="muted mt-4">
      Gerätespeicher ist nicht verfügbar. Die Auswahl bleibt für diese Sitzung nutzbar.
    </p>
    <template #footer
      ><UButton variant="ghost" @click="open = false">Abbrechen</UButton
      ><UButton @click="save">Auswahl speichern</UButton></template
    >
  </FinanceDialog>
</template>
