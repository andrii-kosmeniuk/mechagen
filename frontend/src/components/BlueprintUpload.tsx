import React, { useCallback, useRef, useState } from 'react';
import type { BlueprintRecord } from '../types';

interface Props {
  onUpload: (record: BlueprintRecord) => void;
  projectId?: string;
}

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) || 'http://127.0.0.1:3001';

const ACCEPT = '.png,.jpg,.jpeg,.webp,.pdf';

const TYPE_ICONS: Record<string, string> = {
  'image/png':       '🖼️',
  'image/jpeg':      '🖼️',
  'image/jpg':       '🖼️',
  'image/webp':      '🖼️',
  'application/pdf': '📄',
};

export function BlueprintUpload({ onUpload, projectId = 'default-project' }: Props) {
  const [dragging,   setDragging]   = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [preview,    setPreview]    = useState<string | null>(null);   // object URL
  const [fileName,   setFileName]   = useState<string | null>(null);
  const [fileType,   setFileType]   = useState<string | null>(null);
  const [fileSize,   setFileSize]   = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    setFileType(file.type);
    setFileSize(file.size);

    if (file.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('projectId', projectId);

      const resp = await fetch(`${BACKEND}/api/blueprints/upload`, {
        method: 'POST',
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Upload failed');
      onUpload(data as BlueprintRecord);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }, [onUpload, projectId]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const formatBytes = (n: number) => n < 1024 * 1024
    ? `${(n / 1024).toFixed(0)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? '#7eb8f7' : 'rgba(126,184,247,0.25)'}`,
          borderRadius: 10,
          padding: '14px 12px',
          cursor: 'pointer',
          background: dragging ? 'rgba(126,184,247,0.08)' : 'rgba(126,184,247,0.03)',
          transition: 'all 0.18s ease',
          textAlign: 'center',
          minHeight: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          flexDirection: 'column',
        }}
      >
        {uploading ? (
          <div style={{ color: '#7eb8f7', fontSize: 11 }}>⏳ Uploading…</div>
        ) : fileName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{TYPE_ICONS[fileType ?? ''] ?? '📎'}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{fileName}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatBytes(fileSize)}</div>
            </div>
            <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, marginLeft: 4 }}>✓ Ready</span>
          </div>
        ) : (
          <>
            <span style={{ fontSize: 22 }}>📐</span>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Drop blueprint / sketch / drawing here
            </div>
            <div style={{ fontSize: 10, color: 'rgba(126,184,247,0.6)' }}>
              PNG, JPG, WEBP, PDF — max 10 MB
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={onInputChange}
      />

      {/* Image preview */}
      {preview && (
        <div style={{
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid rgba(126,184,247,0.2)',
          maxHeight: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.2)',
        }}>
          <img
            src={preview}
            alt="Blueprint preview"
            style={{ maxWidth: '100%', maxHeight: 140, objectFit: 'contain' }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '6px 10px', borderRadius: 6, fontSize: 10,
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
          color: '#f87171',
        }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
}
