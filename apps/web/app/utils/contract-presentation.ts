/** Stable contract-kind labels, symbols and palette-aware colors shared by list and analysis. */
export const contractKinds = {
  SUBSCRIPTION: { label: 'Abo', icon: 'subscription', color: 'var(--chart-1)' },
  RENT: { label: 'Miete', icon: 'home', color: 'var(--chart-2)' },
  INSURANCE: { label: 'Versicherung', icon: 'insurance', color: 'var(--chart-3)' },
  ENERGY: { label: 'Energie', icon: 'energy', color: 'var(--chart-4)' },
  TELECOM: { label: 'Telefon & Internet', icon: 'telecom', color: 'var(--chart-5)' },
  OTHER: { label: 'Sonstiges', icon: 'contracts', color: 'var(--chart-6)' },
} as const;

/** Reuse the list/analysis labels in contract creation without changing option order or transport values. */
export const contractKindOptions = Object.entries(contractKinds).map(
  /** Preserve each stable contract kind alongside its German label. */ ([value, { label }]) => ({ label, value }),
);

/** Supported calendar rhythms shared by initial contracts and future payment-rule forms. */
export const contractIntervalOptions = [
  { label: 'Monatlich', value: 1 },
  { label: 'Vierteljährlich', value: 3 },
  { label: 'Halbjährlich', value: 6 },
  { label: 'Jährlich', value: 12 },
];
