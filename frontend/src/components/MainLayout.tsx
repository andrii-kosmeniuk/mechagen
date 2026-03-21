import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Viewport3D, type Viewport3DHandle } from './Viewport3D';
import { TopBar } from './TopBar';
import { LeftPanel } from './LeftPanel';
import { ChatPanel } from './ChatPanel';
import { createApi } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import type { AppUser, GeomData, HistoryPart } from '../types';

type Props = {
  session: Session;
  supabase: SupabaseClient;
  onSignOut: () => void;
};

export function MainLayout({ session, supabase, onSignOut }: Props) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const api = useRef(createApi(supabase)).current;
  const viewportRef = useRef<Viewport3DHandle>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const realtimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const user: AppUser = {
    id: session.user.id,
    name:
      (session.user.user_metadata?.full_name as string) ||
      session.user.email?.split('@')[0] ||
      'User',
    email: session.user.email || '',
    role: (session.user.user_metadata?.role as string) || 'engineer',
  };

  const [projectName, setProjectName] = useState('New Mechanical Part');
  const [projectDesc, setProjectDesc] = useState('');
  const [prompt, setPrompt] = useState('');
  const [multiAgent, setMultiAgent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [materialKey, setMaterialKey] = useState('aluminum');
  const [wireframe, setWireframe] = useState(false);
  const [modelOpacity, setModelOpacity] = useState(1);
  const displayScale = { x: 1, y: 1, z: 1 };
  const [analysisText, setAnalysisText] = useState(
    'Run analysis to see results...'
  );
  const [geomData, setGeomData] = useState<GeomData | null>(null);
  const [currentPartId, setCurrentPartId] = useState<string | null>(null);
  const [historyParts, setHistoryParts] = useState<HistoryPart[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [highDetail, setHighDetail] = useState(true);
  /** When on, backend skips CadQuery and returns JSON primitives (threads/knurl as stacked parts). */
  const [proceduralParts, setProceduralParts] = useState(false);
  /** When on, run improve-prompt before each generate (same as ✨ Polish, but automatic). */
  const [polishBeforeGenerate, setPolishBeforeGenerate] = useState(true);
  const currentProjectId = 'default-project';

  const initRealtime = useCallback(() => {
    const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
    if (!wsUrl?.trim()) {
      return; // No collab server — skip (plain backend/server.js has no WebSocket)
    }
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    if (realtimeIntervalRef.current) {
      clearInterval(realtimeIntervalRef.current);
      realtimeIntervalRef.current = null;
    }
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl.trim());
    } catch {
      return; // WebSocket not supported or backend has no WS — skip silently
    }
    socketRef.current = socket;
    socket.onerror = () => { /* backend has no WS server — ignore */ };
    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as {
          type: string;
          result?: { geomData: GeomData };
          geomData?: GeomData;
          userId?: string;
          userName?: string;
          name?: string;
          data?: { message: string };
        };
        if (msg.type === 'generation:complete' && msg.result?.geomData) {
          setGeomData(msg.result.geomData);
          showToast('Generation complete!');
        }
        if (msg.type === 'model:updated' && msg.geomData) {
          if (msg.userId !== user.id) {
            setGeomData(msg.geomData);
            showToast(`Model updated by ${msg.userName || 'peer'}`);
          }
        }
        if (msg.type === 'user:joined') {
          showToast(`${msg.name || 'Someone'} joined the session`);
        }
        if (msg.type === 'notification:new' && msg.data?.message) {
          showToast(msg.data.message);
        }
      } catch {
        /* ignore */
      }
    };
    realtimeIntervalRef.current = setInterval(() => {
      const s = socketRef.current;
      const pos = viewportRef.current?.getCameraPosition();
      if (currentProjectId && s?.readyState === WebSocket.OPEN && pos) {
        s.send(
          JSON.stringify({
            type: 'cursor:move',
            projectId: currentProjectId,
            userId: user.id,
            position: { x: pos.x, y: pos.y, z: pos.z },
          })
        );
      }
    }, 100);
  }, [showToast, user.id]);

  useEffect(() => {
    initRealtime();
    return () => {
      if (realtimeIntervalRef.current) {
        clearInterval(realtimeIntervalRef.current);
      }
      socketRef.current?.close();
    };
  }, [initRealtime]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api.get<HistoryPart[]>(
        `/api/projects/${currentProjectId}/parts`
      );
      if (Array.isArray(data)) setHistoryParts(data);
    } catch {
      /* no backend */
    }
  }, [api]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onGenerate = async () => {
    if (!prompt.trim()) {
      showToast('Please enter a prompt first', 'error');
      return;
    }
    setGenerating(true);
    setGenError(null);
    setGeomData(null);
    try {
      let sendPrompt = prompt.trim();
      if (polishBeforeGenerate) {
        try {
          const polished = await api.post<{ improvedPrompt?: string }>(
            '/api/ai/improve-prompt',
            { prompt: sendPrompt }
          );
          const imp = polished?.improvedPrompt?.trim();
          if (imp) sendPrompt = imp;
        } catch {
          /* keep original prompt */
        }
      }
      console.log('[Generate] Sending prompt:', sendPrompt);
      // Direct fetch — bypasses api helper to avoid silent failures
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: sendPrompt,
          highDetail,
          proceduralParts,
          context: projectDesc.trim() || undefined,
          projectName: projectName.trim() || undefined,
        }),
      });
      console.log('[Generate] Response status:', res.status);
      const text = await res.text();
      console.log('[Generate] Raw response:', text.slice(0, 500));

      let data: GeomData & { error?: string };
      try { data = JSON.parse(text); }
      catch { throw new Error('Backend returned invalid JSON: ' + text.slice(0, 200)); }

      if (!res.ok) {
        const errMsg = data.error || `Server error ${res.status}`;
        throw new Error(errMsg);
      }

      const hasStl = typeof data.stl === 'string' && data.stl.length > 50;
      const okCode =
        typeof data.code === 'string' && data.code.trim().length >= 30;
      const hasParts =
        Array.isArray((data as { parts?: unknown }).parts) &&
        (data as { parts: unknown[] }).parts.length > 0;
      if (!hasStl && !okCode && !hasParts) {
        throw new Error('AI returned no usable geometry. Try a different prompt.');
      }

      console.log(
        '[Generate] OK —',
        hasParts
          ? `parts ${(data as { parts: unknown[] }).parts.length}`
          : hasStl
            ? `stl ${data.stl?.length ?? 0} b64 chars`
            : `code length ${(data as { code: string }).code.length}`
      );
      const gen = data as GeomData & { parts?: GeomData['parts'] };
      setGeomData({
        code: typeof data.code === 'string' ? data.code : '',
        stl: hasStl ? data.stl : undefined,
        name: data.name,
        description: gen.description,
        dimensions: gen.dimensions,
        parts: hasParts ? gen.parts : undefined,
      });
      setCurrentPartId(crypto.randomUUID());
      showToast(
        proceduralParts
          ? '✓ Generated (JSON parts)'
          : highDetail
            ? '✓ Generated (high detail)'
            : '✓ Generated!'
      );
    } catch (e) {
      const msg = (e as Error).message || 'Unknown error';
      console.error('[Generate] FAILED:', msg);
      setGenError(msg);
      showToast(`Generation failed: ${msg}`, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const onImprovePrompt = async () => {
    try {
      const data = await api.post<{ improvedPrompt: string }>(
        '/api/ai/improve-prompt',
        { prompt }
      );
      if (data?.improvedPrompt) {
        setPrompt(data.improvedPrompt);
        showToast('Prompt optimized by AI');
      }
    } catch {
      showToast('Could not improve prompt', 'error');
    }
  };

  const onAnalyzePart = async () => {
    setAnalysisText('Analyzing...');
    try {
      const data = await api.post<{ analysis: string }>('/api/ai/analyze', {
        partId: currentPartId,
      });
      if (data?.analysis) setAnalysisText(data.analysis);
    } catch {
      setAnalysisText('Analysis unavailable (no API).');
    }
  };

  const onShare = async () => {
    const shareData = btoa(
      JSON.stringify({ partId: currentPartId, time: Date.now() })
    );
    const url = `${window.location.href.split('?')[0]}?share=${shareData}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 128, margin: 1 });
      setQrDataUrl(dataUrl);
      showToast('Share link generated');
    } catch {
      showToast('Could not create QR code', 'error');
    }
  };

  const [cadCmd, setCadCmd] = useState('');

  return (
    <div className="main-shell">
      <TopBar user={user} onSignOut={onSignOut} />
      <div className="main-content">
        <LeftPanel
          projectName={projectName}
          setProjectName={setProjectName}
          projectDesc={projectDesc}
          setProjectDesc={setProjectDesc}
          prompt={prompt}
          setPrompt={setPrompt}
          multiAgent={multiAgent}
          setMultiAgent={setMultiAgent}
          highDetail={highDetail}
          setHighDetail={setHighDetail}
          proceduralParts={proceduralParts}
          setProceduralParts={setProceduralParts}
          polishBeforeGenerate={polishBeforeGenerate}
          setPolishBeforeGenerate={setPolishBeforeGenerate}
          wireframe={wireframe}
          setWireframe={setWireframe}
          modelOpacity={modelOpacity}
          setModelOpacity={setModelOpacity}
          generating={generating}
          onGenerate={onGenerate}
          onImprovePrompt={onImprovePrompt}
          analysisText={analysisText}
          onAnalyzePart={onAnalyzePart}
          onShare={onShare}
          qrDataUrl={qrDataUrl}
          historyParts={historyParts}
          onSelectHistoryPart={(p) => {
            setCurrentPartId(p.id);
            setGeomData(p.geomData);
          }}
        />

        <main className="viewport-container" style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          <Viewport3D
            ref={viewportRef}
            geomData={geomData}
            scale={displayScale}
            theme={theme}
            materialKey={materialKey}
            wireframe={wireframe}
            modelOpacity={modelOpacity}
            generationPrompt={prompt}
          />

          {/* Perspective label top-right */}
          <div style={{
            position: 'absolute', top: 10, right: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>PERSPECTIVE</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['X','#f97316'],['Y','#5ab85a'],['Z','#7eb8f7']].map(([ax, col]) => (
                <span key={ax} style={{ fontSize: 10, fontWeight: 700, color: col }}>{ax}</span>
              ))}
            </div>
          </div>

          {/* Status badge top-left */}
          <div style={{ position: 'absolute', top: 10, left: 12, pointerEvents: 'none' }}>
            <div className="status-badge">DRAFT</div>
          </div>

          {/* Generation overlay */}
          {generating && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              background: 'rgba(5,5,13,0.88)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '16px 24px', color: 'var(--accent-blue)',
              fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 10,
              pointerEvents: 'none',
            }}>
              <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⚙️</span>
              Generating 3D model…
            </div>
          )}
          {genError && !generating && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              background: 'rgba(0,0,0,0.85)', border: '1px solid var(--error)',
              borderRadius: 8, padding: '1rem 1.5rem', maxWidth: '80%',
              color: 'var(--error)', fontSize: '0.85rem', textAlign: 'center',
              pointerEvents: 'none',
            }}>
              ⚠️ {genError}
            </div>
          )}

          {/* CAD command bar */}
          <div style={{
            position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
            width: 360, maxWidth: '70%',
          }}>
            <input
              value={cadCmd}
              onChange={e => setCadCmd(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { showToast(`CAD: ${cadCmd}`); setCadCmd(''); } }}
              placeholder="Type a CAD command... (e.g. 'rotate 90deg X')"
              style={{
                width: '100%', padding: '8px 14px', boxSizing: 'border-box',
                background: 'rgba(5,5,13,0.82)', border: '1px solid rgba(126,184,247,0.25)',
                borderRadius: 8, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
                backdropFilter: 'blur(6px)',
              }}
            />
          </div>

          {/* Control hints */}
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 16, fontSize: 9, color: 'var(--text-muted)',
            fontWeight: 600, letterSpacing: '0.05em', pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            <span>DRAG TO ROTATE</span>
            <span>SCROLL TO ZOOM</span>
            <span>RIGHT-DRAG TO PAN</span>
          </div>
        </main>

        <ChatPanel />
      </div>
    </div>
  );
}
