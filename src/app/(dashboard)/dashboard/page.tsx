'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Truck,
  Radio,
  Clock,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  XCircle,
  Play,
  Square,
  Navigation,
  ShieldCheck,
  RefreshCw,
  Wallet,
  Smartphone,
} from 'lucide-react';
import { LiveFleetMap, type MapTripData } from '@/components/map/LiveFleetMap';

interface LiveDashboardResponse {
  ok: boolean;
  actor: {
    userId: string;
    role: string;
    transportadorId: string;
  };
  tenant: {
    id: string;
    nome: string;
    config_van_chegando_minutos: number;
    config_atraso_minutos: number;
  };
  viagens: Array<
    MapTripData & {
      rota: { nome: string; turno: string } | null;
      eta_destino_final: string | null;
      resumoParadas: {
        total: number;
        concluidas: number;
        ausentes: number;
        pendentes: number;
      };
    }
  >;
  eventosRecentes: Array<{
    id: string;
    viagem_id: string;
    aluno_id: string | null;
    tipo: string;
    origem: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
  outboxRecentes: Array<{
    id: string;
    tipo: string;
    idempotency_key: string;
    status: string;
    created_at: string;
  }>;
  auditLogsRecentes: Array<{
    id: string;
    actor_role: string;
    recurso: string;
    acao: string;
    created_at: string;
  }>;
}

export default function TransporterDashboardPage() {
  const [data, setData] = useState<LiveDashboardResponse | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [simulatingGps, setSimulatingGps] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'conectado' | 'reconectando'>(
    'conectado'
  );
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);

  const fetchLiveDashboard = useCallback(async () => {
    const res = await fetch('/api/dashboard/live', { cache: 'no-store' });
    if (res.ok) {
      const json: LiveDashboardResponse = await res.json();
      setData(json);
      setSelectedTripId((prev) => prev ?? json.viagens[0]?.id ?? null);
    }
  }, []);

  useEffect(() => {
    fetchLiveDashboard();

    const eventSource = new EventSource('/api/realtime/stream?channel=*');
    eventSource.onopen = () => setRealtimeStatus('conectado');
    eventSource.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.event && msg.event !== 'connected') {
          fetchLiveDashboard();
        }
      } catch {
        // Ignore malformed frame
      }
    };
    eventSource.onerror = () => {
      setRealtimeStatus('reconectando');
    };

    return () => {
      eventSource.close();
    };
  }, [fetchLiveDashboard]);

  const activeTrip =
    data?.viagens.find((v) => v.id === selectedTripId) ?? data?.viagens[0] ?? null;

  async function handleSimulateGpsStep(forceLate = false) {
    if (!activeTrip) return;
    setSimulatingGps(true);
    try {
      const nextStop = activeTrip.paradas.find((p) => p.status === 'pendente');
      const curLat = activeTrip.ultima_lat ?? -23.6075;
      const curLng = activeTrip.ultima_lng ?? -46.6605;

      // Move 65% closer to the next pending stop so ETA drops to <= 5 min (triggers van_chegando)
      const targetLat = nextStop ? curLat + (nextStop.lat - curLat) * 0.65 : curLat + 0.0008;
      const targetLng = nextStop ? curLng + (nextStop.lng - curLng) * 0.65 : curLng - 0.0008;

      const capturadoEm = forceLate
        ? new Date(new Date().setUTCHours(8, 30, 0, 0)).toISOString()
        : new Date().toISOString();

      const res = await fetch('/api/gps/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viagemId: activeTrip.id,
          lat: Number(targetLat.toFixed(6)),
          lng: Number(targetLng.toFixed(6)),
          velocidadeKmh: forceLate ? 14 : 31.5,
          direcaoGraus: 320,
          precisaoMetros: 4.5,
          capturadoEm,
        }),
      });

      const json = await res.json();
      if (json.ok) {
        const triggered = (json.eventosDisparados || [])
          .map((e: { tipo: string }) => e.tipo)
          .join(', ');
        setLastFeedback(
          triggered
            ? `GPS atualizado! Eventos disparados: ${triggered}`
            : 'Posição GPS e ETAs recalculados em tempo real!'
        );
        await fetchLiveDashboard();
      }
    } finally {
      setSimulatingGps(false);
    }
  }

  async function handleTripLifecycle(acao: 'iniciar' | 'encerrar') {
    if (!activeTrip) return;
    await fetch(`/api/trips/${activeTrip.id}/lifecycle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao }),
    });
    setLastFeedback(
      acao === 'iniciar' ? 'Viagem iniciada!' : 'Viagem encerrada com sucesso!'
    );
    await fetchLiveDashboard();
  }

  function formatEtaMinutes(iso: string | null): string {
    if (!iso) return '—';
    const diffMin = Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
    const timeStr = new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${diffMin} min (${timeStr})`;
  }

  if (!data || !activeTrip) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-300">
          <RefreshCw className="h-5 w-5 animate-spin text-amber-400" />
          <span>Carregando painel ao vivo...</span>
        </div>
      </div>
    );
  }

  const totalStops = activeTrip.resumoParadas.total || 1;
  const progressPercent = Math.round(
    ((activeTrip.resumoParadas.concluidas + activeTrip.resumoParadas.ausentes) /
      totalStops) *
      100
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20 px-4 md:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold"
            >
              <Truck className="h-6 w-6" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">{data.tenant?.nome}</h1>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                  <Radio className="h-3 w-3 animate-pulse" />
                  Realtime {realtimeStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Perfil ativo: <strong className="text-amber-400">{data.actor.role}</strong> •
                Alerta van chegando ≤ {data.tenant?.config_van_chegando_minutos} min • Atraso &gt;{' '}
                {data.tenant?.config_atraso_minutos} min
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
            <Link
              href="/dashboard/financeiro"
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-slate-200 transition"
            >
              <Wallet className="h-4 w-4 text-blue-400" />
              Financeiro Pix
            </Link>
            <Link
              href="/driver"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-slate-950 font-bold transition"
            >
              <Smartphone className="h-4 w-4" />
              Abrir App do Motorista
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-slate-700 hover:bg-slate-800 px-3 py-2 text-slate-300 transition"
            >
              Trocar Perfil (LGPD)
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {/* Trip Selector & GPS Simulation Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {data.viagens.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedTripId(v.id)}
                className={`rounded-xl px-4 py-2.5 text-left text-xs transition cursor-pointer ${
                  v.id === activeTrip.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div>{v.veiculo?.apelido}</div>
                <div className="text-[11px] opacity-80">
                  {v.rota?.nome.split('(')[0]} • Status: {v.status.toUpperCase()}
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTrip.status !== 'ativa' ? (
              <button
                type="button"
                onClick={() => handleTripLifecycle('iniciar')}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 transition cursor-pointer"
              >
                <Play className="h-4 w-4" />
                Iniciar Viagem
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={simulatingGps}
                  onClick={() => handleSimulateGpsStep(false)}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 transition disabled:opacity-50 cursor-pointer"
                >
                  <Navigation className="h-4 w-4" />
                  Simular Ping GPS (Avançar Van)
                </button>
                <button
                  type="button"
                  disabled={simulatingGps}
                  onClick={() => handleSimulateGpsStep(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-300 transition disabled:opacity-50 cursor-pointer"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Simular Desvio/Atraso
                </button>
                <button
                  type="button"
                  onClick={() => handleTripLifecycle('encerrar')}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5 text-rose-400" />
                  Encerrar
                </button>
              </>
            )}
          </div>
        </div>

        {lastFeedback && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 text-xs text-emerald-300 flex items-center justify-between">
            <span>{lastFeedback}</span>
            <button
              type="button"
              onClick={() => setLastFeedback(null)}
              className="text-emerald-400 hover:underline"
            >
              Fechar
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="text-xs text-slate-400">Status da Viagem</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-bold uppercase text-emerald-400">
                {activeTrip.status}
              </span>
              <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                v{activeTrip.versao_rota}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Motorista: {activeTrip.motorista?.nome}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="text-xs text-slate-400">Progresso de Paradas</div>
            <div className="text-xl font-bold mt-1">
              {activeTrip.resumoParadas.concluidas} / {activeTrip.resumoParadas.total}{' '}
              concluídas
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="text-xs text-slate-400">Paradas Pendentes / Ausentes</div>
            <div className="text-xl font-bold mt-1 text-amber-400">
              {activeTrip.resumoParadas.pendentes} pendentes
            </div>
            <div className="text-xs text-rose-400 mt-1">
              {activeTrip.resumoParadas.ausentes} ausências registradas hoje
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <div className="text-xs text-slate-400">ETA Chegada na Escola</div>
            <div className="text-xl font-bold mt-1 text-blue-400">
              {formatEtaMinutes(activeTrip.eta_destino_final)}
            </div>
            <div className="text-xs text-slate-400 mt-1 truncate">
              {activeTrip.escola?.nome}
            </div>
          </div>
        </div>

        {/* Main Grid: Live Map + Stops List */}
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <LiveFleetMap trip={activeTrip} />

            {/* Outbox & Proactive Events Panel */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-amber-400" />
                  Eventos da Viagem & Outbox Proativo (van_chegando / atraso / rota_alterada)
                </h2>
                <span className="text-xs text-slate-400">
                  {data.eventosRecentes.length} eventos
                </span>
              </div>

              {data.eventosRecentes.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Nenhum evento disparado ainda. Clique em &ldquo;Simular Ping GPS&rdquo; para
                  aproximar a van da próxima parada.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {data.eventosRecentes.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 font-mono font-bold uppercase text-[10px] ${
                            ev.tipo === 'atraso' || ev.tipo === 'ausencia'
                              ? 'bg-rose-500/20 text-rose-300'
                              : ev.tipo === 'van_chegando'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {ev.tipo}
                        </span>
                        <span className="text-slate-300">Origem: {ev.origem}</span>
                        <span className="text-slate-500 font-mono text-[11px] truncate max-w-xs">
                          {JSON.stringify(ev.payload)}
                        </span>
                      </div>
                      <span className="text-slate-500 text-[11px]">
                        {new Date(ev.created_at).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Ordered Stops + ETA per Student */}
          <div className="lg:col-span-5 rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold">Paradas da Viagem & ETAs</h2>
                <p className="text-xs text-slate-400">
                  Ordem atualizada em tempo real (Rota v{activeTrip.versao_rota})
                </p>
              </div>
              <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-mono text-amber-400">
                {activeTrip.paradas.length} alunos visíveis
              </span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[540px] pr-1">
              {activeTrip.paradas.map((stop) => {
                const isDone =
                  stop.status === 'embarcado' || stop.status === 'desembarcado';
                const isAbsent = stop.status === 'ausente';

                return (
                  <div
                    key={stop.id}
                    className={`rounded-xl border p-3.5 transition ${
                      isDone
                        ? 'border-emerald-900/60 bg-emerald-950/20'
                        : isAbsent
                        ? 'border-rose-900/60 bg-rose-950/20 opacity-70'
                        : 'border-slate-800 bg-slate-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                            isDone
                              ? 'bg-emerald-500 text-slate-950'
                              : isAbsent
                              ? 'bg-rose-500 text-white'
                              : 'bg-amber-500 text-slate-950'
                          }`}
                        >
                          {isAbsent ? '✕' : stop.ordem_atual}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-white">
                            {stop.aluno_nome}
                          </div>
                          <div className="text-xs text-slate-400">{stop.endereco}</div>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : isAbsent
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {stop.status}
                      </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        Janela: {stop.janela_inicio}–{stop.janela_fim}
                      </span>

                      {stop.status === 'pendente' && (
                        <span className="font-mono font-semibold text-amber-300">
                          ETA: {formatEtaMinutes(stop.eta_previsto)}
                        </span>
                      )}
                      {isDone && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Concluída
                        </span>
                      )}
                      {isAbsent && (
                        <span className="flex items-center gap-1 text-rose-400">
                          <XCircle className="h-3.5 w-3.5" />
                          Removida da rota ativa
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Auditoria LGPD ativa ({data.auditLogsRecentes.length} acessos registrados)
              </span>
              <span>Canal: viagem:{activeTrip.id.slice(-4)}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
