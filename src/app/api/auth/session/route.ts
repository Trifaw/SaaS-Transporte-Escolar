import { NextResponse } from 'next/server';
import { DEMO_PROFILES, DEMO_SESSION_COOKIE } from '@/core/security/auth-guard';
import { userRoleSchema } from '@/lib/validations/schemas';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = userRoleSchema.safeParse(body.role);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errorCode: 'VALIDATION_ERROR', message: 'Perfil inválido' },
      { status: 422 }
    );
  }

  const profile = DEMO_PROFILES[parsed.data];
  const response = NextResponse.json({
    ok: true,
    profile,
  });

  response.cookies.set(DEMO_SESSION_COOKIE, parsed.data, {
    httpOnly: false,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
