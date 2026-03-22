/**
 * Trigger a file download in the browser.
 * Do NOT revoke the blob URL immediately — the download is async; revoking too early
 * cancels the save in Chrome/Safari (looks like “nothing happened”).
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Raw base64 (no data: prefix) → STL binary download. */
export function downloadStlFromBase64(base64: string, filename: string): void {
  const clean = base64.replace(/\s/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  triggerDownload(new Blob([bytes], { type: 'model/stl' }), filename);
}

export function sanitizeExportBasename(name: string): string {
  const s = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, '_');
  return s.slice(0, 80) || 'part';
}
