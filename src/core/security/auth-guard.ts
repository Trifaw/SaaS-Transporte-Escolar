import { cookies } from 'next/headers';
import {
  SEED_MOTORISTA_1_ID,
  SEED_TENANT_ID,
} from '@/lib/db/seed-data';
import type { ActorContext } from '@/lib/db/store';
import type { UserRole } from '@/types/database';

export const DEMO_SESSION_COOKIE = 'saas_te_demo_role';

export const DEMO_PROFILES: Record<UserRole, ActorContext> = {
  transportador: {
    userId: '00000000-0000-4000-8000-000000000001',
    transportadorId: SEED_TENANT_ID,
    role: 'transportador',
    motoristaId: null,
    responsavelId: null,
  },
  motorista: {
    userId: '00000000-0000-4000-8000-000000000002',
    transportadorId: SEED_TENANT_ID,
    role: 'motorista',
    motoristaId: SEED_MOTORISTA_1_ID,
    responsavelId: null,
  },
  responsavel: {
    userId: '00000000-0000-4000-8000-000000000004',
    transportadorId: SEED_TENANT_ID,
    role: 'responsavel',
    motoristaId: null,
    responsavelId: '55555555-5555-4555-8555-555555555501',
  },
};

export async function getCurrentActorContext(): Promise<ActorContext> {
  try {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get(DEMO_SESSION_COOKIE)?.value as UserRole | undefined;
    if (roleCookie && DEMO_PROFILES[roleCookie]) {
      return DEMO_PROFILES[roleCookie];
    }
  } catch {
    // Called outside request scope (e.g., unit test)
  }
  return DEMO_PROFILES.transportador;
}

export function verifyServiceToken(authHeader: string | null): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const expectedToken =
    process.env.AGENT_SERVICE_TOKEN || 'change-me-strong-service-token-min-32-chars';
  return token.length > 0 && token === expectedToken;
}
