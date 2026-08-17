/** Minimal dark-first design tokens shared across screens. */
export const theme = {
  bg: "#0B1220",
  surface: "#131C2E",
  surfaceAlt: "#1B2740",
  border: "#243149",
  text: "#E8EDF6",
  textMuted: "#8A97AD",
  primary: "#4F86F7",
  positive: "#33C58A",
  negative: "#F2637E",
  warn: "#E9B84A",
  radius: 12,
  space: (n: number) => n * 4,
};

export const statusColor: Record<string, string> = {
  uncleared: theme.textMuted,
  cleared: theme.primary,
  reconciled: theme.positive,
};
