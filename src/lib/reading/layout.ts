export const LAYOUTS = ['compact', 'comfortable', 'cards'] as const;
export type Layout = (typeof LAYOUTS)[number];

export const parseLayout = (raw: unknown): Layout =>
  LAYOUTS.find((layout) => layout === raw) ?? 'comfortable';
