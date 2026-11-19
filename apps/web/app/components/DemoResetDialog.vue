<script setup lang="ts">
const { status, saving, error, reset } = useDemoPortfolio();
const open = ref(false),
  notice = ref('');
/** Replace only confirmed dedicated demo state; errors keep the dialog open. */
async function confirm() {
  if (await reset(true)) {
    open.value = false;
    notice.value = 'Demo zurückgesetzt. Echte Konten, Aufzeichnungen und Einstellungen bleiben erhalten.';
  }
}
</script>
<template>
  <div class="demo-reset">
    <FinanceDialog
      v-model:open="open"
      title="Demo zurücksetzen"
      description="Nur die fiktiven Daten auf diesem Gerät werden durch den Demo-Anfangszustand ersetzt."
      :dismissible="!saving"
    >
      <template #trigger
        ><UButton variant="ghost" :disabled="saving || status === 'conflict'" @click="error = ''"
          >Demo zurücksetzen</UButton
        ></template
      >
      <p>
        Demo-Konten, Aufträge, Sparpläne, Verlauf und lokale Demo-Rollen werden zurückgesetzt. Echte Konten,
        aufgezeichnetes Vermögen, Profil und Geräteeinstellungen bleiben erhalten.
      </p>
      <p v-if="status === 'corrupt' || status === 'unsupported'">
        Der bisherige beschädigte oder nicht unterstützte Demo-Speicher wird erst nach dieser Bestätigung ersetzt.
      </p>
      <p v-if="error" role="alert">{{ error }}</p>
      <template #footer
        ><UButton variant="ghost" :disabled="saving" @click="open = false">Abbrechen</UButton
        ><UButton :disabled="saving" :loading="saving" @click="confirm">Nur Demo-Daten zurücksetzen</UButton></template
      >
    </FinanceDialog>
    <p v-if="notice" role="status">{{ notice }}</p>
  </div>
</template>
