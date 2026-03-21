export interface GeomPart {
  shape: 'box' | 'cylinder' | 'sphere' | 'torus' | 'cone' | string;
  params: Record<string, number>;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  color?: string;
  metalness?: number;
  roughness?: number;
  label?: string;
}

export interface GeomData {
  code: string;   // Raw JSCAD or CadQuery source (for display / JSCAD path)
  /** Base64 STL from CadQuery when the backend used the Python runner */
  stl?: string;
  name?: string;
  /** AI procedural JSON summary (optional) */
  description?: string;
  /** Approximate bounding size in mm from AI (JSON parts mode) */
  dimensions?: { x: number; y: number; z: number };
  /** AI procedural JSON primitives — rendered directly in the viewport when present */
  parts?: GeomPart[];
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
