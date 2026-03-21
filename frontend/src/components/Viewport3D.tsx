import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import * as THREE from 'three';
import type { Theme } from '../context/ThemeContext';
import type { GeomData } from '../types';

export type Viewport3DHandle = {
  getCameraPosition: () => THREE.Vector3 | null;
};

type Props = {
  geomData: GeomData | null;
  scale: { x: number; y: number; z: number };
  theme: Theme;
};

function disposeGridHelper(grid: THREE.GridHelper) {
  grid.geometry.dispose();
  const mat = grid.material;
  if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
  else mat.dispose();
}

export const Viewport3D = forwardRef<Viewport3DHandle, Props>(
  function Viewport3D({ geomData, scale, theme }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const meshRef = useRef<THREE.Mesh | null>(null);
    const gridHelperRef = useRef<THREE.GridHelper | null>(null);
    const frameRef = useRef<number>(0);
    const themeRef = useRef(theme);
    themeRef.current = theme;

    useImperativeHandle(ref, () => ({
      getCameraPosition: () => cameraRef.current?.position.clone() ?? null,
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const scene = new THREE.Scene();
      const isLightInit = themeRef.current === 'light';
      scene.background = new THREE.Color(isLightInit ? 0xdde2ee : 0x07070e);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(
        45,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        1000
      );
      camera.position.set(5, 5, 5);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      rendererRef.current = renderer;

      scene.add(new THREE.AmbientLight(0x334466, 2));
      const d1 = new THREE.DirectionalLight(0x7eb8f7, 3);
      d1.position.set(5, 8, 5);
      scene.add(d1);
      const d2 = new THREE.DirectionalLight(0xf97316, 1);
      d2.position.set(-5, -3, -5);
      scene.add(d2);
      const gridColor = isLightInit ? 0x9ca3b8 : 0x1e1e2e;
      const grid = new THREE.GridHelper(10, 10, gridColor, gridColor);
      gridHelperRef.current = grid;
      scene.add(grid);
      scene.add(new THREE.AxesHelper(2));

      let isRotating = false;
      let isPanning = false;
      let prevMouse = { x: 0, y: 0 };

      const onDown = (e: MouseEvent) => {
        if (e.button === 0) isRotating = true;
        if (e.button === 2) isPanning = true;
        prevMouse = { x: e.clientX, y: e.clientY };
      };
      const onUp = () => {
        isRotating = false;
        isPanning = false;
      };
      const onMove = (e: MouseEvent) => {
        const deltaX = e.clientX - prevMouse.x;
        const deltaY = e.clientY - prevMouse.y;
        prevMouse = { x: e.clientX, y: e.clientY };

        if (isRotating) {
          const rotateSpeed = 0.01;
          const offset = camera.position.clone().sub(new THREE.Vector3(0, 0, 0));
          const radius = offset.length();
          let theta = Math.atan2(offset.x, offset.z);
          let phi = Math.acos(Math.min(Math.max(offset.y / radius, -1), 1));
          theta -= deltaX * rotateSpeed;
          phi -= deltaY * rotateSpeed;
          phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));
          camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
          camera.position.y = radius * Math.cos(phi);
          camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
          camera.lookAt(0, 0, 0);
        }
        if (isPanning) {
          const panSpeed = 0.01;
          const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
          const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
          camera.position.add(right.multiplyScalar(-deltaX * panSpeed));
          camera.position.add(up.multiplyScalar(deltaY * panSpeed));
        }
      };
      const onWheel = (e: WheelEvent) => {
        const zoomSpeed = 0.001;
        const offset = camera.position.clone().sub(new THREE.Vector3(0, 0, 0));
        const radius = offset.length() * (1 + e.deltaY * zoomSpeed);
        camera.position.copy(offset.normalize().multiplyScalar(Math.max(1, radius)));
      };

      canvas.addEventListener('mousedown', onDown);
      window.addEventListener('mouseup', onUp);
      canvas.addEventListener('mousemove', onMove);
      canvas.addEventListener('wheel', onWheel);
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      const animate = () => {
        frameRef.current = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        if (!canvasRef.current || !cameraRef.current || !rendererRef.current)
          return;
        const c = canvasRef.current;
        cameraRef.current.aspect = c.clientWidth / c.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(c.clientWidth, c.clientHeight);
      };
      window.addEventListener('resize', onResize);

      return () => {
        cancelAnimationFrame(frameRef.current);
        window.removeEventListener('resize', onResize);
        canvas.removeEventListener('mousedown', onDown);
        window.removeEventListener('mouseup', onUp);
        canvas.removeEventListener('mousemove', onMove);
        canvas.removeEventListener('wheel', onWheel);
        gridHelperRef.current = null;
        renderer.dispose();
        scene.clear();
      };
    }, []);

    useEffect(() => {
      const scene = sceneRef.current;
      const grid = gridHelperRef.current;
      if (!scene || !grid) return;

      const isLight = theme === 'light';
      scene.background = new THREE.Color(isLight ? 0xdde2ee : 0x07070e);

      scene.remove(grid);
      disposeGridHelper(grid);

      const lineColor = isLight ? 0x9ca3b8 : 0x1e1e2e;
      const newGrid = new THREE.GridHelper(10, 10, lineColor, lineColor);
      gridHelperRef.current = newGrid;
      scene.add(newGrid);
    }, [theme]);

    useEffect(() => {
      const scene = sceneRef.current;
      if (!scene) return;

      if (meshRef.current) {
        scene.remove(meshRef.current);
        meshRef.current.geometry.dispose();
        (meshRef.current.material as THREE.Material).dispose();
        meshRef.current = null;
      }

      if (!geomData) return;

      let geometry: THREE.BufferGeometry;
      if (geomData.type === 'box') {
        const g = geomData as GeomData & {
          width?: number;
          height?: number;
          depth?: number;
        };
        geometry = new THREE.BoxGeometry(
          g.width ?? 1,
          g.height ?? 1,
          g.depth ?? 1
        );
      } else {
        geometry = new THREE.TorusKnotGeometry(0.5, 0.2, 100, 16);
      }

      const material = new THREE.MeshStandardMaterial({
        color: 0x7eb8f7,
        metalness: 0.8,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(scale.x, scale.y, scale.z);
      scene.add(mesh);
      meshRef.current = mesh;
    }, [geomData]);

    useEffect(() => {
      const mesh = meshRef.current;
      if (mesh) mesh.scale.set(scale.x, scale.y, scale.z);
    }, [scale.x, scale.y, scale.z]);

    return <canvas ref={canvasRef} id="three-canvas" className="three-canvas" />;
  }
);
