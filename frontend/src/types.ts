export type GeomData =
  | { type: 'box'; width?: number; height?: number; depth?: number }
  | { type: string; [k: string]: unknown };

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface HistoryPart {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  geomData: GeomData;
}
