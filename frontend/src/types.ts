export interface GeomPart {
  shape: 'box' | 'cylinder' | 'sphere' | 'torus' | 'cone' | string;
  params: Record<string, number>;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  color: string;
  metalness: number;
  roughness: number;
  label: string;
}

export interface GeomData {
  code: string;   // Raw JSCAD JavaScript returned by the AI
  name?: string;
}

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
