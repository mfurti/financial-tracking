<script setup lang="ts">
import { de, en_gb } from '@nuxt/ui/locale';
const { language } = useWorkspaceLocale();
</script>

<template>
  <UApp :locale="language === 'en' ? en_gb : de"
    ><NuxtLayout :key="`${language}:${amountsMasked()}`"><NuxtPage /></NuxtLayout
  ></UApp>
</template>
