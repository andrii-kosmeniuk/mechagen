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

export type TransformState = {
  translate: { x: string; y: string; z: string };
  orient: { x: string; y: string; z: string };
  scale: { x: string; y: string; z: string };
};

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
  blueprintId?: string;
  blueprintAnalysis?: BlueprintAnalysis;
  specJson?: SpecJSON;
  constraintReport?: ConstraintReport;
  geometryPlan?: Record<string, unknown>;
  validationReport?: ValidationReport;
  repairHistory?: RepairOutput[];
  buildMetadata?: Record<string, unknown>;
  previewParts?: GeomPart[];
  stlBase64?: string;
  errorContext?: string;
  // Phase 3
  solidRequested?: boolean;
  solidStatus?: SolidStatus | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Phase 2: Blueprint ────────────────────────────────────────────────────────

export type BlueprintAnalysis = {
  version?: string;
  detectedPartType: string;
  observedDimensions: Record<string, number>;
  observedFeatures: string[];
  visibleHoleCount: number;
  symmetryHints: string[];
  manufacturingHints: string[];
  textReadFromBlueprint: string[];
  confidence: number;
  uncertainties: string[];
  analysisSource?: string;
};

export type BlueprintRecord = {
  id: string;
  projectId: string;
  generationId: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  previewable: boolean;
  analysisJson: BlueprintAnalysis | null;
  createdAt: string;
};

// ─── Phase 2: Export ──────────────────────────────────────────────────────────

export type ExportRecord = {
  id: string;
  generationId: string;
  type: 'obj' | 'glb';
  fileName: string;
  fileUrl: string;
  fileSize: number;
  status: 'ready' | 'failed';
  createdAt: string;
};

export type ExportReadiness = {
  canExport: boolean;
  reason: string | null;
  formats: string[];
  exports: ExportRecord[];
};

// ─── Phase 2: History ─────────────────────────────────────────────────────────

export type ProjectHistory = {
  projectId: string;
  generations: Generation[];
  blueprints: BlueprintRecord[];
  exports: ExportRecord[];
  totalGenerations: number;
  totalBlueprints: number;
  totalExports: number;
};

export type TimelineEvent = {
  stage: string;
  timestamp: string;
  [key: string]: unknown;
};

export type GenerationTimeline = {
  generationId: string;
  status: string;
  prompt: string;
  events: TimelineEvent[];
};

// ─── Phase 3: Solid Generation ───────────────────────────────────────────────

export type SolidStatus =
  | 'translating_solid'
  | 'building_solid'
  | 'solid_validating'
  | 'solid_ready'
  | 'solid_failed';

export type SolidValidationCheck = {
  id: string;
  passed: boolean;
  detail: string;
};

export type SolidBuildResult = {
  id: string;
  status: SolidStatus | 'not_started';
  generationId: string;
  executionTimeMs: number | null;
  stlFileUrl: string | null;
  stlFileSizeBytes: number | null;
  meshCheck: { triangleCount: number; valid: boolean } | null;
  errorReason: string | null;
  validationJson: { solidValid: boolean; checks: SolidValidationCheck[] } | null;
  createdAt: string;
  updatedAt: string;
};

// ─── Phase 4: Billing, Usage, Workspace ──────────────────────────────────────

export type PlanCode = 'free' | 'pro' | 'team' | 'admin';

export type PlanFeatures = {
  blueprintUpload:    boolean;
  solidBuild:         boolean;
  exportObj:          boolean;
  exportGlb:          boolean;
  exportStl:          boolean;
  prioritySolidBuild: boolean;
  teamWorkspace:      boolean;
  adminAccess:        boolean;
};

export type Plan = {
  code:                    PlanCode;
  name:                    string;
  monthlyGenerationLimit:  number;
  monthlyBlueprintLimit:   number;
  monthlySolidBuildLimit:  number;
  monthlyExportLimit:      number;
  creditsPerMonth:          number;
  workspaceMembers:         number;
  features:                 PlanFeatures;
};

export type Subscription = {
  id:                  string;
  userId:              string;
  planCode:            PlanCode;
  status:              'active' | 'canceled' | 'past_due';
  currentPeriodStart:  string;
  currentPeriodEnd:    string;
  createdAt:           string;
  updatedAt:           string;
};

export type UsageThisMonth = {
  generation:         number;
  blueprint_upload:   number;
  blueprint_analysis: number;
  solid_build:        number;
  export_obj:         number;
  export_glb:         number;
  export_stl:         number;
  totalExports:       number;
  month:              string;
};

export type QuotaStatus = {
  used:  number;
  limit: number;
};

export type UsageResponse = {
  userId:    string;
  planCode:  PlanCode;
  plan:      { name: string; monthlyGenerationLimit: number; monthlyBlueprintLimit: number; monthlySolidBuildLimit: number; monthlyExportLimit: number };
  usage:     UsageThisMonth;
  credits:   { balance: number; maxBalance: number; month: string };
  quotas:    { generation: QuotaStatus; blueprint: QuotaStatus; solid_build: QuotaStatus; export: QuotaStatus };
};

export type WorkspaceMemberRole = 'viewer' | 'member' | 'admin' | 'owner';

export type WorkspaceMember = {
  userId:      string;
  role:        WorkspaceMemberRole;
  joinedAt:    string;
  workspaceId: string;
};

export type Workspace = {
  id:          string;
  name:        string;
  description: string;
  ownerUserId: string;
  createdAt:   string;
  updatedAt:   string;
};

// ─── Phase 5: Launch Readiness Types ─────────────────────────────────────────

export type OnboardingStep =
  | 'welcome' | 'choose_use_case' | 'explain_workflow'
  | 'first_project' | 'first_generation' | 'reach_result'
  | 'next_steps' | 'done';

export type OnboardingState = {
  id:             string;
  userId:         string;
  startedAt:      string;
  completedAt:    string | null;
  currentStep:    OnboardingStep;
  stepIndex:      number;
  stepsCompleted: OnboardingStep[];
  skipped:        boolean;
  updatedAt:      string;
};

export type AnalyticsEvent = {
  id:        string;
  userId:    string | null;
  sessionId: string | null;
  eventName: string;
  page:      string | null;
  metadata:  Record<string, unknown>;
  createdAt: string;
};

export type WaitlistEntry = {
  id:        string;
  email:     string;
  name:      string | null;
  company:   string | null;
  useCase:   string | null;
  source:    string | null;
  status:    string;
  createdAt: string;
};

export type FeedbackCategory =
  | 'bug' | 'feature_request' | 'usability'
  | 'generation_quality' | 'export_issue' | 'billing_issue' | 'other';

export type FeedbackEntry = {
  id:           string;
  userId:       string | null;
  projectId:    string | null;
  generationId: string | null;
  category:     FeedbackCategory;
  message:      string;
  metadata:     Record<string, unknown>;
  status:       'open' | 'in_review' | 'resolved' | 'wont_fix';
  createdAt:    string;
  updatedAt:    string;
};

export type DemoProject = {
  id:          string;
  name:        string;
  description: string;
  userId:      'demo-user';
  _isDemo:     true;
};

export type LaunchSummary = {
  timestamp:  string;
  analytics:  { totalEvents: number; uniqueEventNames: number; totals: Record<string, number>; last24hCount: number };
  waitlist:   { total: number; recentEntries: WaitlistEntry[] };
  feedback:   { total: number; openCount: number; byCategory: Record<string, number> };
  onboarding: { started: number; completed: number; completionRate: number };
  demo:       { totalLoads: number };
};
