import type { Object3D } from 'three';

/** Client-side mesh export from the viewport Three.js root (binary STL). */
export async function exportMeshToStlBlob(root: Object3D): Promise<Blob> {
  const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
  const exp = new STLExporter();
  const result = exp.parse(root, { binary: true });
  return new Blob([result as ArrayBuffer], { type: 'model/stl' });
}

export async function exportMeshToObjBlob(root: Object3D): Promise<Blob> {
  const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js');
  const exp = new OBJExporter();
  const text = exp.parse(root);
  return new Blob([text], { type: 'model/obj' });
}

export async function exportMeshToGlbBlob(root: Object3D): Promise<Blob> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const exp = new GLTFExporter();
  const data = await exp.parseAsync(root, { binary: true });
  return new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' });
}
