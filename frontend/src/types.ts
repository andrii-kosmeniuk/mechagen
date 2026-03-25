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
  code: string;
  stl?: string;
  name?: string;
  description?: string;
  dimensions?: { x: number; y: number; z: number };
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

// ─── Pipeline Types ────────────────────────────────────────────────────────────

export type GenerationStatus =
  | 'queued'
  | 'spec_generating'
  | 'constraint_checking'
  | 'planning'
  | 'building_preview'
  | 'building_solid'
  | 'validating'
  | 'repairing'
  | 'ready'
  | 'failed';

export type ManufacturingMode = '3d_print' | 'cnc' | 'sheet_metal' | 'unknown';

export type CanonicalPartType =
  | 'bracket' | 'mounting_plate' | 'spacer' | 'enclosure'
  | 'shaft_coupler' | 'gear_basic' | 'pulley_basic' | 'bearing_block'
  | 'flange' | 'standoff' | 'clamp' | 'simple_housing';

export interface SpecJSON {
  version: '1.0';
  partType: CanonicalPartType;
  intentSummary: string;
  units: 'mm';
  manufacturingMode: ManufacturingMode;
  materialPreference: string;
  targetUse: string;
  knownDimensions: Record<string, number>;
  assumedDimensions: Record<string, number>;
  constraints: string[];
  features: string[];
  missingInformation: string[];
  riskFlags: string[];
  confidence: number;
}

export interface ConstraintReport {
  isBuildable: boolean;
  severity: 'none' | 'low' | 'medium' | 'high';
  errors: string[];
  warnings: string[];
  assumptionsUsed: string[];
  missingRequiredFields: string[];
  recommendedQuestions: string[];
  normalizedSpec: Partial<SpecJSON>;
}

export interface ValidationError {
  code: string;
  message: string;
  stepId?: string;
  suggestedFix: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  suggestedFix: string;
}

export interface ValidationReport {
  valid: boolean;
  severity: 'none' | 'low' | 'medium' | 'high';
  errors: ValidationError[];
  warnings: ValidationWarning[];
  checksRun: string[];
  repairable: boolean;
}

export interface RepairOutput {
  repairAttempt: number;
  changesApplied: string[];
  resultStatus: 'revalidated' | 'failed' | 'needs_ai';
}

export interface Generation {
  id: string;
  projectId: string;
  prompt: string;
  context?: string;
  status: GenerationStatus;
  manufacturingMode?: ManufacturingMode;
  materialPreference?: string;
  highDetail: boolean;
  specJson?: SpecJSON;
  constraintReport?: ConstraintReport;
  geometryPlan?: Record<string, unknown>;
  validationReport?: ValidationReport;
  repairHistory?: RepairOutput[];
  buildMetadata?: Record<string, unknown>;
  previewParts?: GeomPart[];
  stlBase64?: string;
  errorContext?: string;
  createdAt: string;
  updatedAt: string;
}

