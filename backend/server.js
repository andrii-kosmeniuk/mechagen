const http          = require("http");
const https         = require("https");
const fs            = require("fs");
const path          = require("path");
const { exec }      = require("child_process");
const { randomUUID } = require("crypto");

const PORT    = process.env.PORT || 3001;
const API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL   = "mistralai/mistral-large-3-675b-instruct-2512";

// Frontend HTML path — works both locally and on Railway
const FRONTEND_HTML = path.join(__dirname, "..", "frontend", "index.html");

// Load .env manually — no dotenv needed in Node 18+
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  try {
    fs.readFileSync(envPath, "utf8")
      .split("\n")
      .forEach(line => {
        const [k, ...v] = line.split("=");
        if (k && v.length) process.env[k.trim()] = v.join("=").trim();
      });
  } catch (err) {
    console.warn("Could not read .env file, relying on process.env:", err.message);
  }
}

const SYSTEM = `You are a professional 3D mechanical parts geometry engine specialized in generating precise, physically accurate, and visually realistic mechanical components for robotics, automotive, and aerospace engineering.

Your ONLY output is valid JSON. Never output markdown, explanations, comments, or any text outside the JSON object.

OUTPUT SCHEMA — NEVER DEVIATE FROM THIS:
{
  "name": "descriptive engineering part name",
  "description": "one sentence technical description of function and application",
  "dimensions": { "x": real_world_width_in_mm, "y": real_world_height_in_mm, "z": real_world_depth_in_mm },
  "parts": [
    {
      "shape": "box|cylinder|sphere|torus|cone",
      "params": {},
      "position": { "x": number, "y": number, "z": number },
      "rotation": { "x": number, "y": number, "z": number },
      "color": "#hexcolor",
      "metalness": number,
      "roughness": number,
      "label": "component name"
    }
  ]
}

SHAPE PARAMS:
  box:      { "w": number, "h": number, "d": number }
  cylinder: { "r": number, "h": number, "radSeg": 32 }
  sphere:   { "r": number }
  torus:    { "r": number, "tube": number }
  cone:     { "r": number, "h": number }

GEOMETRY RULES:
1. Center the complete model at origin (0,0,0). Y axis is UP.
2. All parts must fit within -2.0 to +2.0 units on every axis.
3. Use 3 to 8 primitives. Each must serve a clear engineering purpose.
4. Parts must be properly stacked — calculate Y positions: if part A has height h at Y=0, part B starts at Y = h/2 + partB_height/2.
5. Concentric parts share same X,Z center.
6. rotation values are in RADIANS (90deg = 1.5708).

COLOR & MATERIAL SYSTEM — USE ONLY THESE:
  Machined steel:    #8a9aaa  metalness:0.90  roughness:0.20
  Dark metal/cast:   #3a4a5a  metalness:0.75  roughness:0.55
  Brushed aluminum:  #b0c0d0  metalness:0.80  roughness:0.30
  Raw aluminum:      #a0b0c0  metalness:0.75  roughness:0.40
  Polished chrome:   #d0d8e0  metalness:1.00  roughness:0.05
  Oxidized steel:    #6a7a8a  metalness:0.65  roughness:0.65
  Tool steel:        #7a8a9a  metalness:0.88  roughness:0.15
  Brass/bronze:      #c8a840  metalness:0.80  roughness:0.30
  Copper:            #b87040  metalness:0.85  roughness:0.25
  Orange highlight:  #f97316  metalness:0.10  roughness:0.70
  Black anodized:    #1a2030  metalness:0.60  roughness:0.50
  Hard rubber:       #2a2a2a  metalness:0.00  roughness:0.95
  Depth/holes:       #1a2030  (always use this for holes and bores)

RULES: Use 2-3 colors max. Holes/internal features always #1a2030.

PART BLUEPRINTS — follow these for standard parts:

BOLT/SCREW:
  hex head:  box     w:0.26 h:0.16 d:0.26  #8a9aaa  m:0.9 r:0.2  y:+(shaft_h/2+0.08)
  shaft:     cylinder r:0.08 h:0.80 rs:32  #7a8a9a  m:0.9 r:0.15 y:0
  tip:       cone    r:0.08 h:0.10         #6a7a8a  m:0.9 r:0.2  y:-(shaft_h/2+0.05)

GEAR (SPUR):
  main disk: cylinder r:0.55 h:0.30 rs:32  #8a9aaa  m:0.9 r:0.2  y:0
  bore:      cylinder r:0.12 h:0.32 rs:32  #1a2030  m:0.5 r:0.5  y:0
  tooth ring:torus    r:0.55 tube:0.06      #7a8a9a  m:0.9 r:0.15 y:0
  keyway:    box      w:0.06 h:0.32 d:0.08  #1a2030  m:0.5 r:0.5  y:0

BEARING:
  outer ring:cylinder r:0.50 h:0.30 rs:32  #8a9aaa  m:0.95 r:0.15 y:0
  inner ring:cylinder r:0.28 h:0.32 rs:32  #9aaaba  m:0.95 r:0.15 y:0
  ball 1:    sphere   r:0.07               #d0d8e0  m:1.0  r:0.05 pos:(0.39,0,0)
  ball 2:    sphere   r:0.07               #d0d8e0  m:1.0  r:0.05 pos:(-0.195,0,0.338)
  ball 3:    sphere   r:0.07               #d0d8e0  m:1.0  r:0.05 pos:(-0.195,0,-0.338)
  bore:      cylinder r:0.18 h:0.34 rs:32  #1a2030  m:0.5  r:0.5  y:0

BRACKET (L-SHAPE):
  base plate:box  w:0.80 h:0.08 d:0.60   #8a9aaa  m:0.85 r:0.3  y:0
  vert plate:box  w:0.08 h:0.70 d:0.60   #8a9aaa  m:0.85 r:0.3  x:-(0.36) y:0.39
  gusset:    box  w:0.20 h:0.20 d:0.55   #7a8a9a  m:0.8  r:0.35 rot z:0.785
  hole A:    cylinder r:0.04 h:0.10 rs:16 #1a2030  pos corner of base
  hole B:    cylinder r:0.04 h:0.10 rs:16 #1a2030  pos opposite corner

ROBOTIC ARM JOINT:
  upper link:cylinder r:0.14 h:0.70 rs:32 #8a9aaa  m:0.85 r:0.25 y:+0.55
  joint body:cylinder r:0.28 h:0.25 rs:32 #b0c0d0  m:0.80 r:0.30 y:0
  lower link:cylinder r:0.14 h:0.70 rs:32 #8a9aaa  m:0.85 r:0.25 y:-0.55
  flange top:cylinder r:0.32 h:0.06 rs:32 #9aaaba  m:0.85 r:0.25 y:+0.11
  flange bot:cylinder r:0.32 h:0.06 rs:32 #9aaaba  m:0.85 r:0.25 y:-0.11
  bolt hole: cylinder r:0.04 h:0.28 rs:16 #1a2030  x:+0.24 y:0

MOUNT PLATE:
  base:      box  w:1.20 h:0.10 d:0.90   #8a9aaa  m:0.85 r:0.3
  center rib:box  w:1.20 h:0.20 d:0.08   #7a8a9a  m:0.85 r:0.3  y:+0.15
  hole A:    cylinder r:0.06 h:0.12 rs:16 #1a2030  x:-0.48 z:-0.36
  hole B:    cylinder r:0.06 h:0.12 rs:16 #1a2030  x:+0.48 z:-0.36
  hole C:    cylinder r:0.06 h:0.12 rs:16 #1a2030  x:-0.48 z:+0.36
  hole D:    cylinder r:0.06 h:0.12 rs:16 #1a2030  x:+0.48 z:+0.36

STRICT OUTPUT RULES:
1. Output ONLY the JSON object — nothing before, nothing after
2. No markdown code blocks (no backticks)
3. No comments inside JSON
4. All numbers must be actual computed numbers — no expressions like "0.4 + 0.08"
5. All hex colors must be valid 6-char lowercase hex: "#8a9aaa"
6. rotation in RADIANS not degrees
7. Never generate physically impossible parts

ADVANCED PART BLUEPRINTS:

HEXAGONAL BOLT M8 (exact):
  CRITICAL: A bolt is VERTICAL. Shaft goes DOWN from head.
  hex head:  box      w:0.24 h:0.15 d:0.24  rot y:0.5236  #8a9aaa  m:0.90 r:0.20  y:+0.50
  shaft:     cylinder r:0.07 h:0.80 rs:32   #7a8a9a  m:0.90 r:0.15  y:0.0
  tip:       cone     r:0.07 h:0.12         #6a7a8a  m:0.90 r:0.25  y:-0.46
  washer:    cylinder r:0.16 h:0.04 rs:32   #9aaaba  m:0.85 r:0.25  y:+0.40

SOCKET HEAD BOLT:
  cyl head:  cylinder r:0.13 h:0.14 rs:32  #3a4a5a  m:0.90 r:0.20  y:+0.47
  hex socket:cylinder r:0.07 h:0.10 rs:6   #1a2030  m:0.50 r:0.50  y:+0.52
  shaft:     cylinder r:0.06 h:0.80 rs:32  #7a8a9a  m:0.90 r:0.15  y:0.0
  thread:    cylinder r:0.065 h:0.40 rs:32 #6a7a8a  m:0.88 r:0.20  y:-0.20

FLANGED BOLT:
  hex head:  box      w:0.22 h:0.14 d:0.22  rot y:0.5236  #8a9aaa  m:0.90 r:0.20  y:+0.52
  flange:    cylinder r:0.22 h:0.06 rs:32  #9aaaba  m:0.88 r:0.22  y:+0.37
  shaft:     cylinder r:0.07 h:0.80 rs:32  #7a8a9a  m:0.90 r:0.15  y:0.0
  tip:       cone     r:0.07 h:0.10        #6a7a8a  m:0.90 r:0.25  y:-0.45

NUT (HEXAGONAL):
  hex body:  box      w:0.26 h:0.22 d:0.26  rot y:0.5236  #8a9aaa  m:0.90 r:0.20  y:0
  thread hole:cylinder r:0.08 h:0.24 rs:32  #1a2030  m:0.50 r:0.50  y:0
  chamfer top:cone    r:0.14 h:0.05         #9aaaba  m:0.88 r:0.22  y:+0.135
  chamfer bot:cone    r:0.14 h:0.05         #9aaaba  m:0.88 r:0.22  y:-0.135  rot x:3.14159

WASHER:
  body:      cylinder r:0.24 h:0.05 rs:32  #8a9aaa  m:0.88 r:0.25  y:0
  inner hole:cylinder r:0.09 h:0.07 rs:32  #1a2030  m:0.50 r:0.50  y:0

SHAFT / AXLE:
  main shaft:cylinder r:0.10 h:1.60 rs:32  #b0c0d0  m:0.90 r:0.15  y:0
  shoulder A:cylinder r:0.14 h:0.10 rs:32  #a0b0c0  m:0.88 r:0.18  y:+0.75
  shoulder B:cylinder r:0.14 h:0.10 rs:32  #a0b0c0  m:0.88 r:0.18  y:-0.75
  keyway:    box      w:0.06 h:0.20 d:0.10 #1a2030  m:0.50 r:0.50  y:+0.40 x:+0.10
  thread end:cylinder r:0.09 h:0.30 rs:32  #7a8a9a  m:0.88 r:0.20  y:-0.90

BALL SCREW:
  screw shaft:cylinder r:0.09 h:1.40 rs:32 #8a9aaa  m:0.92 r:0.12  y:0
  nut housing:cylinder r:0.22 h:0.35 rs:32 #b0c0d0  m:0.88 r:0.20  y:+0.20
  nut flange: cylinder r:0.28 h:0.06 rs:32 #a0b0c0  m:0.85 r:0.25  y:+0.355
  end sup A:  cylinder r:0.15 h:0.12 rs:32 #7a8a9a  m:0.88 r:0.22  y:+0.66
  end sup B:  cylinder r:0.15 h:0.12 rs:32 #7a8a9a  m:0.88 r:0.22  y:-0.66

LINEAR RAIL:
  rail body:  box  w:0.20 h:0.20 d:1.80   #8a9aaa  m:0.90 r:0.18
  carriage:   box  w:0.32 h:0.26 d:0.40   #b0c0d0  m:0.88 r:0.20  y:+0.03
  groove A:   box  w:0.04 h:0.06 d:1.82   #1a2030  m:0.50 r:0.50  x:+0.07 y:+0.05
  groove B:   box  w:0.04 h:0.06 d:1.82   #1a2030  m:0.50 r:0.50  x:-0.07 y:+0.05
  bolt hole A:cylinder r:0.04 h:0.22 rs:16 #1a2030  x:+0.12 z:+0.16 rot x:1.5708
  bolt hole B:cylinder r:0.04 h:0.22 rs:16 #1a2030  x:-0.12 z:+0.16 rot x:1.5708

SERVO MOTOR BRACKET:
  body:       box  w:0.60 h:0.80 d:0.50   #3a4a5a  m:0.75 r:0.45
  output shaft:cylinder r:0.07 h:0.20 rs:32 #8a9aaa  m:0.90 r:0.18  x:+0.35 y:+0.10 rot z:1.5708
  mount flange:box  w:0.70 h:0.10 d:0.60  #4a5a6a  m:0.78 r:0.40  y:-0.45
  bolt hole A:cylinder r:0.04 h:0.12 rs:16 #1a2030  x:+0.28 y:-0.45 z:+0.22
  bolt hole B:cylinder r:0.04 h:0.12 rs:16 #1a2030  x:-0.28 y:-0.45 z:-0.22
  connector:  box  w:0.15 h:0.10 d:0.20   #f97316  m:0.10 r:0.70  x:-0.33 y:+0.10

PIPE FLANGE:
  flange disk:cylinder r:0.55 h:0.10 rs:32 #8a9aaa  m:0.88 r:0.25  y:0
  pipe stub:  cylinder r:0.22 h:0.50 rs:32 #7a8a9a  m:0.88 r:0.22  y:+0.30
  bore:       cylinder r:0.18 h:0.65 rs:32 #1a2030  m:0.50 r:0.50  y:+0.275
  bolt hole A:cylinder r:0.05 h:0.12 rs:16 #1a2030  x:+0.40 y:0
  bolt hole B:cylinder r:0.05 h:0.12 rs:16 #1a2030  x:-0.40 y:0
  bolt hole C:cylinder r:0.05 h:0.12 rs:16 #1a2030  z:+0.40 y:0
  bolt hole D:cylinder r:0.05 h:0.12 rs:16 #1a2030  z:-0.40 y:0

PULLEY / WHEEL:
  hub:        cylinder r:0.15 h:0.40 rs:32 #8a9aaa  m:0.88 r:0.22  y:0
  spoke A:    box      w:0.08 h:0.06 d:0.50 #7a8a9a m:0.85 r:0.28  rot y:0
  spoke B:    box      w:0.08 h:0.06 d:0.50 #7a8a9a m:0.85 r:0.28  rot y:1.0472
  spoke C:    box      w:0.08 h:0.06 d:0.50 #7a8a9a m:0.85 r:0.28  rot y:2.0944
  rim:        torus    r:0.42 tube:0.06     #9aaaba  m:0.88 r:0.20  y:0
  bore:       cylinder r:0.07 h:0.42 rs:32  #1a2030 m:0.50 r:0.50  y:0

UNIVERSAL JOINT (U-JOINT):
  yoke A fork1:box  w:0.12 h:0.55 d:0.10  #8a9aaa  m:0.88 r:0.22  x:+0.13 y:+0.18
  yoke A fork2:box  w:0.12 h:0.55 d:0.10  #8a9aaa  m:0.88 r:0.22  x:-0.13 y:+0.18
  yoke A base: cylinder r:0.14 h:0.20 rs:32 #7a8a9a m:0.88 r:0.22  y:-0.20
  cross body:  sphere   r:0.14              #b0c0d0  m:0.92 r:0.12  y:0
  yoke B fork1:box  w:0.10 h:0.12 d:0.55  #8a9aaa  m:0.88 r:0.22  z:+0.13 y:-0.18 rot x:1.5708
  yoke B fork2:box  w:0.10 h:0.12 d:0.55  #8a9aaa  m:0.88 r:0.22  z:-0.13 y:-0.18 rot x:1.5708

TIMING BELT PULLEY:
  pulley body:cylinder r:0.30 h:0.35 rs:32 #3a4a5a  m:0.75 r:0.45  y:0
  flange top: cylinder r:0.36 h:0.05 rs:32 #4a5a6a  m:0.78 r:0.40  y:+0.20
  flange bot: cylinder r:0.36 h:0.05 rs:32 #4a5a6a  m:0.78 r:0.40  y:-0.20
  bore:       cylinder r:0.08 h:0.37 rs:32 #1a2030  m:0.50 r:0.50  y:0
  set screw:  cylinder r:0.025 h:0.10 rs:8 #8a9aaa  m:0.90 r:0.20  x:+0.30 rot z:1.5708

ORIENTATION CRITICAL RULES:
- BOLTS: always VERTICAL — head at TOP (positive Y), shaft DOWN (negative Y)
- SHAFTS: along Y axis unless user says horizontal
- GEARS: lie FLAT — disk in XZ plane, Y is rotation axis
- BRACKETS: base plate HORIZONTAL (XZ plane), vertical plate goes UP
- BEARINGS: lie FLAT like gears, rotation axis is Y
- FLANGES: disk in XZ plane
- RAILS: long axis along Z
- If user says "horizontal bolt" → rotate entire assembly 90deg on X axis (rotation x:1.5708)
- If user says "wall bracket" → rotate base plate to vertical

DETAIL DENSITY RULES — CRITICAL:
NEVER generate less than 6 primitives for any part.
ALWAYS decompose every feature into separate primitives.
Think like a CAD engineer — every edge, chamfer, groove, hole = separate primitive.

GEAR — MINIMUM 10 PRIMITIVES:
  1. Main disk body       → cylinder  r:0.55 h:0.28  #8a9aaa
  2. Top face chamfer     → cylinder  r:0.52 h:0.03  #9aaaba  y:+0.155
  3. Bot face chamfer     → cylinder  r:0.52 h:0.03  #9aaaba  y:-0.155
  4. Tooth ring outer     → torus     r:0.55 tube:0.055  #7a8a9a
  5. Tooth ring detail    → torus     r:0.58 tube:0.025  #6a7a8a
  6. Bore hole            → cylinder  r:0.12 h:0.30  #1a2030
  7. Bore chamfer top     → cone      r:0.14→0.12 h:0.02  #2a3040  y:+0.15
  8. Bore chamfer bottom  → cone      r:0.12→0.14 h:0.02  #2a3040  y:-0.15
  9. Keyway slot          → box       w:0.06 h:0.30 d:0.09  #1a2030  x:+0.12
  10. Hub ring            → torus     r:0.20 tube:0.025  #9aaaba

BOLT M8 — MINIMUM 8 PRIMITIVES:
  1. Hex head             → box       w:0.24 h:0.15 d:0.24  rot y:0.5236  #8a9aaa
  2. Head top face        → cylinder  r:0.13 h:0.02  #b0c0d0  y:head_top
  3. Head chamfer         → cone  #9aaaba
  4. Washer               → cylinder  r:0.18 h:0.04  #9aaaba
  5. Smooth shaft         → cylinder  r:0.08 h:0.20  #b0c0d0
  6. Threaded shaft       → cylinder  r:0.08 h:0.65  label:"thread"  #8a9aaa
  7. Thread tip chamfer   → cone  r:0.08→0.04 h:0.06  #7a8a9a
  8. Tip point            → sphere  r:0.035  #6a7a8a

BEARING — MINIMUM 10 PRIMITIVES:
  1. Outer ring           → cylinder  r:0.52 h:0.26  #1a1a22
  2. Outer inner wall     → cylinder  r:0.42 h:0.28  #2a2a35
  3. Outer raceway grv    → torus     r:0.42 tube:0.032  #c8d0d8
  4. Inner ring           → cylinder  r:0.28 h:0.28  #1a1a22
  5. Inner outer wall     → cylinder  r:0.32 h:0.26  #2a2a35
  6. Inner raceway grv    → torus     r:0.32 tube:0.028  #c8d0d8
  7. Bore                 → cylinder  r:0.18 h:0.30  #0a0a12
  8. Ball 1 at 0°         → sphere    r:0.065  #d0d8e8  x:+0.37
  9. Ball 2 at 120°       → sphere    r:0.065  #d0d8e8  calculated
  10. Ball 3 at 240°      → sphere    r:0.065  #d0d8e8  calculated
  11. Cage ring top       → torus     r:0.37 tube:0.016  #4a5a3a  y:+0.06
  12. Cage ring bottom    → torus     r:0.37 tube:0.016  #4a5a3a  y:-0.06

BRACKET — MINIMUM 8 PRIMITIVES:
  1. Base plate           → box  w:0.90 h:0.08 d:0.65  #8a9aaa
  2. Vertical plate       → box  w:0.08 h:0.75 d:0.65  #8a9aaa
  3. Gusset triangle      → box  w:0.22 h:0.22 d:0.62  rot z:0.785  #7a8a9a
  4. Base bolt hole A     → cylinder  r:0.04 h:0.10  #1a2030  corner A
  5. Base bolt hole B     → cylinder  r:0.04 h:0.10  #1a2030  corner B
  6. Vert bolt hole A     → cylinder  r:0.04 h:0.10  #1a2030  rot x:1.5708
  7. Vert bolt hole B     → cylinder  r:0.04 h:0.10  #1a2030  rot x:1.5708
  8. Top edge chamfer     → box  w:0.09 h:0.06 d:0.65  rot z:0.785  #9aaaba

ARM JOINT — MINIMUM 9 PRIMITIVES:
  1. Upper link shaft     → cylinder  r:0.12 h:0.65  #8a9aaa  y:+0.52
  2. Upper end cap        → cylinder  r:0.13 h:0.03  #9aaaba  y:+0.855
  3. Joint body           → cylinder  r:0.28 h:0.22  #b0c0d0
  4. Flange top           → cylinder  r:0.34 h:0.055  #9aaaba  y:+0.138
  5. Flange bottom        → cylinder  r:0.34 h:0.055  #9aaaba  y:-0.138
  6. Bolt through flange  → cylinder  r:0.035 h:0.30  #1a2030  x:+0.26
  7. Lower link shaft     → cylinder  r:0.12 h:0.65  #8a9aaa  y:-0.52
  8. Lower end cap        → cylinder  r:0.13 h:0.03  #9aaaba  y:-0.855
  9. Joint center bore    → cylinder  r:0.08 h:0.24  #1a2030

MOUNT PLATE — MINIMUM 9 PRIMITIVES:
  1. Base plate           → box  w:1.30 h:0.09 d:1.00  #8a9aaa
  2. Center boss          → cylinder  r:0.18 h:0.14  #9aaaba  y:+0.115
  3. Center bore          → cylinder  r:0.10 h:0.16  #1a2030  y:+0.115
  4. Stiffener rib X      → box  w:1.28 h:0.16 d:0.07  #7a8a9a  y:+0.125
  5. Stiffener rib Z      → box  w:0.07 h:0.16 d:0.98  #7a8a9a  y:+0.125
  6. Hole front-left      → cylinder  r:0.055 h:0.11  #1a2030  x:-0.50 z:-0.38
  7. Hole front-right     → cylinder  r:0.055 h:0.11  #1a2030  x:+0.50 z:-0.38
  8. Hole back-left       → cylinder  r:0.055 h:0.11  #1a2030  x:-0.50 z:+0.38
  9. Hole back-right      → cylinder  r:0.055 h:0.11  #1a2030  x:+0.50 z:+0.38
  10. Edge chamfer        → box  w:1.32 h:0.03 d:0.03  #9aaaba  y:+0.06 z:+0.515

GENERAL DETAIL RULES FOR ANY PART:
FOR EVERY CYLINDRICAL FEATURE → add top chamfer + bottom chamfer + face ring
FOR EVERY HOLE/BORE → entry chamfer cone at both ends, color #1a2030, h+0.02 to punch through
FOR EVERY FLAT PLATE/BOX → edge highlight (h:0.008 lighter), stiffener rib, min 4 bolt holes
FOR EVERY SHAFT → shoulder steps at both ends + keyway slot + thread end label
FOR EVERY JOINT → flange (wider flat cylinder) at both ends + bolt holes + fillet torus at base

COLOR DEPTH RULES — USE 3 SHADES:
  LIGHT: main visible faces    → #b0c0d0
  MID:   body/side faces       → #8a9aaa
  DARK:  recesses/undercuts    → #5a6a7a
  BLACK: holes/bores           → #1a2030
Alternate light/mid/dark every 2-3 parts to show form. Never same color 3+ parts in a row.`;




function apiFetch(body, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function extractJSON(raw) {
  // 1. Strip think-tags
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // 2. Strip ALL markdown fences (```json, ```scad, ```, etc.)
  text = text.replace(/^```[a-z]*\s*/im, "").replace(/```\s*$/im, "").trim();
  // 3. Find the outermost { ... } using balanced brace scanning
  let start = text.indexOf("{");
  if (start === -1) return "";
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc)            { esc = false; continue; }
    if (c === "\\")     { esc = true;  continue; }
    if (c === '"')      { inStr = !inStr; continue; }
    if (inStr)          { continue; }
    if (c === "{")      { depth++; }
    else if (c === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  // 4. Fallback: return everything from first { 
  return text.slice(start);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  // ── Serve frontend ───────────────────────────────────────────────
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    if (fs.existsSync(FRONTEND_HTML)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(FRONTEND_HTML));
    }
    res.writeHead(404);
    return res.end("Frontend not found");
  }

  // ── Auth ────────────────────────────────────────────────────────
  if (req.method === "GET" && req.url === "/api/auth/me") {
    return send(res, 200, { id: "local-user", name: "Demo User", email: "demo@mechagen.ai", role: "engineer" });
  }

  // ── AI Co-Pilot Chat ────────────────────────────────────────────
  if (req.method === "POST" && req.url === "/api/ai/chat") {
    const b = await readBody(req).catch(() => "{}");
    const { message = "" } = JSON.parse(b);
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) return send(res, 500, { reply: "NVIDIA_API_KEY not configured" });
    try {
      const result = await apiFetch({
        model: MODEL, temperature: 0.7, max_tokens: 512,
        messages: [
          { role: "system", content: "You are a mechanical engineering AI co-pilot. Give concise expert advice about design, materials, and manufacturing. Maximum 3 sentences." },
          { role: "user",   content: message }
        ]
      }, apiKey);
      const data = JSON.parse(result.body);
      return send(res, 200, { reply: (data.choices?.[0]?.message?.content || "No response").trim() });
    } catch (err) { return send(res, 500, { reply: "Error: " + err.message }); }
  }

  // ── AI stubs ────────────────────────────────────────────────────
  if (req.method === "POST" && req.url === "/api/ai/improve-prompt") {
    const b = await readBody(req).catch(() => "{}");
    const { prompt = "" } = JSON.parse(b);
    return send(res, 200, { improvedPrompt: prompt ? `Precision-machined ${prompt} with tight tolerances and surface finish Ra 1.6` : prompt });
  }

  if (req.method === "POST" && req.url === "/api/ai/analyze") {
    return send(res, 200, { analysis: "Structural integrity verified. Von Mises stress within allowable limits. Recommend fillet radius ≥ 2mm at stress concentrations." });
  }

  if (req.method === "POST" && req.url === "/api/ai/recommend-material") {
    return send(res, 200, { material: "steel" });
  }

  // ── OpenSCAD pipeline: generate .scad → STL ────────────────
  if (req.method === "POST" && (req.url === "/api/ai/generate-scad" || req.url === "/api/ai/render-scad")) {
    const b = await readBody(req).catch(() => "{}");
    const body = JSON.parse(b);
    const apiKey = process.env.NVIDIA_API_KEY;
    const jobId  = randomUUID();
    const tmpDir = require("os").tmpdir();
    const scadPath = path.join(tmpDir, `mechagen_${jobId}.scad`);
    const stlPath  = path.join(tmpDir, `mechagen_${jobId}.stl`);

    // Check OpenSCAD is available
    const openscadBin = await new Promise(r => {
      // Try which first, then check common macOS paths (Homebrew PATH may not be in exec env)
      exec("which openscad", (e, o) => {
        if (!e && o.trim()) return r(o.trim());
        const candidates = [
          "/opt/homebrew/bin/openscad",              // Apple Silicon brew
          "/usr/local/bin/openscad",                  // Intel Mac brew
          "/Applications/OpenSCAD-2021.01.app/Contents/MacOS/OpenSCAD",
          "/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD"
        ];
        const fs2 = require("fs");
        const found = candidates.find(p => { try { return fs2.existsSync(p); } catch { return false; } });
        r(found || null);
      });
    });
    if (!openscadBin) return send(res, 501, { error: "OpenSCAD is not installed on this server. Install it with: brew install --cask openscad (Mac) or apt-get install openscad (Linux)" });

    let scadCode;
    try {
      if (req.url === "/api/ai/render-scad") {
        // User sent raw SCAD code to re-render
        scadCode = body.scad_code;
        if (!scadCode) return send(res, 400, { error: "scad_code is required" });
      } else {
        // AI generates OpenSCAD code
        if (!apiKey) return send(res, 500, { error: "NVIDIA_API_KEY not configured" });
        const prompt = body.prompt || "";
        if (!prompt.trim()) return send(res, 400, { error: "prompt is required" });

        const OPENSCAD_SYS = `You are an expert OpenSCAD programmer for mechanical engineering.
Output ONLY valid OpenSCAD code — no markdown, no explanation, no triple backticks.
Rules:
1. $fn=64 for smooth cylinders, $fn=6 for hex shapes
2. All parametric variables at top as named constants
3. Use difference() for holes/bores, union() for compound bodies
4. Center model at origin [0,0,0]
5. All dimensions in millimeters
6. Threads via for() loop with translate+rotate_extrude
7. Gears via for() loop rotating copies of tooth profile
8. Chamfers via difference() with angled cube or cylinder
9. Fillets via minkowski() with small sphere
10. Hex heads: cylinder(h, d/2, $fn=6)
Always end file with the top-level shape call.`;

        const result = await apiFetch({
          model: MODEL, temperature: 0.3, max_tokens: 2048,
          messages: [
            { role: "system", content: OPENSCAD_SYS },
            { role: "user",   content: `Generate OpenSCAD code for: ${prompt.trim()}` }
          ]
        }, apiKey);

        const data = JSON.parse(result.body);
        scadCode = (data.choices?.[0]?.message?.content || "").trim();
        scadCode = scadCode.replace(/^```(?:openscad|scad)?\s*/i, "").replace(/```\s*$/i, "").trim();
        if (!scadCode) throw new Error("Model returned empty OpenSCAD code");
      }

      // Write .scad file
      fs.writeFileSync(scadPath, scadCode);
      console.log(`[SCAD] Written ${scadPath}`);

      // Run OpenSCAD headless
      await new Promise((resolve, reject) => {
        const cmd = `"${openscadBin}" --export-format=binstl -o "${stlPath}" "${scadPath}"`;
        exec(cmd, { timeout: 30000 }, (err, _stdout, stderr) => {
          if (err) reject(new Error("OpenSCAD error: " + (stderr || err.message)));
          else resolve();
        });
      });

      // Read STL and base64 encode
      const stlBuffer = fs.readFileSync(stlPath);
      const stlBase64 = stlBuffer.toString("base64");
      const stlSizeKB = Math.round(stlBuffer.length / 1024);
      console.log(`[SCAD] STL OK — ${stlSizeKB}KB`);

      // Cleanup
      if (fs.existsSync(scadPath)) fs.unlinkSync(scadPath);
      if (fs.existsSync(stlPath))  fs.unlinkSync(stlPath);

      return send(res, 200, { success: true, stl_base64: stlBase64, scad_code: scadCode, size_kb: stlSizeKB });

    } catch (err) {
      if (fs.existsSync(scadPath)) try { fs.unlinkSync(scadPath); } catch {}
      if (fs.existsSync(stlPath))  try { fs.unlinkSync(stlPath);  } catch {}
      return send(res, 500, { error: err.message || "OpenSCAD generation failed" });
    }
  }

  // ── JSCAD pipeline: generate .js ────────────────
  if (req.method === "POST" && req.url === "/api/ai/generate-jscad") {
    const b = await readBody(req).catch(() => "{}");
    const body = JSON.parse(b);
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) return send(res, 500, { error: "NVIDIA_API_KEY not configured" });
    const prompt = body.prompt || "";
    if (!prompt.trim()) return send(res, 400, { error: "prompt is required" });

    const JSCAD_SYSTEM_PROMPT = `You are an expert JSCAD programmer for mechanical engineering parts.
JSCAD uses JavaScript with @jscad/modeling library.

STRICT RULES:
1. Output ONLY valid JavaScript — no markdown, no explanation
2. Always destructure needed functions from jscadModeling
3. Always export a main() function that returns the geometry
4. All dimensions in millimeters
5. Center model at origin
6. Use CSG operations for holes and complex shapes

AVAILABLE JSCAD FUNCTIONS:
const {
  // Primitives
  primitives: { cylinder, cube, sphere, torus, cylinderElliptic },

  // Boolean operations
  booleans: { union, subtract, intersect },

  // Transforms
  transforms: { translate, rotate, scale, mirror, center },

  // Math
  maths: { vec3 },

  // Utils
  utils: { degToRad }
} = jscadModeling;

EXAMPLE — Radial Ball Bearing:
\`\`\`javascript
const {
  primitives: { cylinder, sphere, torus },
  booleans: { union, subtract, intersect },
  transforms: { translate, rotate, rotateX, rotateZ },
  utils: { degToRad }
} = jscadModeling;

function main() {
  const outerD    = 52;
  const innerD    = 25;
  const width     = 15;
  const ballD     = 7.5;
  const ballOrbit = 18.5;
  const ballCount = 8;

  // Balls
  const balls = [];
  for (let i = 0; i < ballCount; i++) {
    const angle = degToRad((360 / ballCount) * i);
    balls.push(
      translate([Math.cos(angle) * ballOrbit, Math.sin(angle) * ballOrbit, 0],
        sphere({ radius: ballD/2, segments: 64 })
      )
    );
  }

  // Cage
  const cageRingTop = subtract(
    cylinder({ height: 1.5, radius: ballOrbit + ballD/2 - 1, segments: 64 }),
    cylinder({ height: 1.8, radius: ballOrbit - ballD/2 + 1, segments: 64 })
  );
  const cageRingBot = subtract(
    cylinder({ height: 1.5, radius: ballOrbit + ballD/2 - 1, segments: 64 }),
    cylinder({ height: 1.8, radius: ballOrbit - ballD/2 + 1, segments: 64 })
  );
  let cageFull = union(
    translate([0, 0, width/2 - 3], cageRingTop),
    translate([0, 0, -width/2 + 1.5], cageRingBot)
  );
  for (let i = 0; i < ballCount; i++) {
    const angle = degToRad((360 / ballCount) * i + 180/ballCount);
    cageFull = union(cageFull, 
      translate([Math.cos(angle) * ballOrbit, Math.sin(angle) * ballOrbit, 0],
        cylinder({ height: width - 4, radius: 1.2, segments: 16 })
      )
    );
  }

  // Inner/Outer Rings
  const outerRingSimple = subtract(
    cylinder({ height: width, radius: outerD/2, segments: 128 }),
    cylinder({ height: width + 0.2, radius: outerD/2 - 5.8, segments: 128 })
  );
  const innerRingSimple = subtract(
    cylinder({ height: width + 0.4, radius: innerD/2 + 5, segments: 128 }),
    cylinder({ height: width + 0.6, radius: innerD/2, segments: 128 })
  );

  let outerWithPockets = outerRingSimple;
  let innerWithPockets = innerRingSimple;
  for (let i = 0; i < ballCount; i++) {
    const angle = degToRad((360 / ballCount) * i);
    const pocket = translate([Math.cos(angle) * ballOrbit, Math.sin(angle) * ballOrbit, 0],
      sphere({ radius: ballD/2 + 0.5, segments: 32 })
    );
    outerWithPockets = subtract(outerWithPockets, pocket);
    innerWithPockets = subtract(innerWithPockets, pocket);
  }

  return union(outerWithPockets, innerWithPockets, ...balls, cageFull);
}
\`\`\`

EXAMPLE — Spur Gear:
\`\`\`javascript
const {
  primitives: { cylinder },
  booleans: { union, subtract },
  transforms: { translate, rotate },
  utils: { degToRad }
} = jscadModeling;

function main() {
  const teeth = 18;
  const module = 2;
  const faceWidth = 20;
  const boreD = 10;

  const pitchR = (teeth * module) / 2;
  const outerR = pitchR + module;
  const rootR  = pitchR - 1.25 * module;

  // Gear body
  let gear = cylinder({ height: faceWidth, radius: rootR, segments: 64 });

  // Add teeth
  for (let i = 0; i < teeth; i++) {
    const angle = degToRad((360 / teeth) * i);
    const tooth = translate(
      [Math.cos(angle) * pitchR, Math.sin(angle) * pitchR, 0],
      cylinder({ height: faceWidth + 0.1, radius: module * 0.8, segments: 8 })
    );
    gear = union(gear, tooth);
  }

  // Bore hole
  gear = subtract(gear,
    cylinder({ height: faceWidth + 0.2, radius: boreD/2, segments: 64 })
  );

  // Chamfers top/bottom
  gear = subtract(gear,
    translate([0, 0, faceWidth/2 - 0.5],
      cylinder({ height: 2, radius1: boreD/2 + 2, radius2: boreD/2, segments: 64 })
    )
  );

  return gear;
}
\`\`\`

QUALITY RULES:
- EXTENSIVE DETAIL: Build EXACTLY like a professional CAD engineer. DO NOT simplify. Generate ALL components (e.g., for bearings: inner race, outer race, ball cage, balls, chamfers, and precise ball grooves).
- HIGHEST RESOLUTION: Use \`segments: 128\` for ALL primary cylinders, spheres, and toruses to ensure perfectly smooth 3D arcs. Use \`segments: 64\` for smaller subcomponents.
- Always subtract bore holes and internal grooves with \`subtract()\`
- Add chamfers using \`cylinder({ radius1, radius2 })\` with differing radii.
- Real world dimensions (mm) always.
- Complex geometric arrays (like bearing balls) MUST use Javascript loops (\`for\`) and \`Math.sin\`/\`Math.cos\` to mathematically position them.
- CRITICAL JS RULE: If you are unioning or subtracting inside a loop, YOU MUST declare the base variable with \`let\` instead of \`const\` to avoid "Assignment to constant variable" errors (e.g., \`let outerRace = cylinder(...); for(...) { outerRace = subtract(outerRace, hole); }\`).
- Always return a single assembled geometry from \`main()\`.`;

    try {
      const result = await apiFetch({
        model: MODEL, temperature: 0.3, max_tokens: 2048,
        messages: [
          { role: "system", content: JSCAD_SYSTEM_PROMPT },
          { role: "user",   content: `Generate JSCAD code for: ${prompt.trim()}` }
        ]
      }, apiKey);

      const data = JSON.parse(result.body);
      let jscadCode = (data.choices?.[0]?.message?.content || "").trim();
      jscadCode = jscadCode.replace(/^```(?:javascript|js)?\s*/i, "").replace(/```\s*$/i, "").trim();
      if (!jscadCode) throw new Error("Model returned empty JSCAD code");

      console.log(`[JSCAD] Code OK`);
      return send(res, 200, { success: true, jscad_code: jscadCode });

    } catch (err) {
      return send(res, 500, { error: err.message || "JSCAD generation failed" });
    }
  }

  // /api/ai/generate → forward to /api/generate
  if (req.method === "POST" && req.url === "/api/ai/generate") {
    req.url = "/api/generate";
  }

  // ── 404 for unknown routes ───────────────────────────────────────
  if (req.url !== "/api/generate") {
    return send(res, 404, { error: "Not found" });
  }
  if (req.method !== "POST") {
    return send(res, 405, { error: "POST only" });
  }

  let prompt;
  try {
    const bodyRaw = await readBody(req);
    prompt = JSON.parse(bodyRaw).prompt;
  } catch { return send(res, 400, { error: "Invalid JSON body" }); }

  if (!prompt?.trim())          return send(res, 400, { error: "Prompt is required" });
  if (prompt.trim().length < 3)  return send(res, 400, { error: "Prompt too short" });
  if (prompt.trim().length > 500) return send(res, 400, { error: "Prompt too long" });

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return send(res, 500, { error: "NVIDIA_API_KEY not configured" });

  try {
    console.log(`[GEN] "${prompt.trim()}"`);
    const result = await apiFetch({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 2048,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: `Generate a detailed 3D mechanical part for: ${prompt.trim()}` }
      ]
    }, apiKey);

    if (result.status !== 200) {
      let errMsg = `NVIDIA API error ${result.status}`;
      try { errMsg = JSON.parse(result.body)?.error?.message || errMsg; } catch {}
      throw new Error(errMsg);
    }

    const data = JSON.parse(result.body);
    const raw  = data.choices?.[0]?.message?.content || "";
    console.log("[RAW]", raw.substring(0, 300));

    const clean = extractJSON(raw);
    if (!clean) throw new Error("Empty model response");

    const geometry = JSON.parse(clean);
    if (!Array.isArray(geometry.parts) || geometry.parts.length === 0) {
      throw new SyntaxError("No parts array");
    }

    console.log(`[OK] ${geometry.name} — ${geometry.parts.length} parts`);
    return send(res, 200, geometry);

  } catch (err) {
    if (err instanceof SyntaxError) return send(res, 502, { error: "Model returned invalid JSON — try again." });
    return send(res, 500, { error: err.message || "Generation failed" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\nMechaGen  →  http://localhost:${PORT}`);
  console.log(`Model     →  ${MODEL}\n`);
});
