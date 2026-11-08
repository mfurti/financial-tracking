/** Stable contract-kind labels, symbols and palette-aware colors shared by list and analysis. */
export const contractKinds = {
  SUBSCRIPTION: { label: 'Abo', icon: 'subscription', color: 'var(--chart-1)' },
  RENT: { label: 'Miete', icon: 'home', color: 'var(--chart-2)' },
  INSURANCE: { label: 'Versicherung', icon: 'insurance', color: 'var(--chart-3)' },
  ENERGY: { label: 'Energie', icon: 'energy', color: 'var(--chart-4)' },
  TELECOM: { label: 'Telefon & Internet', icon: 'telecom', color: 'var(--chart-5)' },
  OTHER: { label: 'Sonstiges', icon: 'contracts', color: 'var(--chart-6)' },
} as const;
