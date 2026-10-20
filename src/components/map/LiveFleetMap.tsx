'use client';

import { useState } from 'react';
import { Navigation, School, MapPin, CheckCircle2, XCircle, Clock } from 'lucide-react';

export interface MapStopItem {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  endereco: string;
  lat: number;
  lng: number;
  ordem_atual: number;
  janela_inicio: string;
  janela_fim: string;
  status: 'pendente' | 'embarcado' | 'desembarcado' | 'ausente';
  eta_previsto: string | null;
  distancia_restante_metros: number | null;
}

export interface MapTripData {
  id: string;
  status: 'agendada' | 'ativa' | 'concluida' | 'cancelada';
  ultima_lat: number | null;
  ultima_lng: number | null;
  ultima_velocidade_kmh: number | null;
  ultima_atualizacao_gps: string | null;
  versao_rota: number;
  veiculo: { apelido: string; placa: string } | null;
  motorista: { nome: string } | null;
  escola: { nome: string; endereco: string; lat: number; lng: number } | null;
  paradas: MapStopItem[];
}

interface LiveFleetMapProps {
  trip: MapTripData;
}

export function LiveFleetMap({ trip }: LiveFleetMapProps) {
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  // Collect all points (van, stops, school) to compute bounding box
  const points: Array<{ lat: number; lng: number }> = [];
  if (trip.ultima_lat != null && trip.ultima_lng != null) {
    points.push({ lat: trip.ultima_lat, lng: trip.ultima_lng });
  }
  for (const s of trip.paradas) {
    points.push({ lat: s.lat, lng: s.lng });
  }
  if (trip.escola) {
    points.push({ lat: trip.escola.lat, lng: trip.escola.lng });
  }

  const lats = points.length ? points.map((p) => p.lat) : [-23.61, -23.595];
  const lngs = points.length ? points.map((p) => p.lng) : [-46.67, -46.655];

  const minLat = Math.min(...lats) - 0.0018;
  const maxLat = Math.max(...lats) + 0.0018;
  const minLng = Math.min(...lngs) - 0.0022;
  const maxLng = Math.max(...lngs) + 0.0022;

  const width = 820;
  const height = 440;

  function project(lat: number, lng: number): { x: number; y: number } {
    const xRatio = (lng - minLng) / Math.max(0.0001, maxLng - minLng);
    const yRatio = (maxLat - lat) / Math.max(0.0001, maxLat - minLat);
    return {
      x: Math.round(45 + xRatio * (width - 90)),
      y: Math.round(40 + yRatio * (height - 80)),
    };
  }

  const activeStops = trip.paradas
    .filter((p) => p.status !== 'ausente')
    .sort((a, b) => a.ordem_atual - b.ordem_atual);

  const polylinePoints: Array<{ x: number; y: number }> = [];
  if (trip.ultima_lat != null && trip.ultima_lng != null) {
    polylinePoints.push(project(trip.ultima_lat, trip.ultima_lng));
  }
  for (const s of activeStops) {
    if (s.status === 'pendente') {
      polylinePoints.push(project(s.lat, s.lng));
    }
  }
  if (trip.escola) {
    polylinePoints.push(project(trip.escola.lat, trip.escola.lng));
  }

  const polylineString = polylinePoints.map((pt) => `${pt.x},${pt.y}`).join(' ');
  const vanPos =
    trip.ultima_lat != null && trip.ultima_lng != null
      ? project(trip.ultima_lat, trip.ultima_lng)
      : null;
  const schoolPos = trip.escola ? project(trip.escola.lat, trip.escola.lng) : null;

  const selectedStop = trip.paradas.find((p) => p.id === selectedStopId) ?? null;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xl">
      {/* Top Overlay Header */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-slate-900/90 backdrop-blur px-3.5 py-2 border border-slate-700/80 text-xs">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                trip.status === 'ativa' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                trip.status === 'ativa' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <span className="font-semibold text-white">
            {trip.veiculo?.apelido ?? 'Van'} ({trip.veiculo?.placa})
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-amber-400 font-mono">
            {trip.ultima_velocidade_kmh ?? 0} km/h
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-300">Rota v{trip.versao_rota}</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-900/90 backdrop-blur px-3.5 py-2 border border-slate-700/80 text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
            Concluída
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
            Pendente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />
            Ausente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
            Escola
          </span>
        </div>
      </div>

      {/* Interactive Vector Map Canvas */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[420px] select-none bg-[#0b1221]"
      >
        <defs>
          <pattern id="urbanGrid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="#1e293b"
              strokeWidth="0.9"
            />
          </pattern>
          <pattern id="majorAvenue" width="144" height="144" patternUnits="userSpaceOnUse">
            <path
              d="M 144 0 L 0 0 0 144"
              fill="none"
              stroke="#334155"
              strokeWidth="1.6"
            />
          </pattern>
        </defs>

        {/* Map Street Grid */}
        <rect width={width} height={height} fill="url(#urbanGrid)" />
        <rect width={width} height={height} fill="url(#majorAvenue)" />

        {/* Active Route Polyline */}
        {polylinePoints.length > 1 && (
          <>
            <polyline
              fill="none"
              stroke="#f59e0b"
              strokeOpacity="0.22"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylineString}
            />
            <polyline
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3"
              strokeDasharray="8 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylineString}
            />
          </>
        )}

        {/* Stop Markers */}
        {trip.paradas.map((stop) => {
          const pt = project(stop.lat, stop.lng);
          const isCompleted =
            stop.status === 'embarcado' || stop.status === 'desembarcado';
          const isAbsent = stop.status === 'ausente';
          const fill = isCompleted
            ? '#10b981'
            : isAbsent
            ? '#f43f5e'
            : '#f59e0b';

          return (
            <g
              key={stop.id}
              transform={`translate(${pt.x}, ${pt.y})`}
              className="cursor-pointer"
              onClick={() => setSelectedStopId(stop.id)}
            >
              <circle
                r={selectedStopId === stop.id ? 17 : 13}
                fill={fill}
                fillOpacity={isAbsent ? 0.35 : 0.2}
              />
              <circle
                r="10"
                fill={fill}
                stroke="#0f172a"
                strokeWidth="2"
              />
              <text
                y="3.5"
                textAnchor="middle"
                fill="#020617"
                fontSize="10"
                fontWeight="bold"
              >
                {isAbsent ? '✕' : stop.ordem_atual}
              </text>
              <text
                y="22"
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="9.5"
                fontWeight="500"
              >
                {stop.aluno_nome.split(' ')[0]}
              </text>
            </g>
          );
        })}

        {/* School Destination Marker */}
        {schoolPos && trip.escola && (
          <g transform={`translate(${schoolPos.x}, ${schoolPos.y})`}>
            <circle r="18" fill="#3b82f6" fillOpacity="0.25" />
            <circle r="12" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
            <text
              y="4"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="10"
              fontWeight="bold"
            >
              ESC
            </text>
            <text
              y="-16"
              textAnchor="middle"
              fill="#93c5fd"
              fontSize="10"
              fontWeight="bold"
            >
              {trip.escola.nome.split(' - ')[0]}
            </text>
          </g>
        )}

        {/* Live Van Marker */}
        {vanPos && (
          <g transform={`translate(${vanPos.x}, ${vanPos.y})`}>
            <circle r="24" fill="#10b981" fillOpacity="0.22" />
            <circle
              r="14"
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth="2.5"
            />
            <text
              y="4"
              textAnchor="middle"
              fill="#022c22"
              fontSize="9.5"
              fontWeight="900"
            >
              VAN
            </text>
            <rect
              x="-42"
              y="-34"
              width="84"
              height="16"
              rx="5"
              fill="#064e3b"
              stroke="#10b981"
              strokeWidth="1"
            />
            <text
              y="-23"
              textAnchor="middle"
              fill="#ecfdf5"
              fontSize="9"
              fontWeight="bold"
            >
              {trip.veiculo?.placa ?? 'AO VIVO'}
            </text>
          </g>
        )}
      </svg>

      {/* Bottom Info Bar or Selected Stop Inspector */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/95 border-t border-slate-800 px-4 py-2.5 text-xs text-slate-300">
        {selectedStop ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-white flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-amber-400" />#{selectedStop.ordem_atual}{' '}
              {selectedStop.aluno_nome}
            </span>
            <span className="text-slate-400">{selectedStop.endereco}</span>
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-amber-300">
              Janela {selectedStop.janela_inicio}–{selectedStop.janela_fim}
            </span>
            <button
              type="button"
              onClick={() => setSelectedStopId(null)}
              className="text-slate-400 hover:text-white underline ml-2"
            >
              Fechar detalhe
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <Navigation className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              Posição GPS: {trip.ultima_lat?.toFixed(5)}, {trip.ultima_lng?.toFixed(5)} • Clique
              em qualquer parada no mapa para inspecionar
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {
              trip.paradas.filter(
                (p) => p.status === 'embarcado' || p.status === 'desembarcado'
              ).length
            }{' '}
            concluídas
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <Clock className="h-3.5 w-3.5" />
            {trip.paradas.filter((p) => p.status === 'pendente').length} pendentes
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <XCircle className="h-3.5 w-3.5" />
            {trip.paradas.filter((p) => p.status === 'ausente').length} ausentes
          </span>
          {trip.escola && (
            <span className="hidden md:flex items-center gap-1 text-blue-400">
              <School className="h-3.5 w-3.5" />
              {trip.escola.nome.split(' - ')[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
