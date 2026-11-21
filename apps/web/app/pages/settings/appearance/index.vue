<template>
  <UButton to="/settings" variant="link">{{ tr('Zurück zu Einstellungen') }}</UButton>
  <div class="page-heading">
    <h1>{{ tr('Darstellung') }}</h1>
  </div>
  <p class="appearance-scope">
    {{
      tr(
        'Farben und Helligkeit gelten auf diesem Gerät. Hell/Dunkel und die vorhandenen Ayu-Varianten bleiben unabhängig vom Eigentümerprofil.',
      )
    }}
  </p>
  <AppearanceSettings />
</template>
<style scoped>
.appearance-scope {
  margin-bottom: 24px;
  max-width: 80ch;
}
</style>
