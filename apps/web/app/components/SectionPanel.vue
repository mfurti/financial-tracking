<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    help?: string;
    icon?: 'accounts' | 'transactions' | 'categories' | 'contracts' | 'history' | 'settings' | 'calendar';
    compact?: boolean;
    bare?: boolean;
  }>(),
  { help: undefined, icon: undefined, compact: false, bare: false },
);
const headingId = useId();
</script>

<template>
  <section class="section-block" :class="{ 'section-block--compact': compact }" :aria-labelledby="headingId">
    <header class="section-heading">
      <h2 :id="headingId"><FinanceIcon v-if="icon" :name="icon" />{{ title }}</h2>
      <div class="section-actions"><slot name="actions" /><HelpPopover v-if="help" :title="title" :text="help" /></div>
    </header>
    <slot v-if="bare" />
    <UCard v-else class="panel" :ui="{ body: 'p-0 sm:p-0', root: 'overflow-visible' }"><slot /></UCard>
  </section>
</template>
