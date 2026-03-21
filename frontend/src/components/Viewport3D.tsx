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
import type { GeomData } from '../types';

// ── Types ────────────────────────────────────────────────────────────
export type Viewport3DHandle = {
  getCameraPosition: () => THREE.Vector3 | null;
};

type Props = {
  geomData: GeomData | null;
  scale: { x: number; y: number; z: number };
  theme: Theme;
  /** Viewport PBR preset — keys match MATERIALS_DB in constants */
  materialKey?: string;
  wireframe?: boolean;
  /** 0–1 mesh opacity (1 = solid) */
  modelOpacity?: number;
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

  // Center and scale to fit viewport loosely
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const pivotY = box.min.y;

  mesh.position.set(-center.x, -pivotY, -center.z);

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

// ── Main component ────────────────────────────────────────────────────
export const Viewport3D = forwardRef<Viewport3DHandle, Props>(
    function Viewport3D(
      { geomData, scale, theme, materialKey = 'aluminum', wireframe = false, modelOpacity = 1 },
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
    themeRef.current     = theme;
    materialKeyRef.current = materialKey;

    const [autoSpin, setAutoSpin] = useState(false);
    const [exploded, setExploded]   = useState(false);
    const [renderError, setRenderError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      getCameraPosition: () => cameraRef.current?.position.clone() ?? null,
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

      // Lighting
      scene.add(new THREE.AmbientLight(0x334466, 2));
      const d1 = new THREE.DirectionalLight(0x7eb8f7, 3);
      d1.position.set(5, 8, 5);
      d1.castShadow = true;
      scene.add(d1);
      const d2 = new THREE.DirectionalLight(0xf97316, 1.5);
      d2.position.set(-5, -3, -5);
      scene.add(d2);
      const d3 = new THREE.DirectionalLight(0xffffff, 1);
      d3.position.set(0, -8, 0);
      scene.add(d3);

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
      setRenderError(null);
      setExploded(false);

      if (!geomData) return;

      // CadQuery pipeline returns STL; render mesh directly (code is Python, not JSCAD)
      if (geomData.stl && geomData.stl.length > 20) {
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
    }, [geomData]);

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
      padding: '6px 14px',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 11,
      cursor: 'pointer',
    };

    return (
      <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <canvas ref={canvasRef} id="three-canvas" className="three-canvas" />

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
          display: 'flex', gap: 8, zIndex: 10,
        }}>
          <button onClick={handleSpin} style={{ ...btnStyle, color: '#7eb8f7' }}>
            {autoSpin ? '⏹ Stop' : '▶ Auto Spin'}
          </button>
          <button onClick={handleExplode} style={{ ...btnStyle, color: '#f97316' }}>
            {exploded ? '🔧 Assemble' : '💥 Explode'}
          </button>
          <button onClick={handleReset} style={{ ...btnStyle, color: '#5ab85a' }}>
            ↺ Reset View
          </button>
        </div>
      </div>
    );
  }
);
