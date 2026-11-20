import { tr } from '../composables/useWorkspaceLocale.js';
/** Stable contract-kind labels, symbols and palette-aware colors shared by list and analysis. */
export const contractKinds = {
  SUBSCRIPTION: {
    /** Resolve interface copy at access time after early locale restoration. */ get label() {
      return tr('Abo');
    },
    icon: 'subscription',
    color: 'var(--chart-1)',
  },
  RENT: {
    /** Resolve interface copy at access time after early locale restoration. */ get label() {
      return tr('Miete');
    },
    icon: 'home',
    color: 'var(--chart-2)',
  },
  INSURANCE: {
    /** Resolve interface copy at access time after early locale restoration. */ get label() {
      return tr('Versicherung');
    },
    icon: 'insurance',
    color: 'var(--chart-3)',
  },
  ENERGY: {
    /** Resolve interface copy at access time after early locale restoration. */ get label() {
      return tr('Energie');
    },
    icon: 'energy',
    color: 'var(--chart-4)',
  },
  TELECOM: {
    /** Resolve interface copy at access time after early locale restoration. */ get label() {
      return tr('Telefon & Internet');
    },
    icon: 'telecom',
    color: 'var(--chart-5)',
  },
  OTHER: {
    /** Resolve interface copy at access time after early locale restoration. */ get label() {
      return tr('Sonstiges');
    },
    icon: 'contracts',
    color: 'var(--chart-6)',
  },
} as const;

/** Reuse the list/analysis labels in contract creation without changing option order or transport values. */
export const contractKindOptions = Object.entries(contractKinds).map(
  /** Preserve each stable contract kind alongside its German label. */ ([value, kind]) => ({
    /** Keep cached options reactive to device language. */ get label() {
      return kind.label;
    },
    value,
  }),
);

/** Supported calendar rhythms shared by initial contracts and future payment-rule forms. */
export const contractIntervalOptions = [
  {
    /** Resolve interface copy at access time after early locale restoration. */ get label() {
      return tr('Monatlich');
    },
    value: 1,
  },
  {
    /** Resolve interface copy at access time after early locale restoration. */ get label() {
      return tr('Vierteljährlich');
    },
    value: 3,
  },
  {
    /** Resolve interface copy at access time after early locale restoration. */ get label() {
      return tr('Halbjährlich');
    },
    value: 6,
  },
  {
    /** Resolve interface copy at access time after early locale restoration. */ get label() {
      return tr('Jährlich');
    },
    value: 12,
  },
];
