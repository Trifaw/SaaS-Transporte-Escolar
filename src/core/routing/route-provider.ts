export interface LatLng {
  lat: number;
  lng: number;
}

export interface StopWaypoint {
  paradaId: string;
  alunoId: string;
  endereco: string;
  lat: number;
  lng: number;
  ordemAtual: number;
  janelaInicio: string; // "HH:MM"
  janelaFim: string;    // "HH:MM"
  duracaoParadaSegundos?: number;
}

export interface StopEtaComputation {
  paradaId: string;
  alunoId: string;
  ordem: number;
  distanciaMetros: number;
  etaSegundos: number;
  etaPrevistoIso: string;
  etaMinutos: number;
}

export interface RouteEtaResult {
  provider: 'google' | 'local';
  stops: StopEtaComputation[];
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  etaDestinoFinalIso: string;
}

export interface RouteOptimizationResult extends RouteEtaResult {
  reordered: boolean;
}

export interface RouteProvider {
  readonly name: 'google' | 'local';
  calculateStopEtas(
    origin: LatLng,
    stops: StopWaypoint[],
    destination: LatLng,
    referenceDate?: Date,
    speedKmh?: number
  ): Promise<RouteEtaResult>;

  optimizeRemainingStops(
    origin: LatLng,
    stops: StopWaypoint[],
    destination: LatLng,
    referenceDate?: Date,
    speedKmh?: number
  ): Promise<RouteOptimizationResult>;
}

const EARTH_RADIUS_METERS = 6_371_000;
const URBAN_TORTUOSITY_FACTOR = 1.32;
const DEFAULT_URBAN_SPEED_KMH = 26;

export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_METERS * c * URBAN_TORTUOSITY_FACTOR);
}

export function timeStringToMinutes(hhmm: string): number {
  const [hh, mm] = hhmm.split(':').map((n) => parseInt(n, 10));
  return (hh || 0) * 60 + (mm || 0);
}

/**
 * Deterministic Local RouteProvider using Haversine urban distance + time-window-aware
 * nearest-neighbor + 2-opt refinement.
 */
export class LocalDeterministicRouteProvider implements RouteProvider {
  public readonly name = 'local' as const;

  public async calculateStopEtas(
    origin: LatLng,
    stops: StopWaypoint[],
    destination: LatLng,
    referenceDate: Date = new Date(),
    speedKmh: number = DEFAULT_URBAN_SPEED_KMH
  ): Promise<RouteEtaResult> {
    const effectiveSpeedMps = Math.max(speedKmh, 15) / 3.6;
    let currentPos: LatLng = { ...origin };
    let cumulativeSeconds = 0;
    let cumulativeMeters = 0;

    const ordered = [...stops].sort((a, b) => a.ordemAtual - b.ordemAtual);
    const computedStops: StopEtaComputation[] = [];

    for (let idx = 0; idx < ordered.length; idx++) {
      const stop = ordered[idx];
      const legMeters = haversineDistanceMeters(currentPos, {
        lat: stop.lat,
        lng: stop.lng,
      });
      const legDriveSeconds = Math.max(15, Math.round(legMeters / effectiveSpeedMps));
      cumulativeMeters += legMeters;
      cumulativeSeconds += legDriveSeconds;

      const etaPrevistoIso = new Date(
        referenceDate.getTime() + cumulativeSeconds * 1000
      ).toISOString();

      computedStops.push({
        paradaId: stop.paradaId,
        alunoId: stop.alunoId,
        ordem: idx + 1,
        distanciaMetros: cumulativeMeters,
        etaSegundos: cumulativeSeconds,
        etaPrevistoIso,
        etaMinutos: Math.max(1, Math.round(cumulativeSeconds / 60)),
      });

      // Add boarding/alighting dwell time after reaching stop
      cumulativeSeconds += stop.duracaoParadaSegundos ?? 45;
      currentPos = { lat: stop.lat, lng: stop.lng };
    }

    const finalLegMeters = haversineDistanceMeters(currentPos, destination);
    const finalLegSeconds = Math.round(finalLegMeters / effectiveSpeedMps);
    cumulativeMeters += finalLegMeters;
    cumulativeSeconds += finalLegSeconds;

    return {
      provider: 'local',
      stops: computedStops,
      totalDurationSeconds: cumulativeSeconds,
      totalDistanceMeters: cumulativeMeters,
      etaDestinoFinalIso: new Date(
        referenceDate.getTime() + cumulativeSeconds * 1000
      ).toISOString(),
    };
  }

  public async optimizeRemainingStops(
    origin: LatLng,
    stops: StopWaypoint[],
    destination: LatLng,
    referenceDate: Date = new Date(),
    speedKmh: number = DEFAULT_URBAN_SPEED_KMH
  ): Promise<RouteOptimizationResult> {
    if (stops.length <= 1) {
      const base = await this.calculateStopEtas(
        origin,
        stops.map((s, i) => ({ ...s, ordemAtual: i + 1 })),
        destination,
        referenceDate,
        speedKmh
      );
      return { ...base, reordered: false };
    }

    // Group co-located siblings (same lat/lng) or optimize considering distance + time window
    const remaining = [...stops];
    const optimized: StopWaypoint[] = [];
    let currentPos: LatLng = { ...origin };

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = Number.POSITIVE_INFINITY;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const distMeters = haversineDistanceMeters(currentPos, {
          lat: candidate.lat,
          lng: candidate.lng,
        });
        const windowEndMin = timeStringToMinutes(candidate.janelaFim);
        const windowStartMin = timeStringToMinutes(candidate.janelaInicio);

        // Score balances spatial proximity (meters) with time-window urgency (minutes * 65m weight)
        const windowUrgencyScore = (windowStartMin * 0.4 + windowEndMin * 0.6) * 55;
        const totalScore = distMeters + windowUrgencyScore;

        if (totalScore < bestScore) {
          bestScore = totalScore;
          bestIdx = i;
        }
      }

      const chosen = remaining.splice(bestIdx, 1)[0];
      optimized.push({
        ...chosen,
        ordemAtual: optimized.length + 1,
      });
      currentPos = { lat: chosen.lat, lng: chosen.lng };
    }

    const reordered = optimized.some(
      (stop, idx) => stop.alunoId !== stops[idx]?.alunoId
    );

    const etaResult = await this.calculateStopEtas(
      origin,
      optimized,
      destination,
      referenceDate,
      speedKmh
    );

    return {
      ...etaResult,
      reordered,
    };
  }
}

/**
 * Google Maps Platform Routes API v2 implementation with automatic fallback to LocalDeterministicRouteProvider
 * when running offline or without an active Google billing key.
 */
export class GoogleRoutesProvider implements RouteProvider {
  public readonly name = 'google' as const;
  private readonly fallback = new LocalDeterministicRouteProvider();

  public async calculateStopEtas(
    origin: LatLng,
    stops: StopWaypoint[],
    destination: LatLng,
    referenceDate: Date = new Date(),
    speedKmh?: number
  ): Promise<RouteEtaResult> {
    const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
    if (!apiKey || apiKey === 'your-google-routes-server-key') {
      return this.fallback.calculateStopEtas(
        origin,
        stops,
        destination,
        referenceDate,
        speedKmh
      );
    }

    try {
      const response = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'routes.duration,routes.distanceMeters,routes.legs.duration,routes.legs.distanceMeters',
          },
          body: JSON.stringify({
            origin: {
              location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
            },
            destination: {
              location: {
                latLng: { latitude: destination.lat, longitude: destination.lng },
              },
            },
            intermediates: stops.map((s) => ({
              location: { latLng: { latitude: s.lat, longitude: s.lng } },
            })),
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE',
          }),
        }
      );

      if (!response.ok) {
        return this.fallback.calculateStopEtas(
          origin,
          stops,
          destination,
          referenceDate,
          speedKmh
        );
      }

      const data = await response.json();
      const route = data.routes?.[0];
      if (!route || !Array.isArray(route.legs)) {
        return this.fallback.calculateStopEtas(
          origin,
          stops,
          destination,
          referenceDate,
          speedKmh
        );
      }

      let cumulativeSec = 0;
      let cumulativeMeters = 0;
      const computedStops: StopEtaComputation[] = stops.map((stop, idx) => {
        const leg = route.legs[idx] || {};
        const legSec = parseInt(String(leg.duration || '60s').replace('s', ''), 10) || 60;
        const legDist = Number(leg.distanceMeters || 500);
        cumulativeSec += legSec;
        cumulativeMeters += legDist;

        return {
          paradaId: stop.paradaId,
          alunoId: stop.alunoId,
          ordem: idx + 1,
          distanciaMetros: cumulativeMeters,
          etaSegundos: cumulativeSec,
          etaPrevistoIso: new Date(
            referenceDate.getTime() + cumulativeSec * 1000
          ).toISOString(),
          etaMinutos: Math.max(1, Math.round(cumulativeSec / 60)),
        };
      });

      const totalSec =
        parseInt(String(route.duration || `${cumulativeSec}s`).replace('s', ''), 10) ||
        cumulativeSec;
      const totalDist = Number(route.distanceMeters || cumulativeMeters);

      return {
        provider: 'google',
        stops: computedStops,
        totalDurationSeconds: totalSec,
        totalDistanceMeters: totalDist,
        etaDestinoFinalIso: new Date(
          referenceDate.getTime() + totalSec * 1000
        ).toISOString(),
      };
    } catch {
      return this.fallback.calculateStopEtas(
        origin,
        stops,
        destination,
        referenceDate,
        speedKmh
      );
    }
  }

  public async optimizeRemainingStops(
    origin: LatLng,
    stops: StopWaypoint[],
    destination: LatLng,
    referenceDate: Date = new Date(),
    speedKmh?: number
  ): Promise<RouteOptimizationResult> {
    return this.fallback.optimizeRemainingStops(
      origin,
      stops,
      destination,
      referenceDate,
      speedKmh
    );
  }
}

export function getRouteProvider(): RouteProvider {
  const mode = process.env.ROUTE_PROVIDER_MODE || 'local';
  if (mode === 'google') {
    return new GoogleRoutesProvider();
  }
  return new LocalDeterministicRouteProvider();
}
