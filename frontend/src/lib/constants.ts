export const WORKFLOW_COLORS = {
  draft: '#888888',
  in_review: '#f7a83a',
  changes_requested: '#f77a7a',
  approved: '#5ab85a',
  released: '#7eb8f7',
} as const;

export const MATERIALS_DB: Record<
  string,
  { density: number; costPerKg: number; name: string }
> = {
  steel: { density: 7.85, costPerKg: 2.5, name: 'Stainless Steel 316L' },
  aluminum: { density: 2.7, costPerKg: 5.0, name: 'Aluminum 6061-T6' },
  titanium: { density: 4.43, costPerKg: 35.0, name: 'Titanium Grade 5' },
  abs: { density: 1.04, costPerKg: 3.0, name: 'ABS Plastic' },
  carbon: { density: 1.6, costPerKg: 45.0, name: 'Carbon Fiber Reinforced' },
};
