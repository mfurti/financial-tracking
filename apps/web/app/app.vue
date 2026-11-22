<script setup lang="ts">
import { de, en_gb } from '@nuxt/ui/locale';
const { language } = useWorkspaceLocale();
const popup = provideFinancePopup();
const { background, title, revision } = popup;
</script>

<template>
  <UApp :locale="language === 'en' ? en_gb : de"
    ><NuxtLayout :key="`${language}:${amountsMasked()}`">
      <NuxtPage :key="revision" :route="background" />
      <FinanceDialog
        v-if="background"
        :open="true"
        :title="title"
        panel="page"
        @update:open="(open) => !open && popup.close()"
      >
        <NuxtPage />
      </FinanceDialog> </NuxtLayout
  ></UApp>
</template>
