'use strict';

const MIN_PROMPT = 3;
const MAX_PROMPT = 500;
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

  const { prompt, image } = body;
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
    }
  };
}

module.exports = { sanitizeRequest };
