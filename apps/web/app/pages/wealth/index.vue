<template>
  <div class="page-heading">
    <h1>{{ tr('Vermögen') }}</h1>
    <UButton to="/accounts" variant="soft">{{ tr('Quellkonten verwalten') }}</UButton>
  </div>
  <div class="wealth-layout">
    <RecordedWealth />
    <aside :aria-label="tr('Reserve-Einstellungen')"><ReserveGoalTile /></aside>
  </div>
  <DemoPortfolio />
</template>

<style scoped>
.wealth-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.wealth-layout > * {
  min-width: 0;
}
@media (max-width: 1100px) {
  .wealth-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}
</style>
