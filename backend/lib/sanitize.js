'use strict';

const MIN_PROMPT = 3;
const MAX_PROMPT = 8000;
const MAX_CONTEXT = 6000;
const MAX_PROJECT_NAME = 200;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB base64 limit

const ALLOWED_IMAGE_PREFIXES = [
  '/9j/',       // JPEG
  'iVBORw0KGgo', // PNG
  'R0lGOD',    // GIF
  'UklGR',     // WebP
];

/**
 * Validates and sanitizes the raw request body.
 * Returns { value } on success or { error, status } on failure.
 */
function sanitizeRequest(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be JSON', status: 400 };
  }

  const { prompt, image, highDetail, context, projectName } = body;
  const hasPrompt = typeof prompt === 'string' && prompt.trim().length > 0;
  const hasImage  = typeof image === 'string'  && image.trim().length > 0;

  if (!hasPrompt && !hasImage) {
    return { error: 'Provide a text prompt, an image, or both', status: 400 };
  }

  if (hasPrompt) {
    const trimmed = prompt.trim();
    if (trimmed.length < MIN_PROMPT) {
      return { error: `Prompt must be at least ${MIN_PROMPT} characters`, status: 400 };
    }
    if (trimmed.length > MAX_PROMPT) {
      return { error: `Prompt must be at most ${MAX_PROMPT} characters`, status: 400 };
    }
  }

  let highDetailFlag = false;
  if (highDetail !== undefined && highDetail !== null) {
    if (typeof highDetail !== 'boolean') {
      return { error: 'highDetail must be a boolean', status: 400 };
    }
    highDetailFlag = highDetail;
  }

  let proceduralPartsFlag = false;
  const { proceduralParts } = body;
  if (proceduralParts !== undefined && proceduralParts !== null) {
    if (typeof proceduralParts !== 'boolean') {
      return { error: 'proceduralParts must be a boolean', status: 400 };
    }
    proceduralPartsFlag = proceduralParts;
  }

  let contextStr = null;
  if (context !== undefined && context !== null) {
    if (typeof context !== 'string') {
      return { error: 'context must be a string', status: 400 };
    }
    const t = context.trim();
    if (t.length > MAX_CONTEXT) {
      return { error: `context must be at most ${MAX_CONTEXT} characters`, status: 400 };
    }
    if (t.length > 0) contextStr = t;
  }

  let projectNameStr = null;
  if (projectName !== undefined && projectName !== null) {
    if (typeof projectName !== 'string') {
      return { error: 'projectName must be a string', status: 400 };
    }
    const t = projectName.trim();
    if (t.length > MAX_PROJECT_NAME) {
      return { error: `projectName must be at most ${MAX_PROJECT_NAME} characters`, status: 400 };
    }
    if (t.length > 0) projectNameStr = t;
  }

  if (hasImage) {
    if (image.length > MAX_IMAGE_BYTES) {
      return { error: 'Image too large — maximum 10MB', status: 400 };
    }
    const isKnownFormat = ALLOWED_IMAGE_PREFIXES.some(prefix =>
      image.startsWith(prefix)
    );
    if (!isKnownFormat) {
      return {
        error: 'Unsupported image format — use JPEG, PNG, GIF, or WebP',
        status: 415
      };
    }
  }

  return {
    value: {
      prompt: hasPrompt ? prompt.trim() : null,
      image:  hasImage  ? image.trim()  : null,
      highDetail: highDetailFlag,
      proceduralParts: proceduralPartsFlag,
      context: contextStr,
      projectName: projectNameStr,
      taskType: body.taskType,
    }
  };
}

module.exports = { sanitizeRequest };
