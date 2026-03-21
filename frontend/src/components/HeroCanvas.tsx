import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/** Background 3D hero (gear) for the marketing landing page — single Three instance here only. */
export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(3, 3, 3);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene.add(new THREE.AmbientLight(0x7eb8f7, 1));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 0.4, 32),
      new THREE.MeshStandardMaterial({
        color: 0x222233,
        metalness: 0.8,
        roughness: 0.2,
      })
    );
    group.add(core);

    for (let i = 0; i < 12; i++) {
      const tooth = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.4, 0.3),
        new THREE.MeshStandardMaterial({
          color: 0x7eb8f7,
          metalness: 0.9,
          roughness: 0.1,
        })
      );
      const angle = (i / 12) * Math.PI * 2;
      tooth.position.set(Math.cos(angle) * 0.9, 0, Math.sin(angle) * 0.9);
      tooth.rotation.y = -angle;
      group.add(tooth);
    }
    scene.add(group);

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      group.rotation.y += 0.005;
      group.rotation.x += 0.002;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      scene.clear();
    };
  }, []);

  return <canvas ref={canvasRef} id="hero-canvas" className="hero-canvas" aria-hidden />;
}
