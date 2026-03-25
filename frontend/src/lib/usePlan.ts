import { useState, useEffect, useCallback } from 'react';
import type { Plan, Subscription, UsageResponse, Workspace, WorkspaceMember } from '../types';

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3001';

export interface PlanState {
  plan:         Plan | null;
  subscription: Subscription | null;
  usage:        UsageResponse | null;
  workspaces:   Workspace[];
  loading:      boolean;
  error:        string | null;
  refresh:      () => void;
  setUserPlan:  (planCode: string) => Promise<void>;
}

export function usePlan(): PlanState {
  const [plan, setApiPlan]         = useState<Plan | null>(null);
  const [subscription, setSub]     = useState<Subscription | null>(null);
  const [usage, setUsage]          = useState<UsageResponse | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading]      = useState(true);
  const [error, setError]          = useState<string | null>(null);
  const [tick, setTick]            = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const headers = { 'Content-Type': 'application/json' };

    Promise.all([
      fetch(`${API}/api/me/plan`, { headers }).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/me/usage`, { headers }).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/workspaces`, { headers }).then(r => r.json()).catch(() => null),
    ]).then(([planData, usageData, wsData]) => {
      if (cancelled) return;
      if (planData?.plan)          setApiPlan(planData.plan);
      if (planData?.subscription)  setSub(planData.subscription);
      if (usageData?.quotas)       setUsage(usageData as UsageResponse);
      if (wsData?.workspaces)      setWorkspaces(wsData.workspaces);
      setLoading(false);
    }).catch(err => {
      if (!cancelled) { setError(err.message); setLoading(false); }
    });

    return () => { cancelled = true; };
  }, [tick]);

  const setUserPlan = useCallback(async (planCode: string) => {
    await fetch(`${API}/api/me/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planCode }),
    });
    refresh();
  }, [refresh]);

  return { plan, subscription, usage, workspaces, loading, error, refresh, setUserPlan };
}
