<script setup lang="ts" generic="T extends string | number = string">
/** A transport choice keeps its original string value, including an explicit empty selection. */
type Choice = { label: string; value: T; disabled?: boolean };
defineOptions({ inheritAttrs: false });
const props = withDefaults(
  defineProps<{ modelValue?: T; items: Choice[]; searchable?: boolean; disabled?: boolean }>(),
  {
    modelValue: undefined,
    searchable: true,
  },
);
const emit = defineEmits<{ 'update:modelValue': [value: T] }>();
const empty = '__ledger_empty_choice__';
const choices = computed(
  /** Reka selections require a non-empty item value. */ () =>
    props.items.map(
      /** Keep empty wire values out of the UI sentinel. */ (item) => ({ ...item, value: String(item.value) || empty }),
    ),
);
const selection = computed({
  /** Restore the explicit empty choice in the trigger. */ get: () => String(props.modelValue ?? '') || empty,
  /** Emit only the original, typed API value. */ set: (value: string) => {
    const original = props.items.find(
      /** Match the UI token to its typed source. */ (item) => (String(item.value) || empty) === String(value),
    );
    if (original) emit('update:modelValue', original.value);
  },
});
</script>

<template>
  <USelectMenu
    v-if="searchable"
    v-model="selection"
    v-bind="$attrs"
    :items="choices"
    value-key="value"
    label-key="label"
    :disabled="disabled"
    class="choice-select min-w-0 w-full"
    :search-input="{ placeholder: 'Suchen …' }"
  />
  <USelect
    v-else
    v-model="selection"
    v-bind="$attrs"
    :items="choices"
    value-key="value"
    label-key="label"
    :disabled="disabled"
    class="choice-select min-w-0 w-full"
  />
</template>
