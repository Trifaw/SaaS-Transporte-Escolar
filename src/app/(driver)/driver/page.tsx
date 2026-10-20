'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Navigation,
  Volume2,
  BellRing,
  CheckCircle2,
  XCircle,
  LogOut,
  Wifi,
  WifiOff,
  Sun,
  MapPin,
  Clock,
  CheckCheck,
  AlertOctagon,
  ExternalLink,
} from 'lucide-react';

interface DriverStop {
  id: string;
  parada_id: string;
  aluno_id: string;
  aluno_nome: string;
  aluno_serie: string;
  endereco: string;
  lat: number;
  lng: number;
  ordem_atual: number;
  janela_inicio: string;
  janela_fim: string;
  status: 'pendente' | 'embarcado' | 'desembarcado' | 'ausente';
  eta_previsto: string | null;
  ack_motorista: boolean;
}

interface DriverTrip {
  id: string;
  status: 'agendada' | 'ativa' | 'concluida' | 'cancelada';
  turno: 'ida' | 'volta';
  versao_rota: number;
  ultima_lat: number | null;
  ultima_lng: number | null;
  veiculo: { apelido: string; placa: string } | null;
  motorista: { nome: string } | null;
  escola: { nome: string; endereco: string; lat: number; lng: number } | null;
  rota: { nome: string; turno: string } | null;
  paradas: DriverStop[];
}

interface RouteAlertBannerData {
  paradaRemovida: {
    alunoId: string;
    alunoNome: string;
    endereco: string;
    ordemAnterior: number;
  };
  novaOrdem: Array<{
    alunoId: string;
    alunoNome: string;
    ordem: number;
    endereco: string;
    etaMinutos: number;
  }>;
  etaDelta: number;
  versaoRota: number;
  receivedAt: string;
}

interface QueuedGpsPing {
  viagemId: string;
  lat: number;
  lng: number;
  velocidadeKmh: number;
  capturadoEm: string;
}

const OFFLINE_QUEUE_KEY = 'saas_te_driver_offline_gps_queue';

export default function DriverPwaPage() {
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [routeAlert, setRouteAlert] = useState<RouteAlertBannerData | null>(null);
  const [customNotice, setCustomNotice] = useState<string | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [isOfflineSim, setIsOfflineSim] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);

  const isOfflineRef = useRef(isOfflineSim);
  isOfflineRef.current = isOfflineSim;

  // Synthesize high-attention dual-tone sound alert via Web Audio API
  const playRouteChangeSound = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq: number, startSec: number, durationSec: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startSec);
        gain.gain.setValueAtTime(0.35, ctx.currentTime + startSec);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + startSec + durationSec
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startSec);
        osc.stop(ctx.currentTime + startSec + durationSec);
      };

      playTone(880, 0, 0.22);
      playTone(1174.66, 0.25, 0.35);
      playTone(880, 0.65, 0.22);
      playTone(1318.5, 0.9, 0.45);
    } catch {
      // Browser blocked autoplay before user gesture
    }
  }, []);

  const fetchTripData = useCallback(async () => {
    const res = await fetch('/api/dashboard/live', { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    const active =
      json.viagens.find((v: DriverTrip) => v.status === 'ativa') ?? json.viagens[0];
    if (active) {
      setTrip(active);
    }
  }, []);

  // Screen Wake Lock API to keep phone screen awake while driving
  useEffect(() => {
    let wakeLockSentinel: { release: () => Promise<void> } | null = null;
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator && navigator.wakeLock) {
          wakeLockSentinel = await navigator.wakeLock.request('screen');
          setWakeLockActive(true);
        }
      } catch {
        setWakeLockActive(false);
      }
    }
    requestWakeLock();
    return () => {
      wakeLockSentinel?.release().catch(() => undefined);
    };
  }, []);

  // Realtime subscription (<3s requirement for absence/route change alerts)
  useEffect(() => {
    fetchTripData();

    const es = new EventSource('/api/realtime/stream?channel=*');
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.event === 'rota_alterada' && msg.payload) {
          playRouteChangeSound();
          setRouteAlert({
            paradaRemovida: msg.payload.paradaRemovida,
            novaOrdem: msg.payload.novaOrdem || [],
            etaDelta: msg.payload.etaDelta ?? 0,
            versaoRota: msg.payload.versaoRota ?? 2,
            receivedAt: new Date().toLocaleTimeString('pt-BR'),
          });
          fetchTripData();
        } else if (msg.event === 'alerta_motorista' && msg.payload) {
          playRouteChangeSound();
          setCustomNotice(String(msg.payload.mensagem || 'Novo aviso da central'));
        } else if (msg.event && msg.event !== 'connected') {
          fetchTripData();
        }
      } catch {
        // Ignore parse error
      }
    };

    return () => es.close();
  }, [fetchTripData, playRouteChangeSound]);

  // Background GPS sender (every 7s throttle) + Offline Queue in localStorage
  useEffect(() => {
    if (!trip || trip.status !== 'ativa') return;

    const flushOfflineQueue = async () => {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return;
      const queued: QueuedGpsPing[] = JSON.parse(raw);
      if (queued.length === 0) return;

      const res = await fetch('/api/gps/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pings: queued }),
      });
      if (res.ok) {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
        setOfflineQueueCount(0);
      }
    };

    const interval = setInterval(async () => {
      const ping: QueuedGpsPing = {
        viagemId: trip.id,
        lat: (trip.ultima_lat ?? -23.6075) + (Math.random() - 0.45) * 0.0003,
        lng: (trip.ultima_lng ?? -46.6605) - (Math.random() - 0.45) * 0.0003,
        velocidadeKmh: 28,
        capturadoEm: new Date().toISOString(),
      };

      if (isOfflineRef.current || !navigator.onLine) {
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        const queued: QueuedGpsPing[] = raw ? JSON.parse(raw) : [];
        queued.push(ping);
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queued));
        setOfflineQueueCount(queued.length);
        return;
      }

      await flushOfflineQueue();
      await fetch('/api/gps/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ping),
      }).catch(() => undefined);
    }, 7000);

    return () => clearInterval(interval);
  }, [trip]);

  async function handleStopAction(
    alunoId: string,
    acao: 'embarcou' | 'ausente' | 'desembarcou'
  ) {
    if (!trip) return;
    setActionBusy(true);
    try {
      await fetch('/api/driver/stops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viagemId: trip.id,
          alunoId,
          acao,
          origem: 'app_motorista',
        }),
      });
      await fetchTripData();
    } finally {
      setActionBusy(false);
    }
  }

  async function handleConfirmAck() {
    if (!trip) return;
    await fetch('/api/driver/stops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viagemId: trip.id,
        acao: 'ack_rota',
      }),
    });
    setRouteAlert(null);
    await fetchTripData();
  }

  async function handleSimulateParentAbsence() {
    if (!trip) return;
    const pendingStops = trip.paradas.filter((p) => p.status === 'pendente');
    const targetStop = pendingStops[1] ?? pendingStops[0];
    if (!targetStop) return;

    await fetch('/api/driver/stops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viagemId: trip.id,
        alunoId: targetStop.aluno_id,
        acao: 'ausente',
        origem: 'whatsapp_responsavel',
      }),
    });
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <p className="text-xl font-bold">Carregando viagem do motorista...</p>
      </div>
    );
  }

  const pendingStops = trip.paradas
    .filter((p) => p.status === 'pendente')
    .sort((a, b) => a.ordem_atual - b.ordem_atual);

  const nextStop = pendingStops[0] ?? null;

  const googleMapsDeepLink = nextStop
    ? `https://www.google.com/maps/dir/?api=1&destination=${nextStop.lat},${nextStop.lng}&travelmode=driving`
    : trip.escola
    ? `https://www.google.com/maps/dir/?api=1&destination=${trip.escola.lat},${trip.escola.lng}&travelmode=driving`
    : '#';

  const wazeDeepLink = nextStop
    ? `https://waze.com/ul?ll=${nextStop.lat},${nextStop.lng}&navigate=yes`
    : trip.escola
    ? `https://waze.com/ul?ll=${trip.escola.lat},${trip.escola.lng}&navigate=yes`
    : '#';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-lg mx-auto border-x border-slate-800 shadow-2xl">
      {/* Top Status Bar — High Contrast */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-amber-400">
              {trip.veiculo?.apelido}
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-white">
              Rota v{trip.versao_rota}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Motorista: {trip.motorista?.nome} • {pendingStops.length} paradas restantes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOfflineSim((v) => !v)}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold cursor-pointer ${
              isOfflineSim
                ? 'bg-rose-600 text-white'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            {isOfflineSim ? (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                Fila ({offlineQueueCount})
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5" />
                GPS 5s
              </>
            )}
          </button>

          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-200"
          >
            Painel
          </Link>
        </div>
      </header>

      {/* Subbar with Wake Lock status + Test External Absence button */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-slate-400">
          <Sun className="h-3.5 w-3.5 text-amber-400" />
          Wake Lock: {wakeLockActive ? 'Ativo' : 'Padrão'}
        </span>

        {pendingStops.length > 0 && (
          <button
            type="button"
            onClick={handleSimulateParentAbsence}
            className="flex items-center gap-1 rounded-lg bg-amber-500/20 border border-amber-500/50 px-2.5 py-1 text-amber-300 font-bold hover:bg-amber-500/30 cursor-pointer"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Simular Ausência (WhatsApp)
          </button>
        )}
      </div>

      {/* HIGH-CONTRAST ROUTE CHANGE / ABSENCE BANNER (Requires Driver ACK) */}
      {routeAlert && (
        <div
          role="alert"
          data-testid="driver-route-alert-banner"
          className="bg-amber-400 text-slate-950 p-4 border-b-4 border-amber-600 space-y-3 animate-pulse"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-7 w-7 text-rose-700 shrink-0" />
              <div>
                <div className="text-lg font-black uppercase leading-tight">
                  Mudança de Rota! (v{routeAlert.versaoRota})
                </div>
                <div className="text-xs font-bold text-slate-900">
                  Recebido às {routeAlert.receivedAt} • Economia:{' '}
                  {Math.abs(Math.round(routeAlert.etaDelta / 60))} min (
                  {routeAlert.etaDelta}s)
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950 text-white p-3 space-y-1">
            <div className="text-xs uppercase font-bold text-rose-400">
              Parada Removida (Aluno Ausente):
            </div>
            <div className="text-base font-extrabold">
              ✕ {routeAlert.paradaRemovida.alunoNome}
            </div>
            <div className="text-xs text-slate-300">
              {routeAlert.paradaRemovida.endereco}
            </div>
          </div>

          {routeAlert.novaOrdem.length > 0 && (
            <div className="rounded-xl bg-slate-900/95 text-white p-3 space-y-1.5">
              <div className="text-xs uppercase font-bold text-amber-400">
                Nova Ordem das Próximas Paradas:
              </div>
              {routeAlert.novaOrdem.slice(0, 3).map((item) => (
                <div
                  key={item.alunoId}
                  className="flex items-center justify-between text-sm font-bold border-b border-slate-800 pb-1 last:border-none"
                >
                  <span>
                    #{item.ordem} {item.alunoNome}
                  </span>
                  <span className="font-mono text-xs text-emerald-400">
                    {item.etaMinutos} min
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            data-testid="driver-ack-button"
            onClick={handleConfirmAck}
            className="w-full rounded-2xl bg-slate-950 text-amber-400 py-4 text-lg font-black uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <CheckCheck className="h-6 w-6" />
            Confirmar Leitura (ACK)
          </button>
        </div>
      )}

      {customNotice && (
        <div className="bg-blue-600 text-white p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-base">
            <BellRing className="h-6 w-6 shrink-0" />
            <span>{customNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setCustomNotice(null)}
            className="rounded-xl bg-black/30 px-3 py-1.5 text-xs font-bold"
          >
            OK
          </button>
        </div>
      )}

      {/* Main Content: Next Stop Highlight + One-Handed Action Buttons */}
      <main className="flex-1 p-4 space-y-5 flex flex-col justify-between">
        {nextStop ? (
          <section className="rounded-3xl bg-slate-900 border-2 border-amber-500 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-amber-500 text-slate-950 px-3 py-1 text-sm font-black uppercase">
                Próxima Parada #{nextStop.ordem_atual}
              </span>
              <span className="text-sm font-mono font-bold text-emerald-400 flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Janela {nextStop.janela_inicio}–{nextStop.janela_fim}
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-black text-white leading-tight">
                {nextStop.aluno_nome}
              </h1>
              <p className="text-base text-slate-200 font-medium mt-1 flex items-start gap-1.5">
                <MapPin className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <span>{nextStop.endereco}</span>
              </p>
            </div>

            {/* Deep Links for Navigation: Google Maps & Waze */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <a
                href={googleMapsDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 py-3.5 px-4 text-base font-extrabold text-white shadow-lg"
              >
                <Navigation className="h-5 w-5" />
                Google Maps
                <ExternalLink className="h-3.5 w-3.5 opacity-75" />
              </a>
              <a
                href={wazeDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500 hover:bg-sky-400 py-3.5 px-4 text-base font-extrabold text-slate-950 shadow-lg"
              >
                <Navigation className="h-5 w-5" />
                Abrir Waze
                <ExternalLink className="h-3.5 w-3.5 opacity-75" />
              </a>
            </div>

            {/* ONE-HANDED LARGE ACTION BUTTONS */}
            <div className="grid grid-cols-1 gap-3 pt-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => handleStopAction(nextStop.aluno_id, 'embarcou')}
                className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] py-4 text-xl font-black text-slate-950 uppercase tracking-wide flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-7 w-7" />
                Embarcou
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleStopAction(nextStop.aluno_id, 'desembarcou')}
                  className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 py-4 text-base font-black text-slate-950 uppercase flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <LogOut className="h-5 w-5" />
                  Desembarcou
                </button>

                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleStopAction(nextStop.aluno_id, 'ausente')}
                  className="w-full rounded-2xl bg-rose-600 hover:bg-rose-500 py-4 text-base font-black text-white uppercase flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                  Ausente
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl bg-emerald-950/40 border-2 border-emerald-500 p-6 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto" />
            <h2 className="text-2xl font-black">Todas as paradas concluídas!</h2>
            <p className="text-base text-slate-300">
              Siga para o destino final: <strong>{trip.escola?.nome}</strong>
            </p>
            <a
              href={googleMapsDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-black text-slate-950"
            >
              <Navigation className="h-5 w-5" />
              Navegar para a Escola
            </a>
          </section>
        )}

        {/* Full Ordered Stop Queue for Today's Trip */}
        <section className="space-y-2.5">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 px-1">
            Sequência da Viagem ({trip.paradas.length} Alunos)
          </h2>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {trip.paradas.map((stop) => {
              const isDone =
                stop.status === 'embarcado' || stop.status === 'desembarcado';
              const isAbsent = stop.status === 'ausente';
              return (
                <div
                  key={stop.id}
                  className={`flex items-center justify-between rounded-2xl border p-3.5 ${
                    isDone
                      ? 'border-emerald-900 bg-emerald-950/30 text-slate-300'
                      : isAbsent
                      ? 'border-rose-900 bg-rose-950/30 text-slate-400 line-through'
                      : 'border-slate-800 bg-slate-900 text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl text-base font-black ${
                        isDone
                          ? 'bg-emerald-500 text-slate-950'
                          : isAbsent
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-500 text-slate-950'
                      }`}
                    >
                      {isAbsent ? '✕' : stop.ordem_atual}
                    </span>
                    <div>
                      <div className="text-base font-extrabold">{stop.aluno_nome}</div>
                      <div className="text-xs text-slate-400">{stop.endereco}</div>
                    </div>
                  </div>

                  <span
                    className={`rounded-xl px-2.5 py-1 text-xs font-black uppercase ${
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
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
