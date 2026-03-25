// ─── Generation Status ────────────────────────────────────────────────────────

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

// ─── Manufacturing Mode ───────────────────────────────────────────────────────

export type ManufacturingMode = '3d_print' | 'cnc' | 'sheet_metal' | 'unknown';

// ─── Canonical Part Types ─────────────────────────────────────────────────────

export type CanonicalPartType =
  | 'bracket'
  | 'mounting_plate'
  | 'spacer'
  | 'enclosure'
  | 'shaft_coupler'
  | 'gear_basic'
  | 'pulley_basic'
  | 'bearing_block'
  | 'flange'
  | 'standoff'
  | 'clamp'
  | 'simple_housing';

export const CANONICAL_PART_TYPES: CanonicalPartType[] = [
  'bracket',
  'mounting_plate',
  'spacer',
  'enclosure',
  'shaft_coupler',
  'gear_basic',
  'pulley_basic',
  'bearing_block',
  'flange',
  'standoff',
  'clamp',
  'simple_housing',
];

// ─── Allowed Geometry Actions ─────────────────────────────────────────────────

export type GeometryAction =
  | 'create_box'
  | 'create_cylinder'
  | 'create_plate'
  | 'create_shell'
  | 'create_rib'
  | 'create_flange'
  | 'create_hole_pattern'
  | 'create_slot'
  | 'extrude_profile'
  | 'subtract_feature'
  | 'fillet_edges'
  | 'chamfer_edges'
  | 'mirror_feature'
  | 'join_perpendicular'
  | 'add_mounting_points'
  | 'add_standoff'
  | 'create_basic_gear'
  | 'create_basic_pulley';

export const ALLOWED_GEOMETRY_ACTIONS: GeometryAction[] = [
  'create_box',
  'create_cylinder',
  'create_plate',
  'create_shell',
  'create_rib',
  'create_flange',
  'create_hole_pattern',
  'create_slot',
  'extrude_profile',
  'subtract_feature',
  'fillet_edges',
  'chamfer_edges',
  'mirror_feature',
  'join_perpendicular',
  'add_mounting_points',
  'add_standoff',
  'create_basic_gear',
  'create_basic_pulley',
];

// ─── Pipeline Input ───────────────────────────────────────────────────────────

export interface GenerationInput {
  prompt: string;
  context?: string;
  image?: string;
  projectName?: string;
  manufacturingMode?: ManufacturingMode;
  materialPreference?: string;
  highDetail?: boolean;
}

// ─── Spec JSON Schema ─────────────────────────────────────────────────────────

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
  confidence: number; // 0–1
}

// ─── Constraint Report ────────────────────────────────────────────────────────

export type ConstraintSeverity = 'none' | 'low' | 'medium' | 'high';

export interface ConstraintReport {
  isBuildable: boolean;
  severity: ConstraintSeverity;
  errors: string[];
  warnings: string[];
  assumptionsUsed: string[];
  missingRequiredFields: string[];
  recommendedQuestions: string[];
  normalizedSpec: Partial<SpecJSON>;
}

// ─── Geometry Plan ────────────────────────────────────────────────────────────

export interface GeometryBuildStep {
  id: string;
  action: GeometryAction;
  params: Record<string, number | string | Array<{ x: number; y: number; face: string }>>;
}

export interface GeometryPlan {
  version: '1.0';
  partType: CanonicalPartType;
  coordinateSystem: 'right_handed_z_up';
  buildSteps: GeometryBuildStep[];
  boundingBox: { x: number; y: number; z: number };
  criticalDimensions: string[];
  expectedManufacturingChecks: string[];
}

// ─── Validation Report ────────────────────────────────────────────────────────

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
  severity: ConstraintSeverity;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  checksRun: string[];
  repairable: boolean;
}

// ─── Repair ───────────────────────────────────────────────────────────────────

export interface RepairIssue {
  code: string;
  message: string;
  stepId?: string;
  suggestedFix: string;
}

export interface RepairRequest {
  generationId: string;
  failureStage: string;
  issues: RepairIssue[];
  latestSpec: SpecJSON;
  latestGeometryPlan: GeometryPlan;
}

export interface RepairOutput {
  repairAttempt: number;
  changesApplied: string[];
  resultStatus: 'revalidated' | 'failed' | 'needs_ai';
  updatedGeometryPlan?: GeometryPlan;
}

// ─── Preview Part (for Three.js viewport) ────────────────────────────────────

export interface PreviewPart {
  shape: 'box' | 'cylinder' | 'sphere' | 'torus' | 'cone';
  params: Record<string, number>;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  color: string;
  metalness: number;
  roughness: number;
  label: string;
}

// ─── Generation Record ────────────────────────────────────────────────────────

export interface Generation {
  id: string;
  projectId: string;
  prompt: string;
  context?: string;
  imageUrl?: string;
  status: GenerationStatus;
  manufacturingMode?: ManufacturingMode;
  materialPreference?: string;
  highDetail: boolean;
  specJson?: SpecJSON;
  constraintReport?: ConstraintReport;
  geometryPlan?: GeometryPlan;
  validationReport?: ValidationReport;
  repairHistory?: RepairOutput[];
  buildMetadata?: Record<string, unknown>;
  previewParts?: PreviewPart[];
  stlBase64?: string;
  errorContext?: string;
  createdAt: string;
  updatedAt: string;
}
