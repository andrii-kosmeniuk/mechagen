'use strict';

/**
 * Export Service — Phase 2
 *
 * Converts preview part data (GeomPart[]) to downloadable formats:
 *   - OBJ  (text)
 *   - GLB  (binary GLTF 2.0)
 *
 * Design: purely procedural — no Three.js on Node side.
 * OBJ: written manually from box/cylinder primitives.
 * GLB: uses the minimal GLTF 2.0 binary spec (header + JSON + BIN chunks).
 */

const { randomUUID } = require('crypto');
const path  = require('path');
const fs    = require('fs');

const EXPORTS_DIR = path.join(__dirname, '../../uploads/exports');
if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });

/** In-memory export record store */
const exportStore = new Map();

// ─── OBJ Generation ─────────────────────────────────────────────────────────

/**
 * Generate tessellated vertices for a box.
 * Returns { positions: number[][], faces: number[][] }
 */
function tessellateBox(w, h, d) {
  const hw = w / 2, hh = h / 2, hd = d / 2;
  // 8 corners
  const v = [
    [-hw, -hh, -hd], [ hw, -hh, -hd], [ hw,  hh, -hd], [-hw,  hh, -hd],
    [-hw, -hh,  hd], [ hw, -hh,  hd], [ hw,  hh,  hd], [-hw,  hh,  hd],
  ];
  // 6 faces (2 triangles each), vertex indices
  const faces = [
    [0,1,2],[0,2,3], // front (z-)
    [5,4,7],[5,7,6], // back (z+)
    [4,0,3],[4,3,7], // left (x-)
    [1,5,6],[1,6,2], // right (x+)
    [3,2,6],[3,6,7], // top (y+)
    [4,5,1],[4,1,0], // bottom (y-)
  ];
  return { v, faces };
}

/**
 * Generate tessellated vertices for a cylinder (16-sided approximation).
 */
function tessellateCylinder(rTop, rBot, h, segs = 16) {
  const verts = [];
  const faces = [];

  // Top cap center
  verts.push([0, h / 2, 0]);
  // Bottom cap center
  verts.push([0, -h / 2, 0]);

  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const cos = Math.cos(a), sin = Math.sin(a);
    verts.push([cos * rTop, h / 2, sin * rTop]); // top ring: index 2+i
    verts.push([cos * rBot, -h / 2, sin * rBot]); // bot ring: index 2+segs+i
  }

  const topBase = 2;
  const botBase = 2 + segs;

  for (let i = 0; i < segs; i++) {
    const next = (i + 1) % segs;
    const t0 = topBase + i, t1 = topBase + next;
    const b0 = botBase + i, b1 = botBase + next;
    // Side quads (2 triangles)
    faces.push([t0, b0, b1]);
    faces.push([t0, b1, t1]);
    // Top cap
    faces.push([0, t1, t0]);
    // Bottom cap
    faces.push([1, b0, b1]);
  }

  return { v: verts, faces };
}

function applyTransform(verts, pos, rot) {
  const px = pos?.x || 0, py = pos?.y || 0, pz = pos?.z || 0;
  const rx = rot?.x || 0, ry = rot?.y || 0, rz = rot?.z || 0;
  const sr = Math.sin(rx), cr = Math.cos(rx);
  const sp = Math.sin(ry), cp = Math.cos(ry);
  const sy = Math.sin(rz), cy = Math.cos(rz);
  return verts.map(([x, y, z]) => {
    // Rotate Z
    const x1 = x * cy - y * sy, y1 = x * sy + y * cy, z1 = z;
    // Rotate Y
    const x2 = x1 * cp + z1 * sp, y2 = y1, z2 = -x1 * sp + z1 * cp;
    // Rotate X
    const x3 = x2, y3 = y2 * cr - z2 * sr, z3 = y2 * sr + z2 * cr;
    return [x3 + px, y3 + py, z3 + pz];
  });
}

/**
 * Build OBJ text from an array of GeomPart objects.
 */
function buildObjFromParts(parts, name = 'mechagen_part') {
  const lines = [
    `# MechaGen export — ${name}`,
    `# Generated: ${new Date().toISOString()}`,
    '',
    `o ${name}`,
    '',
  ];

  let globalVertexOffset = 1; // OBJ is 1-indexed

  for (const part of parts) {
    const p = part.params || {};
    let tessResult;

    const shape = (part.shape || 'box').toLowerCase();
    if (shape === 'box') {
      const w = p.width || p.w || 1;
      const h = p.height || p.h || 1;
      const d = p.depth || p.d || 1;
      tessResult = tessellateBox(w, h, d);
    } else if (shape === 'cylinder') {
      const rt = p.radiusTop   ?? p.r ?? 0.5;
      const rb = p.radiusBottom ?? p.r ?? 0.5;
      const h  = p.height || p.h || 1;
      tessResult = tessellateCylinder(rt, rb, h);
    } else {
      // Default box for unsupported shapes
      tessResult = tessellateBox(1, 1, 1);
    }

    const transformed = applyTransform(tessResult.v, part.position, part.rotation);

    lines.push(`# ${part.label || shape}`);
    for (const [x, y, z] of transformed) {
      lines.push(`v ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`);
    }
    lines.push('');

    for (const face of tessResult.faces) {
      const fi = face.map(i => i + globalVertexOffset);
      lines.push(`f ${fi.join(' ')}`);
    }
    lines.push('');

    globalVertexOffset += tessResult.v.length;
  }

  return lines.join('\n');
}

// ─── GLB Generation ─────────────────────────────────────────────────────────

/**
 * Build a minimal GLTF 2.0 JSON + binary (GLB format).
 * Each part becomes a separate mesh in the scene.
 */
function buildGlbFromParts(parts, name = 'mechagen_part') {
  // Collect all vertex/index data
  const meshes = [];

  for (const part of parts) {
    const p = part.params || {};
    const shape = (part.shape || 'box').toLowerCase();

    let tessResult;
    if (shape === 'cylinder') {
      const rt = p.radiusTop ?? p.r ?? 0.5;
      const rb = p.radiusBottom ?? p.r ?? 0.5;
      const h  = p.height || p.h || 1;
      tessResult = tessellateCylinder(rt, rb, h, 24);
    } else {
      const w = p.width || p.w || 1;
      const h = p.height || p.h || 1;
      const d = p.depth || p.d || 1;
      tessResult = tessellateBox(w, h, d);
    }

    const transformed = applyTransform(tessResult.v, part.position, part.rotation);

    // Flatten vertices to Float32Array
    const positions = new Float32Array(transformed.length * 3);
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    transformed.forEach(([x, y, z], i) => {
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      min = [Math.min(min[0], x), Math.min(min[1], y), Math.min(min[2], z)];
      max = [Math.max(max[0], x), Math.max(max[1], y), Math.max(max[2], z)];
    });

    // Flatten indices to Uint16Array (or Uint32 if > 65535 verts)
    const flatFaces = [];
    for (const face of tessResult.faces) flatFaces.push(...face);
    const indices = flatFaces.length > 0
      ? (transformed.length > 65535
          ? new Uint32Array(flatFaces)
          : new Uint16Array(flatFaces))
      : new Uint16Array([]);

    // Parse hex color → r/g/b normalized floats
    const hex = (part.color || '#7eb8f7').replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    meshes.push({
      label: part.label || shape,
      positions,
      indices,
      min, max,
      color: [r, g, b],
      metalness: part.metalness ?? 0.75,
      roughness: part.roughness ?? 0.25,
      useU32: transformed.length > 65535,
    });
  }

  // Build binary buffer (all bufferViews concatenated, 4-byte aligned)
  const buffers = [];
  const bufferViews = [];
  const accessors  = [];
  const materials  = [];
  const gltfMeshes = [];
  const nodes      = [];

  let byteOffset = 0;

  function align4(n) { return Math.ceil(n / 4) * 4; }

  for (let mi = 0; mi < meshes.length; mi++) {
    const mesh = meshes[mi];

    // positions buffer view
    const posBuf     = Buffer.from(mesh.positions.buffer);
    const posAligned = align4(posBuf.length);
    const posView    = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: posBuf.length,
    });
    buffers.push({ data: posBuf, padded: posAligned });
    byteOffset += posAligned;

    // indices buffer view
    const idxBuf     = Buffer.from(mesh.indices.buffer);
    const idxAligned = align4(idxBuf.length);
    const idxView    = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: idxBuf.length,
    });
    buffers.push({ data: idxBuf, padded: idxAligned });
    byteOffset += idxAligned;

    const posAccessor = accessors.length;
    accessors.push({
      bufferView: posView,
      byteOffset: 0,
      componentType: 5126, // FLOAT
      count: mesh.positions.length / 3,
      type: 'VEC3',
      min: mesh.min,
      max: mesh.max,
    });

    const idxAccessor = accessors.length;
    accessors.push({
      bufferView: idxView,
      byteOffset: 0,
      componentType: mesh.useU32 ? 5125 : 5123, // UINT32 or UINT16
      count: mesh.indices.length,
      type: 'SCALAR',
    });

    const matIdx = materials.length;
    materials.push({
      name: mesh.label,
      pbrMetallicRoughness: {
        baseColorFactor: [mesh.color[0], mesh.color[1], mesh.color[2], 1.0],
        metallicFactor: mesh.metalness,
        roughnessFactor: mesh.roughness,
      },
    });

    gltfMeshes.push({
      name: mesh.label,
      primitives: [{
        attributes: { POSITION: posAccessor },
        indices: idxAccessor,
        material: matIdx,
      }],
    });

    nodes.push({ mesh: mi, name: mesh.label });
  }

  // Combine all binary buffers into one
  const parts2 = [];
  let totalBin = 0;
  for (const b of buffers) {
    parts2.push(b.data);
    if (b.padded > b.data.length) {
      parts2.push(Buffer.alloc(b.padded - b.data.length, 0));
    }
    totalBin += b.padded;
  }
  const binChunk = Buffer.concat(parts2);

  const gltfJson = {
    asset: { version: '2.0', generator: 'MechaGen Phase 2' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i), name }],
    nodes,
    meshes: gltfMeshes,
    accessors,
    bufferViews,
    materials,
    buffers: [{ byteLength: totalBin }],
  };

  const jsonStr    = JSON.stringify(gltfJson);
  const jsonBytes  = Buffer.from(jsonStr, 'utf8');
  const jsonAligned = align4(jsonBytes.length);
  const jsonChunk  = Buffer.concat([jsonBytes, Buffer.alloc(jsonAligned - jsonBytes.length, 0x20)]);

  // GLB header: magic(4) + version(4) + length(4) = 12 bytes
  // JSON chunk: length(4) + type(4) + data
  // BIN chunk:  length(4) + type(4) + data
  const totalLen = 12 + 8 + jsonChunk.length + (binChunk.length > 0 ? 8 + binChunk.length : 0);
  const header   = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // magic: 'glTF'
  header.writeUInt32LE(2, 4);           // version: 2
  header.writeUInt32LE(totalLen, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // type: 'JSON'

  const parts3 = [header, jsonChunkHeader, jsonChunk];

  if (binChunk.length > 0) {
    const binChunkHeader = Buffer.alloc(8);
    binChunkHeader.writeUInt32LE(binChunk.length, 0);
    binChunkHeader.writeUInt32LE(0x004E4942, 4); // type: 'BIN\0'
    parts3.push(binChunkHeader, binChunk);
  }

  return Buffer.concat(parts3);
}

// ─── Export Readiness & Dispatch ────────────────────────────────────────────

/**
 * Check if a generation is ready to export.
 */
function checkExportReadiness(generation) {
  if (!generation) return { canExport: false, reason: 'Generation not found', formats: [] };

  if (generation.status !== 'ready') {
    return { canExport: false, reason: `Generation status is "${generation.status}" — must be "ready"`, formats: [] };
  }
  if (!generation.previewParts || generation.previewParts.length === 0) {
    return { canExport: false, reason: 'No preview parts to export', formats: [] };
  }
  if (generation.validationReport?.severity === 'high') {
    return {
      canExport: false,
      reason: 'Validation severity is HIGH — repair before exporting',
      formats: [],
    };
  }
  return {
    canExport: true,
    reason: null,
    formats: ['obj', 'glb'],
  };
}

/**
 * Export a generation's preview parts to OBJ and save to disk.
 * Returns { exportId, filePath, fileUrl, fileSize }
 */
function exportGenerationToObj(generation) {
  const readiness = checkExportReadiness(generation);
  if (!readiness.canExport) throw Object.assign(new Error(readiness.reason), { status: 400 });

  const name    = `${(generation.specJson?.partType || 'part').replace(/_/g, '_')}`;
  const content = buildObjFromParts(generation.previewParts, name);
  const buf     = Buffer.from(content, 'utf8');

  const exportId = randomUUID();
  const fileName = `${name}_${exportId.slice(0, 8)}.obj`;
  const filePath = path.join(EXPORTS_DIR, fileName);
  fs.writeFileSync(filePath, buf);

  const record = {
    id:           exportId,
    generationId: generation.id,
    type:         'obj',
    fileName,
    fileUrl:      `/uploads/exports/${fileName}`,
    fileSize:     buf.length,
    status:       'ready',
    createdAt:    new Date().toISOString(),
  };
  exportStore.set(exportId, record);
  return record;
}

/**
 * Export a generation's preview parts to GLB and save to disk.
 * Returns { exportId, filePath, fileUrl, fileSize }
 */
function exportGenerationToGlb(generation) {
  const readiness = checkExportReadiness(generation);
  if (!readiness.canExport) throw Object.assign(new Error(readiness.reason), { status: 400 });

  const name   = `${(generation.specJson?.partType || 'part').replace(/_/g, '_')}`;
  const buf    = buildGlbFromParts(generation.previewParts, name);

  const exportId = randomUUID();
  const fileName = `${name}_${exportId.slice(0, 8)}.glb`;
  const filePath = path.join(EXPORTS_DIR, fileName);
  fs.writeFileSync(filePath, buf);

  const record = {
    id:           exportId,
    generationId: generation.id,
    type:         'glb',
    fileName,
    fileUrl:      `/uploads/exports/${fileName}`,
    fileSize:     buf.length,
    status:       'ready',
    createdAt:    new Date().toISOString(),
  };
  exportStore.set(exportId, record);
  return record;
}

function getExportsForGeneration(generationId) {
  return Array.from(exportStore.values()).filter(e => e.generationId === generationId);
}

module.exports = {
  checkExportReadiness,
  exportGenerationToObj,
  exportGenerationToGlb,
  getExportsForGeneration,
  buildObjFromParts,
  buildGlbFromParts,
};
