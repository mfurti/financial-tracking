<template>
  <UButton to="/settings" variant="link">Zurück zu Einstellungen</UButton>
  <div class="page-heading"><h1>Darstellung</h1></div>
  <p class="appearance-scope">
    Farben und Helligkeit gelten auf diesem Gerät. Hell/Dunkel und die vorhandenen Ayu-Varianten bleiben unabhängig vom
    Eigentümerprofil.
  </p>
  <AppearanceSettings />
</template>
<style scoped>
.appearance-scope {
  margin-bottom: 24px;
  max-width: 80ch;
}
</style>
