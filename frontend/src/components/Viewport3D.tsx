import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { Theme } from '../context/ThemeContext';
import type { GeomData, GeomPart } from '../types';

// ── Types ────────────────────────────────────────────────────────────
export type Viewport3DHandle = {
  getCameraPosition: () => THREE.Vector3 | null;
  getExportRoot: () => THREE.Object3D | null;
};

type Props = {
  geomData: GeomData | null;
  scale: { x: number; y: number; z: number };
  theme: Theme;
  /** Viewport PBR preset — keys match MATERIALS_DB in constants */
  materialKey?: string;
  wireframe?: boolean;
  /** Toggles wireframe from the bottom viewport toolbar */
  onToggleWireframe?: () => void;
  /** 0–1 mesh opacity (1 = solid) */
  modelOpacity?: number;
  /** Last generate prompt — used to parse tooth count / keyway for procedural gear */
  generationPrompt?: string;
};

// ── Color themes ──────────────────────────────────────────────────────
const PART_THEMES: Record<string, Record<string, { color: string; metalness: number; roughness: number; clearcoat?: number; envMapIntensity?: number }>> = {
  bearing: {
    outer: { color: '#2a3540', metalness: 0.98, roughness: 0.06, envMapIntensity: 4.0 },
    inner: { color: '#1e2830', metalness: 0.98, roughness: 0.08, envMapIntensity: 3.5 },
    balls: { color: '#d8e0e8', metalness: 1.00, roughness: 0.01, clearcoat: 1.0, envMapIntensity: 6.0 },
    cage:  { color: '#8a7030', metalness: 0.75, roughness: 0.35, envMapIntensity: 2.0 },
  },
  gear: {
    body:  { color: '#3a4a5a', metalness: 0.95, roughness: 0.12 },
    teeth: { color: '#4a5a6a', metalness: 0.93, roughness: 0.15 },
  },
  bolt: {
    head:   { color: '#8a9aaa', metalness: 0.96, roughness: 0.10 },
    shaft:  { color: '#7a8a9a', metalness: 0.95, roughness: 0.12 },
    thread: { color: '#6a7a8a', metalness: 0.94, roughness: 0.15 },
  },
  default: {
    body: { color: '#7a8a9a', metalness: 0.92, roughness: 0.15 },
  },
};

function makeMat(opts: { color?: string; metalness?: number; roughness?: number; clearcoat?: number; envMapIntensity?: number }) {
  return new THREE.MeshPhysicalMaterial({
    color:              new THREE.Color(opts.color || '#8a9aaa'),
    metalness:          opts.metalness  ?? 0.92,
    roughness:          opts.roughness  ?? 0.15,
    envMapIntensity:    opts.envMapIntensity ?? 1.05,
    clearcoat:          opts.clearcoat  ?? 0,
    clearcoatRoughness: 0.1,
  });
}

// ── JSCAD → Three.js geometry ────────────────────────────────────────
function jscadToThree(geom: unknown): THREE.BufferGeometry {
  const { geometries } = (window as unknown as { jscadModeling: {
    geometries: { geom3: { toPolygons: (g: unknown) => Array<{ vertices: [number, number, number][] }> } }
  } }).jscadModeling;

  const polygons = geometries.geom3.toPolygons(geom);
  const verts: number[] = [];
  const norms: number[] = [];

  polygons.forEach(poly => {
    const pts = poly.vertices;
    const ab  = [pts[1][0]-pts[0][0], pts[1][1]-pts[0][1], pts[1][2]-pts[0][2]];
    const ac  = [pts[2][0]-pts[0][0], pts[2][1]-pts[0][1], pts[2][2]-pts[0][2]];
    const n   = [
      ab[1]*ac[2]-ab[2]*ac[1],
      ab[2]*ac[0]-ab[0]*ac[2],
      ab[0]*ac[1]-ab[1]*ac[0],
    ];
    const len = Math.sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]) || 1;
    const nx=n[0]/len, ny=n[1]/len, nz=n[2]/len;

    for (let i = 1; i < pts.length-1; i++) {
      [pts[0], pts[i], pts[i+1]].forEach(p => {
        verts.push(p[0], p[1], p[2]);
        norms.push(nx, ny, nz);
      });
    }
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(norms, 3));
  geo.computeBoundingBox();
  return geo;
}

function centerAndScale(geo: THREE.BufferGeometry, targetSize = 3.2) {
  geo.computeBoundingBox();
  const c = new THREE.Vector3();
  geo.boundingBox!.getCenter(c);
  geo.translate(-c.x, -c.y, -c.z);
  const s = new THREE.Vector3();
  geo.boundingBox!.getSize(s);
  const sc = targetSize / Math.max(s.x, s.y, s.z, 0.001);
  geo.scale(sc, sc, sc);
}

/**
 * AI JSON primitives → Three.js group (centered & scaled like JSCAD path).
 * MeshStandardMaterial + explicit defaults; returns vertex count for UI stats.
 */
function buildMeshFromParts(parts: GeomPart[]): {
  group: THREE.Group;
  vertexCount: number;
} {
  const root = new THREE.Group();
  let vertexCount = 0;

  for (const part of parts) {
    const p = part.params || {};
    const shape = (part.shape || 'box').toLowerCase();
    let geo: THREE.BufferGeometry;

    switch (shape) {
      case 'box':
        geo = new THREE.BoxGeometry(p.w || 1, p.h || 1, p.d || 1);
        break;
      case 'cylinder':
        geo = new THREE.CylinderGeometry(
          p.r || 0.5,
          p.r || 0.5,
          p.h || 1,
          Math.max(3, Math.floor(p.radSeg || 32))
        );
        break;
      case 'sphere':
        geo = new THREE.SphereGeometry(p.r || 0.5, 32, 16);
        break;
      case 'torus':
        geo = new THREE.TorusGeometry(p.r || 0.5, p.tube || 0.1, 16, 64);
        break;
      case 'cone':
        geo = new THREE.ConeGeometry(
          p.r || 0.5,
          p.h || 1,
          Math.max(3, Math.floor(p.radSeg || 32))
        );
        break;
      default:
        geo = new THREE.BoxGeometry(1, 1, 1);
    }

    const posAttr = geo.attributes.position;
    if (posAttr) vertexCount += posAttr.count;

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(part.color || '#8a9aaa'),
      metalness: part.metalness !== undefined ? part.metalness : 0.8,
      roughness: part.roughness !== undefined ? part.roughness : 0.3,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isGeomParts = true;
    mesh.position.set(
      part.position?.x || 0,
      part.position?.y || 0,
      part.position?.z || 0
    );
    mesh.rotation.set(
      part.rotation?.x || 0,
      part.rotation?.y || 0,
      part.rotation?.z || 0
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  const box = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.set(-center.x, -center.y, -center.z);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const sc = 3.2 / maxDim;
  root.scale.setScalar(sc);

  return { group: root, vertexCount };
}


/** PBR for STL — scene.environment (IBL) required for believable metal */
function createStlPbrMaterial(theme: Theme, materialKey: string): THREE.MeshPhysicalMaterial {
  const light = theme === 'light';
  const k = (materialKey || 'aluminum').toLowerCase();

  if (k === 'aluminum' || k === 'alu') {
    return new THREE.MeshPhysicalMaterial({
      color: light ? 0xa8b4c2 : 0xd2dbe3,
      metalness: 1,
      roughness: light ? 0.44 : 0.36,
      clearcoat: 0.18,
      clearcoatRoughness: 0.12,
      envMapIntensity: light ? 0.58 : 0.92,
      ior: 1.39,
      specularIntensity: 1,
      specularColor: new THREE.Color(0xe8f2ff),
    });
  }

  if (k === 'titanium') {
    return new THREE.MeshPhysicalMaterial({
      color: light ? 0x9aa0a8 : 0xc5cad1,
      metalness: 0.98,
      roughness: light ? 0.26 : 0.2,
      clearcoat: 0.35,
      clearcoatRoughness: 0.09,
      envMapIntensity: light ? 0.62 : 1.05,
      ior: 1.55,
      specularIntensity: 1,
      specularColor: new THREE.Color(0xffffff),
    });
  }

  if (k === 'abs' || k === 'carbon') {
    const darkPlast = k === 'carbon';
    return new THREE.MeshPhysicalMaterial({
      color: darkPlast ? (light ? 0x2a2d32 : 0x1a1c20) : light ? 0xd8dde4 : 0xaeb6c4,
      metalness: darkPlast ? 0.08 : 0,
      roughness: 0.55,
      clearcoat: darkPlast ? 0.25 : 0.06,
      clearcoatRoughness: 0.35,
      envMapIntensity: light ? 0.35 : 0.5,
      ior: 1.45,
      specularIntensity: 0.35,
      specularColor: new THREE.Color(0xffffff),
    });
  }

  // steel (default)
  return new THREE.MeshPhysicalMaterial({
    color: light ? 0x8a9aad : 0xd0dae6,
    metalness: 1,
    roughness: light ? 0.28 : 0.18,
    clearcoat: 0.45,
    clearcoatRoughness: 0.08,
    envMapIntensity: light ? 0.65 : 1.15,
    ior: 1.465,
    specularIntensity: 1,
    specularColor: new THREE.Color(0xffffff),
  });
}

function applyStlPbrTheme(mesh: THREE.Mesh, theme: Theme, materialKey: string) {
  if (!mesh.userData.isStlMetal) return;
  const prev = mesh.material as THREE.MeshPhysicalMaterial;
  const next = createStlPbrMaterial(theme, materialKey);
  prev.dispose();
  mesh.material = next;
  mesh.userData.stlMaterialKey = materialKey;
}

function loadStlBase64(b64: string, theme: Theme, materialKey: string): THREE.Group {
  const binaryString = window.atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const loader = new STLLoader();
  const geometry = loader.parse(bytes.buffer);
  geometry.computeVertexNormals();

  const mat = createStlPbrMaterial(theme, materialKey);

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.userData.isStlMetal = true;
  mesh.userData.stlMaterialKey = materialKey;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Center geometry at origin and normalize scale to fit viewport
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);

  // Translate geometry so its center is at origin
  geometry.translate(-center.x, -center.y, -center.z);

  // Scale to fit within targetSize (CadQuery exports mm, viewport expects ~3.2 units)
  const targetSize = 3.2;
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const sc = targetSize / maxDim;
  geometry.scale(sc, sc, sc);

  const group = new THREE.Group();
  group.add(mesh);
  // CadQuery normally exports Z-up. Threejs is Y-up.
  group.rotation.x = -Math.PI / 2;

  return group;
}

function applyMeshDisplay(root: THREE.Object3D, wireframe: boolean, opacity: number) {
  const op = Math.min(1, Math.max(0, opacity));
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        const mat = m as THREE.Material & {
          wireframe?: boolean;
          transparent?: boolean;
          opacity?: number;
          depthWrite?: boolean;
          needsUpdate?: boolean;
        };
        mat.wireframe = wireframe;
        mat.transparent = op < 0.999;
        mat.opacity = op;
        if ('depthWrite' in mat) mat.depthWrite = op >= 0.99;
        mat.needsUpdate = true;
      }
    }
  });
}

function detectType(prompt: string): string {
  const p = (prompt || '').toLowerCase();
  if (p.includes('bearing'))                                    return 'bearing';
  if (p.includes('gear') || p.includes('sprocket'))            return 'gear';
  if (p.includes('bolt') || p.includes('screw') || p.includes('nut')) return 'bolt';
  if (p.includes('bracket') || p.includes('plate') || p.includes('mount')) return 'plate';
  return 'default';
}

function sanitizeJscadCode(raw: string): string {
  let c = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')       // strip CoT traces
    .replace(/^```[\w]*\s*/gm, '').replace(/```\s*$/gm, '') // strip fences
    .trim();

  // Strip prose preamble — find where real JS starts
  const jsStart = c.search(/^(?:const|let|var|function)\s/m);
  if (jsStart > 0) c = c.slice(jsStart);

  // Strip trailing prose the AI appends after closing brace
  // Match the last '}' that sits at the start of a line (end of main())
  const lastBrace = c.lastIndexOf('\n}');
  if (lastBrace !== -1) {
    c = c.slice(0, lastBrace + 2);
  }

  // Strip the AI's own destructure line — our preamble already provides all primitives
  // This avoids "Identifier has already been declared" errors from double-const
  c = c.replace(/^const\s*\{[\s\S]*?\}\s*=\s*jscadModeling\s*;?\s*\n?/m, '');

  // If the AI forgot function main(), wrap the entire code body in one
  if (!/function\s+main\s*\(/.test(c)) {
    console.warn('[JSCAD] AI did not generate function main() — auto-wrapping');

    // Find the last `return` statement to make sure it stays inside main()
    // If there's no return, wrap everything and return the last union/subtract/etc call
    const lines = c.trim().split('\n');
    const hasReturn = lines.some(l => /^\s*return\s/.test(l));

    if (hasReturn) {
      c = 'function main() {\n' + c.trim() + '\n}';
    } else {
      // Find the last variable assignment and return it
      let lastVar = 'undefined';
      for (let i = lines.length - 1; i >= 0; i--) {
        const m = lines[i].match(/^\s*(?:const|let|var)\s+(\w+)\s*=/);
        if (m) { lastVar = m[1]; break; }
      }
      c = 'function main() {\n' + c.trim() + '\nreturn ' + lastVar + ';\n}';
    }
  }

  return c;
}


function runCode(codeStr: string): unknown {
  const clean = sanitizeJscadCode(codeStr);
  console.groupCollapsed('[JSCAD] Full generated code (' + clean.length + ' chars)');
  console.log(clean);
  console.groupEnd();

  // Pre-inject ALL jscadModeling primitives so the AI's partial destructuring
  // never causes "X is not defined" errors. We extract everything first,
  // then the AI code can overwrite with its own const { ... } = jscadModeling.
  const preamble = `
    var jscadModeling = window.jscadModeling;
    var cylinder = jscadModeling.primitives.cylinder;
    var sphere = jscadModeling.primitives.sphere;
    var cuboid = jscadModeling.primitives.cuboid;
    var cube = jscadModeling.primitives.cuboid;
    var torus = jscadModeling.primitives.torus;
    var cylinderElliptic = jscadModeling.primitives.cylinderElliptic;
    var roundedCuboid = jscadModeling.primitives.roundedCuboid;
    var roundedCylinder = jscadModeling.primitives.roundedCylinder;
    var polygon = jscadModeling.primitives.polygon;
    var union = jscadModeling.booleans.union;
    var subtract = jscadModeling.booleans.subtract;
    var intersect = jscadModeling.booleans.intersect;
    var translate = jscadModeling.transforms.translate;
    var rotate = jscadModeling.transforms.rotate;
    var scale = jscadModeling.transforms.scale;
    var mirror = jscadModeling.transforms.mirror;
    var center = jscadModeling.transforms.center;
    var extrudeLinear = jscadModeling.extrusions.extrudeLinear;
    var extrudeRotate = jscadModeling.extrusions.extrudeRotate;
    var geom2 = jscadModeling.geometries.geom2;
    var degToRad = jscadModeling.utils.degToRad;
    var colorize = jscadModeling.colors.colorize;
  `;

  const wrapped = `(function() {\n${preamble}\n${clean}\nreturn main(); })()`;
  try {
    // eslint-disable-next-line no-eval
    const result = (0, eval)(wrapped);
    if (result === undefined || result === null) {
      throw new Error('main() returned nothing — the JSCAD code may have a logic error');
    }
    return result;
  } catch (e) {
    const msg = (e as Error).message || String(e);
    console.error('[JSCAD] Execution error:', msg);
    console.error('[JSCAD] Full code that failed:\n' + clean);
    throw new Error(`JSCAD error: ${msg}`);
  }
}

// ── Bearing multi-component renderer ─────────────────────────────────
function buildBearingComponents(code: string): { geom: unknown; mat: THREE.MeshPhysicalMaterial }[] {
  const param = (name: string, def: number) => {
    const m = code.match(new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*([\\d.]+)`));
    return m ? parseFloat(m[1]) : def;
  };
  const outerD    = param('outerD',    52);
  const innerD    = param('innerD',    25);
  const width     = param('width',     15);
  const ballD     = param('ballD',     7.5);
  const ballOrbit = param('ballOrbit', 18.5);
  const ballCount = param('ballCount', 8);

  const header = `const {
  primitives:{cylinder,sphere,torus},
  booleans:{union,subtract},
  transforms:{translate,rotate},
  utils:{degToRad}
} = jscadModeling;`;

  const components = [
    {
      mat: makeMat(PART_THEMES.bearing.outer),
      code: `${header}
function main() {
  const outerD=${outerD},width=${width},ballD=${ballD},ballOrbit=${ballOrbit},ballCount=${ballCount};
  let r=subtract(cylinder({height:width,radius:outerD/2,segments:128}),cylinder({height:width+0.2,radius:outerD/2-6,segments:128}));
  r=subtract(r,torus({innerRadius:outerD/2-6-0.5,outerRadius:outerD/2-6+ballD/2+0.3,segments:128}));
  r=subtract(r,translate([0,0,width/2-0.5],cylinder({height:1.5,radius1:outerD/2+0.1,radius2:outerD/2-1.5,segments:64})));
  r=subtract(r,translate([0,0,-width/2+0.5],cylinder({height:1.5,radius1:outerD/2-1.5,radius2:outerD/2+0.1,segments:64})));
  for(let i=0;i<ballCount;i++){const a=degToRad((360/ballCount)*i);r=subtract(r,translate([Math.cos(a)*ballOrbit,Math.sin(a)*ballOrbit,0],sphere({radius:ballD/2+0.5,segments:32})));}
  return r;
}`,
    },
    {
      mat: makeMat(PART_THEMES.bearing.inner),
      code: `${header}
function main() {
  const innerD=${innerD},width=${width},ballD=${ballD},ballOrbit=${ballOrbit},ballCount=${ballCount};
  let r=subtract(cylinder({height:width+1,radius:innerD/2+5.5,segments:128}),cylinder({height:width+1.2,radius:innerD/2,segments:128}));
  r=subtract(r,torus({innerRadius:innerD/2+5.5-ballD/2-0.3,outerRadius:innerD/2+5.5+0.5,segments:128}));
  for(let i=0;i<ballCount;i++){const a=degToRad((360/ballCount)*i);r=subtract(r,translate([Math.cos(a)*ballOrbit,Math.sin(a)*ballOrbit,0],sphere({radius:ballD/2+0.5,segments:32})));}
  return r;
}`,
    },
    {
      mat: makeMat(PART_THEMES.bearing.balls),
      code: `${header}
function main() {
  const ballD=${ballD},ballOrbit=${ballOrbit},ballCount=${ballCount};
  const balls=[];
  for(let i=0;i<ballCount;i++){const a=degToRad((360/ballCount)*i);balls.push(translate([Math.cos(a)*ballOrbit,Math.sin(a)*ballOrbit,0],sphere({radius:ballD/2,segments:64})));}
  return union(...balls);
}`,
    },
    {
      mat: makeMat(PART_THEMES.bearing.cage),
      code: `${header}
function main() {
  const width=${width},ballD=${ballD},ballOrbit=${ballOrbit},ballCount=${ballCount};
  let cage=union(
    translate([0,0,width/2-2.5],subtract(cylinder({height:2,radius:ballOrbit+ballD/2-0.5,segments:64}),cylinder({height:2.2,radius:ballOrbit-ballD/2+0.5,segments:64}))),
    translate([0,0,-width/2+0.5],subtract(cylinder({height:2,radius:ballOrbit+ballD/2-0.5,segments:64}),cylinder({height:2.2,radius:ballOrbit-ballD/2+0.5,segments:64})))
  );
  for(let i=0;i<ballCount;i++){const a=degToRad((360/ballCount)*i+180/ballCount);cage=union(cage,translate([Math.cos(a)*ballOrbit,Math.sin(a)*ballOrbit,0],cylinder({height:width-4,radius:1.5,segments:16})));}
  return cage;
}`,
    },
  ];

  return components.map(comp => ({ geom: runCode(comp.code), mat: comp.mat }));
}

// ── Procedural bolt builder (bypasses CadQuery for much better visuals) ──
function buildBoltProcedural(
  code: string,
  theme: Theme,
  _materialKey: string
): THREE.Group {
  // Parse parameters from the AI-generated Python code, with sensible M8 defaults
  const param = (name: string, def: number) => {
    const m = code.match(new RegExp(`(?:^|\\n)\\s*${name}\\s*=\\s*([\\d.]+)`));
    return m ? parseFloat(m[1]) : def;
  };
  const d          = param('d', 8);
  const p          = param('p', 1.25);
  const head_h     = param('head_h', 6.4);
  const head_w     = param('head_w', 13);
  const washer_od  = param('washer_od', 17);
  const washer_h   = param('washer_h', 1.6);
  const smooth_len = param('smooth_len', 10);
  const thread_len = param('thread_len', 20);

  // Normalize: scale so total height ≈ 3 viewport units
  const totalH = head_h + washer_h + smooth_len + thread_len + 1;
  const sc = 3.2 / totalH;

  const isLight = theme === 'light';
  const mat = (color: string, metalness: number, roughness: number) =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      metalness,
      roughness,
      clearcoat: 0.2,
      clearcoatRoughness: 0.1,
      envMapIntensity: isLight ? 0.6 : 1.0,
    });

  const headMat   = mat('#b0b8c4', 0.95, 0.18);
  const washerMat = mat('#a0a8b4', 0.92, 0.22);
  const shaftMat  = mat('#c0c8d0', 0.96, 0.14);
  const threadMat = mat('#d0d4dc', 0.94, 0.12);
  const valleyMat = mat('#98a0ac', 0.90, 0.25);
  const tipMat    = mat('#b8c0c8', 0.94, 0.16);

  const group = new THREE.Group();
  let yOff = 0;

  // ── Hex head (6-sided prism via CylinderGeometry with 6 radialSegments) ──
  const headR = (head_w / 2) * sc;
  const headH = head_h * sc;
  const hexGeo = new THREE.CylinderGeometry(headR, headR, headH, 6);
  const hexMesh = new THREE.Mesh(hexGeo, headMat);
  hexMesh.position.y = headH / 2;
  hexMesh.castShadow = hexMesh.receiveShadow = true;
  group.add(hexMesh);
  yOff += headH;

  // Head top chamfer ring
  const chamH = 0.06 * headH;
  const chamGeo = new THREE.CylinderGeometry(headR * 0.88, headR, chamH, 6);
  const chamMesh = new THREE.Mesh(chamGeo, headMat);
  chamMesh.position.y = yOff - chamH / 2;
  group.add(chamMesh);

  // ── Washer ──
  const wR = (washer_od / 2) * sc;
  const wH = washer_h * sc;
  const wShape = new THREE.Shape();
  wShape.absarc(0, 0, wR, 0, Math.PI * 2, false);
  const wHole = new THREE.Path();
  wHole.absarc(0, 0, (d / 2 + 0.3) * sc, 0, Math.PI * 2, true);
  wShape.holes.push(wHole);
  const washerGeo = new THREE.ExtrudeGeometry(wShape, {
    depth: wH, bevelEnabled: false,
  });
  washerGeo.rotateX(-Math.PI / 2);
  const washerMesh = new THREE.Mesh(washerGeo, washerMat);
  washerMesh.position.y = yOff;
  washerMesh.castShadow = washerMesh.receiveShadow = true;
  group.add(washerMesh);
  yOff += wH;

  // ── Smooth shank ──
  const shankR = (d / 2) * sc;
  const smoothH = smooth_len * sc;
  const smoothGeo = new THREE.CylinderGeometry(shankR, shankR, smoothH, 32);
  const smoothMesh = new THREE.Mesh(smoothGeo, shaftMat);
  smoothMesh.position.y = yOff + smoothH / 2;
  smoothMesh.castShadow = smoothMesh.receiveShadow = true;
  group.add(smoothMesh);
  yOff += smoothH;

  // ── Threaded section (stacked disc + valley) ──
  const threadH = thread_len * sc;
  const turns = Math.max(3, Math.round(thread_len / p));
  const threadSpacing = threadH / turns;
  const diskH = threadSpacing * 0.45;
  const valleyH = threadSpacing * 0.55;
  const threadR = shankR * 1.06;
  const valleyR = shankR * 0.92;

  for (let i = 0; i < turns; i++) {
    const y = yOff + i * threadSpacing;

    // Thread crest (slightly wider disc)
    const diskGeo = new THREE.CylinderGeometry(threadR, valleyR, diskH, 32);
    const disk = new THREE.Mesh(diskGeo, threadMat);
    disk.position.y = y + diskH / 2;
    disk.castShadow = true;
    group.add(disk);

    // Valley (narrower)
    const vGeo = new THREE.CylinderGeometry(valleyR, threadR, valleyH, 32);
    const valley = new THREE.Mesh(vGeo, valleyMat);
    valley.position.y = y + diskH + valleyH / 2;
    valley.castShadow = true;
    group.add(valley);
  }
  yOff += threadH;

  // ── Conical tip ──
  const tipH = d * 0.6 * sc;
  const tipGeo = new THREE.ConeGeometry(shankR * 0.9, tipH, 32);
  const tipMesh = new THREE.Mesh(tipGeo, tipMat);
  tipMesh.position.y = yOff + tipH / 2;
  tipMesh.castShadow = true;
  group.add(tipMesh);

  // Center the bolt vertically
  const fullH = yOff + tipH;
  group.position.y = -fullH / 2;

  return group;
}

/**
 * Procedural bolt preview — only when the user (and code) actually describe a fastener.
 * Must NOT key off CadQuery alone: mis-generated Python can look like a bolt while the
 * user asked for a bearing, which would replace the real STL with the wrong mesh.
 */
function isBoltPromptOrCode(
  code: string,
  name?: string,
  generationPrompt?: string
): boolean {
  const userText = `${generationPrompt || ''} ${name || ''}`.toLowerCase();
  if (
    /\b(bearing|bearings|ball bearing|radial ball|deep groove|race|races|inner race|outer race|rolling|needle roller|slewing)\b/.test(
      userText
    )
  ) {
    return false;
  }

  const c = (code || '').toLowerCase();
  if (
    /\b(ball_orbit|n_balls|outer_race_id|inner_race_od)\b/.test(c) &&
    c.includes('sphere(')
  ) {
    return false;
  }

  const n = (name || '').toLowerCase();
  if (/\b(bolt|screw|fastener|cap screw|m[0-9]+.*thread)\b/.test(n)) return true;
  if (/\b(bolt|screw|fastener|hex bolt|threaded shaft)\b/.test(userText)) return true;

  return (
    (c.includes('polygon(6') || c.includes('head_w') || c.includes('head_h')) &&
    (c.includes('thread') || c.includes('threaded') || c.includes('smooth'))
  );
}

type HelicalGearOpts = {
  teeth: number;
  outerRadius: number;
  boreRadius: number;
  faceWidth: number;
  helixAngle: number;
  keyway: boolean;
  color: string;
  metalness: number;
  roughness: number;
};

/** Parse N, bore, module, width from CadQuery + user prompt (mm → scaled scene units). */
function parseGearParams(
  code: string,
  generationPrompt: string,
  name?: string
): HelicalGearOpts {
  const text = `${generationPrompt}\n${name || ''}\n${code}`;
  const lower = text.toLowerCase();

  let teeth = 24;
  const teethPrompt = lower.match(/\b(\d{1,3})\s*teeth\b/);
  if (teethPrompt) teeth = parseInt(teethPrompt[1], 10);
  const nEq = code.match(/(?:^|\n)\s*N\s*=\s*(\d+)/im);
  if (nEq) teeth = parseInt(nEq[1], 10);
  const nTeeth = code.match(/n_teeth\s*=\s*(\d+)/i);
  if (nTeeth) teeth = parseInt(nTeeth[1], 10);
  teeth = Math.min(120, Math.max(6, teeth));

  const num = (re: RegExp, def: number) => {
    const m = code.match(re);
    return m ? parseFloat(m[1]) : def;
  };

  const mMod = num(/\bm\s*=\s*([\d.]+)/, 2.5);
  let pitchR = num(/pitch_r\s*=\s*([\d.]+)/, 0);
  let outerMm = num(/outer_r\s*=\s*([\d.]+)/, 0);
  if (!outerMm && pitchR > 0) outerMm = pitchR + mMod * 1.25;
  if (!outerMm) outerMm = (teeth * mMod) / (2 * Math.PI) + mMod * 1.35;

  let boreMm = num(/bore_r\s*=\s*([\d.]+)/, 0);
  if (!boreMm) boreMm = num(/hole_r\s*=\s*([\d.]+)/, 0);
  if (!boreMm) boreMm = num(/\bbore\s*=\s*([\d.]+)/, 4);
  const widthMm = num(/\bwidth\s*=\s*([\d.]+)/, 8);

  const maxMm = Math.max(outerMm * 2, widthMm, 1);
  const sc = 1.75 / maxMm;

  const helical = /\b(helical|helix)\b/i.test(text);
  const helixAngle = helical ? 0.12 : 0.05;
  const keyway = /\bkeyway\b/i.test(text);

  return {
    teeth,
    outerRadius: outerMm * sc,
    boreRadius: Math.min(boreMm * sc, outerMm * sc * 0.85),
    faceWidth: widthMm * sc,
    helixAngle,
    keyway,
    color: '#7a8a9a',
    metalness: 0.9,
    roughness: 0.18,
  };
}

function isGearPromptOrCode(
  code: string,
  name: string | undefined,
  generationPrompt: string
): boolean {
  if (/\b(bearing|ball\s*bearing)\b/i.test(`${name} ${generationPrompt}`)) return false;
  const hay = `${name || ''} ${generationPrompt} ${code}`.toLowerCase();
  if (/\b(gear|sprocket|pinion|cog)\b/.test(hay)) return true;
  if (
    /\bfor\s+i\s+in\s+range\s*\(\s*N\s*\)/.test(code) &&
    (/tooth|teeth|pitch_r|spur/i.test(code) || /gear/i.test(hay))
  ) {
    return true;
  }
  return false;
}

/** Procedural helical/spur gear for viewport (avoids fragile CadQuery STL for preview). */
function buildHelicalSpurGearProcedural(
  code: string,
  generationPrompt: string,
  name: string | undefined,
  theme: Theme,
  _materialKey: string
): THREE.Group {
  const o = parseGearParams(code, generationPrompt, name);
  const {
    teeth,
    outerRadius,
    boreRadius,
    faceWidth,
    helixAngle,
    keyway,
    color,
    metalness,
    roughness,
  } = o;

  const isLight = theme === 'light';
  const mat = (c: string, m: number, r: number, env = 1.0) =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(c),
      metalness: m,
      roughness: r,
      clearcoat: 0.15,
      clearcoatRoughness: 0.12,
      envMapIntensity: isLight ? 0.55 * env : 0.95 * env,
    });

  const bodyMat = mat(color, metalness, roughness);
  const chamferMat = mat('#8a9aaa', metalness, roughness - 0.04);
  const toothMat = mat('#6a7a8a', Math.min(1, metalness + 0.02), roughness - 0.04);
  const boreMat = mat('#1a2030', 0.55, 0.45, 0.7);
  const keyMat = mat('#0a1020', 0.45, 0.55, 0.6);
  const ringMat = mat('#b8c0c8', 0.96, 0.1);

  const group = new THREE.Group();
  const rimR = outerRadius * 0.92;

  // Annulus body (axis Y)
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rimR, 0, Math.PI * 2, false);
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
  shape.holes.push(holePath);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: faceWidth,
    bevelEnabled: false,
  });
  bodyGeo.translate(0, 0, -faceWidth / 2);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  // Top / bottom rim chamfers
  const chamferH = Math.max(0.02, faceWidth * 0.12);
  const chamTop = new THREE.Mesh(
    new THREE.CylinderGeometry(rimR * 0.96, rimR * 0.88, chamferH, 64),
    chamferMat
  );
  chamTop.position.y = faceWidth / 2 + chamferH / 2;
  chamTop.castShadow = true;
  group.add(chamTop);
  const chamBot = new THREE.Mesh(
    new THREE.CylinderGeometry(rimR * 0.88, rimR * 0.96, chamferH, 64),
    chamferMat
  );
  chamBot.position.y = -(faceWidth / 2 + chamferH / 2);
  chamBot.castShadow = true;
  group.add(chamBot);

  const toothW = outerRadius * 0.14;
  const toothH = outerRadius * 0.18;
  const toothD = faceWidth * 1.02;
  const baseR = rimR - 0.02;

  for (let i = 0; i < teeth; i++) {
    const angle = (i / teeth) * Math.PI * 2;
    const twist = helixAngle * (i / teeth);
    const x = Math.cos(angle) * baseR;
    const z = Math.sin(angle) * baseR;

    const toothGeo = new THREE.BoxGeometry(toothW, toothD, toothH);
    const tooth = new THREE.Mesh(toothGeo, toothMat);
    tooth.position.set(x, 0, z);
    tooth.rotation.y = -angle + twist;
    tooth.castShadow = true;
    group.add(tooth);

    const tipGeo = new THREE.BoxGeometry(toothW * 0.72, toothD, toothH * 0.32);
    const tip = new THREE.Mesh(tipGeo, toothMat);
    const tipR = baseR + toothH * 0.42;
    tip.position.set(Math.cos(angle) * tipR, 0, Math.sin(angle) * tipR);
    tip.rotation.y = -angle + twist;
    tip.castShadow = true;
    group.add(tip);
  }

  // Bore liner (dark)
  const boreGeo = new THREE.CylinderGeometry(
    boreRadius * 0.995,
    boreRadius * 0.995,
    faceWidth + 0.02,
    48
  );
  const bore = new THREE.Mesh(boreGeo, boreMat);
  bore.castShadow = true;
  group.add(bore);

  const bc = Math.max(0.015, faceWidth * 0.06);
  const boreChamTop = new THREE.Mesh(
    new THREE.CylinderGeometry(boreRadius + bc, boreRadius * 0.98, bc, 48),
    mat('#2a3040', 0.5, 0.5, 0.7)
  );
  boreChamTop.position.y = faceWidth / 2;
  group.add(boreChamTop);
  const boreChamBot = new THREE.Mesh(
    new THREE.CylinderGeometry(boreRadius * 0.98, boreRadius + bc, bc, 48),
    mat('#2a3040', 0.5, 0.5, 0.7)
  );
  boreChamBot.position.y = -faceWidth / 2;
  group.add(boreChamBot);

  if (keyway) {
    const keyW = boreRadius * 0.35;
    const keyH = boreRadius * 0.22;
    const keywayMesh = new THREE.Mesh(
      new THREE.BoxGeometry(keyW, faceWidth + 0.04, keyH),
      keyMat
    );
    keywayMesh.position.set(0, 0, boreRadius + keyH * 0.35);
    keywayMesh.castShadow = true;
    group.add(keywayMesh);
  }

  const ringGeo = new THREE.CylinderGeometry(
    boreRadius * 1.06,
    boreRadius * 1.06,
    Math.max(0.04, faceWidth - 0.06),
    48
  );
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.castShadow = true;
  group.add(ring);

  return group;
}

// ── Main component ────────────────────────────────────────────────────
export const Viewport3D = forwardRef<Viewport3DHandle, Props>(
    function Viewport3D(
      {
        geomData,
        scale,
        theme,
        materialKey = 'aluminum',
        wireframe = false,
        onToggleWireframe,
        modelOpacity = 1,
        generationPrompt = '',
      },
      ref
    ) {
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef     = useRef<THREE.Scene | null>(null);
    const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
    const groupRef     = useRef<THREE.Group | null>(null);
    const gridRef      = useRef<THREE.GridHelper | null>(null);
    const frameRef     = useRef<number>(0);
    const themeRef       = useRef(theme);
    const materialKeyRef = useRef(materialKey);
    const autoSpinRef    = useRef(false);
    const promptRef      = useRef('');
    const generationPromptRef = useRef(generationPrompt);
    themeRef.current     = theme;
    materialKeyRef.current = materialKey;
    generationPromptRef.current = generationPrompt;

    const [autoSpin, setAutoSpin] = useState(false);
    const [exploded, setExploded]   = useState(false);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [jsonPartStats, setJsonPartStats] = useState<{
      verts: number;
      dimensions?: { x: number; y: number; z: number };
    } | null>(null);

    useImperativeHandle(ref, () => ({
      getCameraPosition: () => cameraRef.current?.position.clone() ?? null,
      getExportRoot: () => groupRef.current ?? null,
    }));

    // ── Scene setup ──────────────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const isLight = themeRef.current === 'light';

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(isLight ? 0xdde2ee : 0x07070e);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
      camera.position.set(5, 5, 5);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.shadowMap.enabled = true;
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = isLight ? 0.96 : 0.86;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      rendererRef.current = renderer;

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      const roomEnv = new RoomEnvironment();
      const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envRT.texture;

      // Lighting — tuned for metal + thread highlights (JSON parts + STL)
      scene.add(new THREE.AmbientLight(0x334466, 1.5));
      const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
      keyLight.position.set(4, 8, 4);
      keyLight.castShadow = true;
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0x8899cc, 1.2);
      fillLight.position.set(-4, 2, -4);
      scene.add(fillLight);
      const rimLight = new THREE.DirectionalLight(0xf97316, 0.4);
      rimLight.position.set(-3, -2, 3);
      scene.add(rimLight);
      const topLight = new THREE.DirectionalLight(0xccddff, 1.8);
      topLight.position.set(0, 10, 0);
      scene.add(topLight);

      const gridColor = isLight ? 0x9ca3b8 : 0x1e1e2e;
      const grid = new THREE.GridHelper(10, 10, gridColor, gridColor);
      gridRef.current = grid;
      scene.add(grid);
      scene.add(new THREE.AxesHelper(2));

      // Mouse controls
      let isRotating = false;
      let isPanning = false;
      let prevMouse = { x: 0, y: 0 };
      const target = new THREE.Vector3(0, 0, 0);

      const onDown = (e: MouseEvent) => {
        if (e.button === 0) isRotating = true;
        if (e.button === 2) isPanning = true;
        prevMouse = { x: e.clientX, y: e.clientY };
      };
      const onUp = () => { isRotating = false; isPanning = false; };
      const onMove = (e: MouseEvent) => {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        prevMouse = { x: e.clientX, y: e.clientY };
        if (isRotating) {
          const offset = camera.position.clone().sub(target);
          const radius = offset.length();
          let theta = Math.atan2(offset.x, offset.z);
          let phi   = Math.acos(Math.min(Math.max(offset.y / radius, -1), 1));
          theta -= dx * 0.01;
          phi   -= dy * 0.01;
          phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));
          camera.position.set(
            target.x + radius * Math.sin(phi) * Math.sin(theta),
            target.y + radius * Math.cos(phi),
            target.z + radius * Math.sin(phi) * Math.cos(theta),
          );
          camera.lookAt(target);
        }
        if (isPanning) {
          const panSpeed = 0.01;
          const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
          const up    = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
          camera.position.add(right.multiplyScalar(-dx * panSpeed));
          camera.position.add(up.multiplyScalar(dy * panSpeed));
          target.add(right.multiplyScalar(-dx * panSpeed));
        }
      };
      const onWheel = (e: WheelEvent) => {
        const offset = camera.position.clone().sub(target);
        const radius = offset.length() * (1 + e.deltaY * 0.001);
        camera.position.copy(offset.normalize().multiplyScalar(Math.max(0.5, radius)));
      };

      canvas.addEventListener('mousedown', onDown);
      window.addEventListener('mouseup', onUp);
      canvas.addEventListener('mousemove', onMove);
      canvas.addEventListener('wheel', onWheel);
      canvas.addEventListener('contextmenu', e => e.preventDefault());

      const animate = () => {
        frameRef.current = requestAnimationFrame(animate);
        if (autoSpinRef.current && groupRef.current) {
          groupRef.current.rotation.y += 0.005;
        }
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        if (!canvasRef.current) return;
        const c = canvasRef.current;
        cameraRef.current!.aspect = c.clientWidth / c.clientHeight;
        cameraRef.current!.updateProjectionMatrix();
        rendererRef.current!.setSize(c.clientWidth, c.clientHeight);
      };
      window.addEventListener('resize', onResize);

      return () => {
        cancelAnimationFrame(frameRef.current);
        window.removeEventListener('resize', onResize);
        canvas.removeEventListener('mousedown', onDown);
        window.removeEventListener('mouseup', onUp);
        canvas.removeEventListener('mousemove', onMove);
        canvas.removeEventListener('wheel', onWheel);
        scene.environment = null;
        envRT.dispose();
        pmremGenerator.dispose();
        renderer.dispose();
        scene.clear();
      };
    }, []);

    // ── Theme change (background / grid / exposure) ─────────────────
    useEffect(() => {
      const scene = sceneRef.current;
      const grid  = gridRef.current;
      const renderer = rendererRef.current;
      const isLight = theme === 'light';

      if (renderer) {
        renderer.toneMappingExposure = isLight ? 0.96 : 0.86;
      }

      if (scene && grid) {
        scene.background = new THREE.Color(isLight ? 0xdde2ee : 0x07070e);
        scene.remove(grid);
        grid.geometry.dispose();
        const lc = isLight ? 0x9ca3b8 : 0x1e1e2e;
        const newGrid = new THREE.GridHelper(10, 10, lc, lc);
        gridRef.current = newGrid;
        scene.add(newGrid);
      }
    }, [theme]);

    // ── STL material (theme + material picker) ─────────────────────
    useEffect(() => {
      groupRef.current?.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData.isStlMetal) {
          applyStlPbrTheme(obj, theme, materialKey);
        }
      });
    }, [theme, materialKey]);

    // ── Render JSCAD code ────────────────────────────────────────────
    useEffect(() => {
      const scene = sceneRef.current;
      if (!scene) return;

      // Clear old group
      if (groupRef.current) {
        scene.remove(groupRef.current);
        groupRef.current.traverse(obj => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else (obj.material as THREE.Material).dispose();
          }
        });
        groupRef.current = null;
      }
      setJsonPartStats(null);
      setRenderError(null);
      setExploded(false);

      if (!geomData) return;

      // Reset camera to default position so model appears centered
      if (cameraRef.current) {
        cameraRef.current.position.set(5, 5, 5);
        cameraRef.current.lookAt(0, 0, 0);
      }

      // Procedural JSON from AI — render primitives only (no CadQuery / JSCAD)
      if (Array.isArray(geomData.parts) && geomData.parts.length > 0) {
        try {
          const { group: inner, vertexCount } = buildMeshFromParts(geomData.parts);
          setJsonPartStats({
            verts: vertexCount,
            dimensions: geomData.dimensions,
          });
          const wrapper = new THREE.Group();
          wrapper.add(inner);
          wrapper.rotation.z = 0.2;
          wrapper.scale.set(scale.x, scale.y, scale.z);
          scene.add(wrapper);
          groupRef.current = wrapper;
        } catch (err) {
          console.error('[Viewport3D] JSON parts render failed:', err);
          setRenderError((err as Error).message || 'Parts render failed');
        }
        return;
      }

      // CadQuery pipeline returns STL; render mesh directly (code is Python, not JSCAD)
      if (geomData.stl && geomData.stl.length > 20) {
        try {
          // Prefer real CadQuery STL so the viewport matches the solver output.
          // If load fails, fall back to procedural previews (bolt / gear) when prompts match.
          let usedStl = false;
          let stlLoadError: Error | null = null;
          try {
            const group = loadStlBase64(
              geomData.stl,
              themeRef.current,
              materialKeyRef.current
            );
            group.rotation.z = 0.2;
            group.scale.set(scale.x, scale.y, scale.z);
            scene.add(group);
            groupRef.current = group;
            usedStl = true;
          } catch (e) {
            stlLoadError = e instanceof Error ? e : new Error(String(e));
            console.warn('[Viewport3D] STL load failed, trying procedural fallback:', stlLoadError);
          }

          if (usedStl) {
            return;
          }

          if (
            isBoltPromptOrCode(
              geomData.code || '',
              geomData.name,
              generationPromptRef.current
            )
          ) {
            console.log('[Viewport3D] Bolt — procedural fallback after STL failure');
            const boltGroup = buildBoltProcedural(
              geomData.code || '',
              themeRef.current,
              materialKeyRef.current
            );
            const wrapper = new THREE.Group();
            wrapper.add(boltGroup);
            wrapper.rotation.z = 0.2;
            wrapper.scale.set(scale.x, scale.y, scale.z);
            scene.add(wrapper);
            groupRef.current = wrapper;
            return;
          }

          if (
            isGearPromptOrCode(
              geomData.code || '',
              geomData.name,
              generationPromptRef.current
            )
          ) {
            console.log('[Viewport3D] Gear — procedural fallback after STL failure');
            const gearGroup = buildHelicalSpurGearProcedural(
              geomData.code || '',
              generationPromptRef.current,
              geomData.name,
              themeRef.current,
              materialKeyRef.current
            );
            const wrapper = new THREE.Group();
            wrapper.add(gearGroup);
            wrapper.rotation.y = 0.35;
            wrapper.rotation.z = 0.15;
            wrapper.scale.set(scale.x, scale.y, scale.z);
            scene.add(wrapper);
            groupRef.current = wrapper;
            return;
          }

          throw new Error(
            stlLoadError?.message || 'Could not load STL mesh. Check the browser console.'
          );
        } catch (err) {
          console.error('[Viewport3D] STL render failed:', err);
          setRenderError((err as Error).message || 'STL load failed');
        }
        return;
      }

      if (!geomData.code?.trim()) return;

      try {
        const jscad = (window as unknown as { jscadModeling: unknown }).jscadModeling;
        if (!jscad) throw new Error('JSCAD library not loaded yet');

        const group = new THREE.Group();
        const type  = detectType(promptRef.current);

        if (type === 'bearing') {
          const components = buildBearingComponents(geomData.code);
          const scale3 = 3.0 / 52; // normalize to outerD 52 default
          for (const { geom, mat } of components) {
            const geo = jscadToThree(geom);
            geo.computeVertexNormals();
            geo.scale(scale3, scale3, scale3);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = mesh.receiveShadow = true;
            group.add(mesh);
          }
          group.rotation.x = -Math.PI / 2;
        } else {
          const geom = runCode(geomData.code);
          const geo  = jscadToThree(geom);
          geo.computeVertexNormals();
          centerAndScale(geo);

          const theme2  = PART_THEMES[type] || PART_THEMES.default;
          const matOpts = theme2.body || Object.values(theme2)[0];
          const mat     = makeMat(matOpts);
          const mesh    = new THREE.Mesh(geo, mat);
          mesh.castShadow = mesh.receiveShadow = true;
          group.add(mesh);

          const flatTypes = ['gear', 'plate'];
          if (flatTypes.includes(type)) group.rotation.x = -Math.PI / 2;
        }

        group.rotation.z = 0.2;
        group.scale.set(scale.x, scale.y, scale.z);
        scene.add(group);
        groupRef.current = group;
      } catch (err) {
        console.error('[Viewport3D] JSCAD render failed:', err);
        setRenderError((err as Error).message || 'Render failed');
      }
      // Scale is applied in a separate effect so we don't re-execute JSCAD on slider moves
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geomData, generationPrompt]);

    // ── Scale update ─────────────────────────────────────────────────
    useEffect(() => {
      if (groupRef.current) groupRef.current.scale.set(scale.x, scale.y, scale.z);
    }, [scale.x, scale.y, scale.z]);

    // ── Wireframe + opacity (also after theme recreates STL materials) ─
    useEffect(() => {
      if (groupRef.current) applyMeshDisplay(groupRef.current, wireframe, modelOpacity);
    }, [wireframe, modelOpacity, theme, materialKey]);

    // ── Explode toggle (bearing only) ─────────────────────────────────
    const handleExplode = () => {
      if (!groupRef.current) return;
      const children = groupRef.current.children;
      const nextExploded = !exploded;
      setExploded(nextExploded);
      children.forEach((child, i) => {
        const target = nextExploded ? { y: i * 0.4 } : { y: 0 };
        const start  = child.position.y;
        const t0     = performance.now();
        const step   = (now: number) => {
          const p = Math.min((now - t0) / 600, 1);
          const e = p < 0.5 ? 2*p*p : -1+(4-2*p)*p;
          child.position.y = start + (target.y - start) * e;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    };

    // ── Reset view ────────────────────────────────────────────────────
    const handleReset = () => {
      if (cameraRef.current) {
        cameraRef.current.position.set(5, 5, 5);
        cameraRef.current.lookAt(0, 0, 0);
      }
    };

    // ── Auto-spin toggle ──────────────────────────────────────────────
    const handleSpin = () => {
      setAutoSpin(s => {
        autoSpinRef.current = !s;
        return !s;
      });
    };

    const btnStyle: React.CSSProperties = {
      background: '#12121c',
      border: '1px solid #1e1e2e',
      borderRadius: 6,
      padding: '6px 10px',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 10,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    };

    return (
      <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <canvas ref={canvasRef} id="three-canvas" className="three-canvas" />

        {/* JSON parts: bbox + vertex stats (ids for integrations / debugging) */}
        {jsonPartStats && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 12,
              zIndex: 10,
              fontSize: 10,
              fontFamily: "'IBM Plex Mono', monospace",
              color: 'var(--text-muted)',
              textAlign: 'right',
              lineHeight: 1.5,
              pointerEvents: 'none',
            }}
          >
            {jsonPartStats.dimensions && (
              <>
                <div id="dim-x">X: {jsonPartStats.dimensions.x} mm</div>
                <div id="dim-y">Y: {jsonPartStats.dimensions.y} mm</div>
                <div id="dim-z">Z: {jsonPartStats.dimensions.z} mm</div>
              </>
            )}
            <div id="dim-v">Vertices: {jsonPartStats.verts.toLocaleString()}</div>
          </div>
        )}

        {/* Error overlay */}
        {renderError && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'rgba(0,0,0,0.9)', border: '1px solid #f97316',
            borderRadius: 8, padding: '1rem 1.5rem', maxWidth: '80%',
            color: '#f97316', fontSize: '0.8rem', textAlign: 'center',
            pointerEvents: 'none',
          }}>
            ⚠️ {renderError}
          </div>
        )}

        {/* Viewport controls */}
        <div style={{
          position: 'absolute', bottom: 60, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', gap: 6, zIndex: 10,
          maxWidth: 'min(90vw, 760px)',
          overflowX: 'auto',
          paddingBottom: 2,
        }}>
          <button onClick={handleSpin} style={{ ...btnStyle, color: '#7eb8f7' }}>
            {autoSpin ? '⏹ Stop' : '▶ Auto Spin'}
          </button>
          <button onClick={handleExplode} style={{ ...btnStyle, color: '#f97316' }}>
            {exploded ? '🔧 Assemble' : '💥 Explode'}
          </button>
          <button
            onClick={() => onToggleWireframe?.()}
            title={wireframe ? 'Show shaded solid' : 'Show wireframe'}
            style={{
              ...btnStyle,
              color: wireframe ? '#c4b5fd' : '#a78bfa',
              borderColor: wireframe ? 'rgba(167,139,250,0.45)' : 'rgba(167,139,250,0.28)',
              background: wireframe ? 'rgba(139,92,246,0.12)' : '#12121c',
            }}
          >
            {wireframe ? '◇ Solid' : '▢ Wireframe'}
          </button>
          <button onClick={handleReset} style={{ ...btnStyle, color: '#5ab85a' }}>
            ↺ Reset View
          </button>
        </div>
      </div>
    );
  }
);
