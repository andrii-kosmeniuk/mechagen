import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Viewport3D, type Viewport3DHandle } from './Viewport3D';
import { TopBar } from './TopBar';
import { LeftPanel } from './LeftPanel';
import { ChatPanel } from './ChatPanel';
import { createApi } from '../lib/api';
import { MATERIALS_DB } from '../lib/constants';
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

  const [activeTab, setActiveTab] = useState('design');
  const [projectName, setProjectName] = useState('New Mechanical Part');
  const [projectDesc, setProjectDesc] = useState('');
  const [prompt, setPrompt] = useState('');
  const [multiAgent, setMultiAgent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [materialKey, setMaterialKey] = useState('steel');
  const [scale, setScale] = useState({ x: 1, y: 1, z: 1 });
  const [analysisText, setAnalysisText] = useState(
    'Run analysis to see results...'
  );
  const [geomData, setGeomData] = useState<GeomData | null>(null);
  const [currentPartId, setCurrentPartId] = useState<string | null>(null);
  const [historyParts, setHistoryParts] = useState<HistoryPart[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const currentProjectId = 'default-project';

  const costLabel = (() => {
    const mat = MATERIALS_DB[materialKey];
    if (!geomData || !mat) return '$0.00';
    const volume = 0.001;
    const mass = volume * mat.density * 1000;
    return `$${(mass * mat.costPerKg).toFixed(2)}`;
  })();

  const initRealtime = useCallback(() => {
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;
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
    setGenerating(true);
    try {
      const data = await api.post<{
        id: string;
        geomData: GeomData;
      }>('/api/ai/generate', {
        prompt,
        mode: multiAgent ? 'multi-agent' : 'standard',
      });
      if (data?.geomData) {
        setGeomData(data.geomData);
        setCurrentPartId(data.id);
        const s = socketRef.current;
        if (s?.readyState === WebSocket.OPEN) {
          s.send(
            JSON.stringify({
              type: 'model:updated',
              userId: user.id,
              userName: user.name,
              geomData: data.geomData,
            })
          );
        }
      }
    } catch {
      showToast('Network error. Check your connection.', 'error');
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

  const onRecommendMaterial = async () => {
    try {
      const data = await api.post<{ material: string }>(
        '/api/ai/recommend-material',
        { partId: currentPartId }
      );
      if (data?.material) {
        setMaterialKey(data.material);
        showToast(`AI recommended: ${data.material}`);
      }
    } catch {
      showToast('Recommendation unavailable', 'error');
    }
  };

  const onVoiceInput = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      showToast('Speech recognition not supported in this browser', 'error');
      return;
    }
    const recognition = new SR();
    recognition.onstart = () => showToast('Listening...');
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setPrompt(transcript);
    };
    recognition.start();
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

  return (
    <div className="main-shell">
      <TopBar user={user} onSignOut={onSignOut} />
      <div className="main-content">
        <LeftPanel
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          projectName={projectName}
          setProjectName={setProjectName}
          projectDesc={projectDesc}
          setProjectDesc={setProjectDesc}
          prompt={prompt}
          setPrompt={setPrompt}
          multiAgent={multiAgent}
          setMultiAgent={setMultiAgent}
          generating={generating}
          onGenerate={onGenerate}
          onImprovePrompt={onImprovePrompt}
          onVoiceInput={onVoiceInput}
          materialKey={materialKey}
          setMaterialKey={setMaterialKey}
          costLabel={costLabel}
          onRecommendMaterial={onRecommendMaterial}
          scale={scale}
          setScale={setScale}
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
        <main className="viewport-container">
          <Viewport3D
            ref={viewportRef}
            geomData={geomData}
            scale={scale}
            theme={theme}
          />
          <div className="viewport-overlay">
            <div className="overlay-top-left">
              <div className="status-badge">Draft</div>
              <div className="mt-2 flex-between gap-2" />
            </div>
            <div className="viewport-bottom-actions">
              <button type="button" className="chip">
                Submit for Review
              </button>
              <button type="button" className="chip">
                Reset View
              </button>
            </div>
          </div>
        </main>
        <ChatPanel />
      </div>
    </div>
  );
}
