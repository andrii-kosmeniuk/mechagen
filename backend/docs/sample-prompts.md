# MechaGen — Sample Prompts for Manual Testing

Use these prompts to test the core AI generation pipeline end-to-end.
Each prompt is designed to exercise a specific part-type and pipeline path.

---

## Quick local test setup

```bash
cd backend
cp .env.example .env.local
# Set your NVIDIA_API_KEY in .env.local
npm run dev               # → http://127.0.0.1:3001

# Separate terminal
cd frontend
npm run dev               # → http://localhost:5173
```

Verify backend is up:
```bash
curl http://127.0.0.1:3001/api/health
# → {"status":"ok","version":"phase5",...}
```

---

## Generate via API (no frontend)

```bash
# Start a generation
curl -s -X POST http://127.0.0.1:3001/api/pipeline/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Simple wall-mount bracket with two M5 bolt holes"}' | jq .
# → {"jobId": "gen_17...", "status": "queued"}

# Poll until ready
curl -s http://127.0.0.1:3001/api/generations/<JOB_ID> | jq .status
```

---

## Canonical test prompts

### 1. Bracket (simplest — good baseline)
```
Simple L-bracket for wall mounting, 50mm × 30mm, 5mm thick, two M5 bolt holes
```
Expected: partType=bracket, 3d_print, confidence > 0.8

### 2. Bracket with material
```
Aluminum CNC bracket, 80mm wide, 40mm tall, 6mm thick, four M4 countersunk holes at corners
```
Expected: partType=bracket, cnc, materialPreference=aluminum

### 3. Shaft (rotation axis)
```
Steel drive shaft, 200mm long, 20mm diameter, with M8 keyway at each end
```
Expected: partType=shaft, manufacturingMode=cnc

### 4. Flange (bolt circle)
```
Circular pipe flange, 120mm outer diameter, 80mm bore, 8mm thick, 6 bolt holes on 100mm PCD
```
Expected: partType=flange, bolt hole pattern in plan

### 5. Gear (teeth test)
```
Spur gear, 24 teeth, module 2, 20mm face width, 10mm bore, steel
```
Expected: partType=spur_gear, confidence > 0.75, gear-specific plan steps

### 6. Housing (enclosure)
```
Rectangular electronics enclosure, 100mm × 60mm × 40mm, 3mm wall, lid with 4 screw bosses
```
Expected: partType=housing, 3d_print

### 7. Plate (simple flat part)
```
Mounting plate, 200mm × 150mm, 8mm thick aluminum, 6mm grid of M5 threaded holes
```
Expected: partType=plate, cnc

### 8. Bushing (cylindrical insert)
```
Bronze bushing, 30mm OD, 20mm ID, 25mm long, with oil groove
```
Expected: partType=bushing, cnc, materialPreference=bronze

### 9. Base plate (machine tool base)
```
Cast iron machine base plate, 300mm × 200mm × 20mm, T-slots along length, 4 tapped M10 holes at corners
```
Expected: partType=base_plate or plate, cnc

### 10. Constraint failure case
```
Ball bearing, 1mm inner diameter, 0.5mm outer diameter
```
Expected: status=failed, errorContext contains constraint error (inner > outer)

---

## Pipeline status sequence to verify

After submitting a prompt, the generation status should transition through:
```
queued
→ spec_generating         (AI call 1: prompt → SpecV1 JSON)
→ constraint_checking     (deterministic: validate spec feasibility)
→ planning                (AI call 2: spec → GeometryPlanV1 JSON)
→ building_preview        (deterministic: plan → preview parts)
→ validating              (deterministic: validate geometry plan)
→ [repairing]             (deterministic: fix wall thickness, holes, etc.)
→ ready                   (all outputs persisted)
```

On failure at any stage: `status=failed`, `errorContext` explains why.

---

## Result fields to verify when status=ready

```bash
curl -s http://127.0.0.1:3001/api/generations/<JOB_ID> | jq '{
  status,
  partType: .specJson.partType,
  confidence: .specJson.confidence,
  planSteps: (.geometryPlan.buildSteps | length),
  previewParts: (.previewParts | length),
  validationPassed: .validationReport.valid,
  repairAttempts: (.repairHistory | length),
  durationMs: .buildMetadata.totalDurationMs
}'
```

Expected output (example):
```json
{
  "status": "ready",
  "partType": "bracket",
  "confidence": 0.9,
  "planSteps": 3,
  "previewParts": 2,
  "validationPassed": true,
  "repairAttempts": 0,
  "durationMs": 45000
}
```

---

## History / reload

```bash
# List all past generations
curl -s http://127.0.0.1:3001/api/history | jq '[.[] | {id, status, prompt: .prompt[:40]}]'

# Reload a specific generation
curl -s http://127.0.0.1:3001/api/generations/<JOB_ID> | jq .status
```

---

## Export (after ready)

```bash
# Check available formats
curl -s http://127.0.0.1:3001/api/generations/<JOB_ID>/export/status

# Download OBJ
curl -O http://127.0.0.1:3001/api/generations/<JOB_ID>/export/obj
```

---

## AI not configured (expected error)

Without `NVIDIA_API_KEY` set:
```bash
curl -s -X POST http://127.0.0.1:3001/api/pipeline/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "bracket"}' | jq .
```
Expected:
```json
{
  "status": "failed",
  "errorContext": "AI provider not configured. Set NVIDIA_API_KEY..."
}
```
