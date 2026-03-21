const VALID_SHAPES = ['box', 'cylinder', 'sphere', 'torus', 'cone'];

function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return 'Prompt is required';
  const trimmed = prompt.trim();
  if (trimmed.length < 3) return 'Prompt is too short (min 3 characters)';
  if (trimmed.length > 2000) return 'Prompt is too long (max 2000 characters)';
  return null;
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function sanitizeVec3(v) {
  if (!v || typeof v !== 'object') return { x: 0, y: 0, z: 0 };
  return {
    x: typeof v.x === 'number' && isFinite(v.x) ? v.x : 0,
    y: typeof v.y === 'number' && isFinite(v.y) ? v.y : 0,
    z: typeof v.z === 'number' && isFinite(v.z) ? v.z : 0,
  };
}

function sanitizeGeometry(geom) {
  if (!geom || typeof geom !== 'object') return null;

  const result = {
    name: String(geom.name || 'Generated Part'),
  };

  if (typeof geom.ballCount === 'number' && geom.ballCount > 0) {
    result.ballCount = Math.round(clamp(geom.ballCount, 1, 24));
  }

  if (Array.isArray(geom.parts)) {
    result.parts = geom.parts
      .filter(p => p && VALID_SHAPES.includes(p.shape))
      .map(p => ({
        shape: p.shape,
        params: p.params && typeof p.params === 'object' ? p.params : {},
        color: typeof p.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(p.color) ? p.color : '#8a9aaa',
        metalness: typeof p.metalness === 'number' ? clamp(p.metalness, 0, 1) : 0.8,
        roughness: typeof p.roughness === 'number' ? clamp(p.roughness, 0, 1) : 0.2,
        position: sanitizeVec3(p.position),
        rotation: sanitizeVec3(p.rotation),
      }));
  } else {
    result.parts = [];
  }

  return result;
}

module.exports = { validatePrompt, sanitizeGeometry };
