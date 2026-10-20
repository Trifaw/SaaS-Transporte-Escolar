'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Truck, UserCheck, Building2 } from 'lucide-react';
import type { UserRole } from '@/types/database';

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole>('transportador');
  const [email, setEmail] = useState('contato@expressoescolar.com.br');
  const [password, setPassword] = useState('••••••••••••');
  const [loading, setLoading] = useState(false);

  const rolePresets: Record<
    UserRole,
    { label: string; email: string; subtitle: string; redirectTo: string }
  > = {
    transportador: {
      label: 'Transportador (Admin Tenant)',
      email: 'contato@expressoescolar.com.br',
      subtitle: 'Expresso Escolar Tia Ana — Acesso total ao painel, frota e financeiro',
      redirectTo: '/dashboard',
    },
    motorista: {
      label: 'Motorista (PWA Van 01)',
      email: 'carlos.motorista@expressoescolar.com.br',
      subtitle: 'Tio Carlos — Acesso restrito às próprias viagens e embarques do dia',
      redirectTo: '/driver',
    },
    responsavel: {
      label: 'Responsável (Mãe/Pai)',
      email: 'fernanda.costa@email.com',
      subtitle: 'Fernanda Costa — Acesso LGPD restrito aos filhos Lucas e Sofia',
      redirectTo: '/dashboard',
    },
  };

  function handleSelectRole(role: UserRole) {
    setSelectedRole(role);
    setEmail(rolePresets[role].email);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole }),
      });
      router.push(rolePresets[selectedRole].redirectTo);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold">
            <Truck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Expresso Escolar</h1>
            <p className="text-xs text-slate-500">
              Autenticação Multi-Tenant com RLS & Proteção LGPD
            </p>
          </div>
        </div>

        <div className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Selecione o Perfil de Acesso (Seed)
          </p>
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(rolePresets) as UserRole[]).map((role) => {
              const preset = rolePresets[role];
              const isSelected = selectedRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleSelectRole(role)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/30'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {role === 'transportador' && (
                    <Building2 className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  )}
                  {role === 'motorista' && (
                    <Truck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  )}
                  {role === 'responsavel' && (
                    <UserCheck className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{preset.label}</div>
                    <div className="text-xs text-slate-600">{preset.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Autenticando...' : `Entrar como ${rolePresets[selectedRole].label}`}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-2 rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            Conformidade LGPD ativa: todo acesso a dados de menores e GPS é auditado em{' '}
            <code className="font-mono text-slate-800">audit_access_log</code>.
          </span>
        </div>
      </div>
    </main>
  );
}
