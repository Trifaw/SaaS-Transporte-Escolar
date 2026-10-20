import Link from 'next/link';
import { Truck, ShieldCheck, MapPin, Wallet, Smartphone } from 'lucide-react';
import { dbStore } from '@/lib/db/store';

export default function HomePage() {
  const state = dbStore.getState();
  const tenant = state.transportadores[0];

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold">
              <Truck className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{tenant.nome}</h1>
              <p className="text-sm text-slate-400">
                SaaS de Transporte Escolar — Tenant CNPJ {tenant.cnpj_cpf}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              Alternar Perfil (Auth / RLS)
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition"
            >
              Painel do Transportador
            </Link>
            <Link
              href="/driver"
              className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition"
            >
              App do Motorista (PWA)
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
            <div className="text-xs text-slate-400">Vans / Motoristas</div>
            <div className="text-3xl font-bold mt-1">{state.veiculos.length}</div>
            <div className="text-xs text-emerald-400 mt-1">100% operacionais</div>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
            <div className="text-xs text-slate-400">Rotas Ativas</div>
            <div className="text-3xl font-bold mt-1">{state.rotas.length}</div>
            <div className="text-xs text-slate-400 mt-1">2 Ida • 1 Volta</div>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
            <div className="text-xs text-slate-400">Alunos Cadastrados</div>
            <div className="text-3xl font-bold mt-1">{state.alunos.length}</div>
            <div className="text-xs text-slate-400 mt-1">
              {state.responsaveis.length} responsáveis WhatsApp
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
            <div className="text-xs text-slate-400">Viagens de Hoje</div>
            <div className="text-3xl font-bold mt-1">{state.viagens.length}</div>
            <div className="text-xs text-amber-400 mt-1">1 em andamento agora</div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-3">
            <MapPin className="h-6 w-6 text-amber-400" />
            <h2 className="text-lg font-bold">Mapeamento & GPS ao Vivo</h2>
            <p className="text-sm text-slate-400">
              Telemetria a cada 5–10s, cálculo de ETA por parada e alertas proativos de{' '}
              <code>van_chegando</code> e <code>atraso</code>.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-3">
            <Smartphone className="h-6 w-6 text-emerald-400" />
            <h2 className="text-lg font-bold">App do Motorista (PWA)</h2>
            <p className="text-sm text-slate-400">
              Uso com uma mão, alto contraste, fila offline e alerta sonoro imediato em{' '}
              <code>&lt;3s</code> quando <code>applyAbsence</code> recalcula a rota.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-3">
            <Wallet className="h-6 w-6 text-blue-400" />
            <h2 className="text-lg font-bold">Financeiro Pix & Tools</h2>
            <p className="text-sm text-slate-400">
              Cobrança Pix via Asaas com webhook idempotente, WhatsApp Meta Cloud API e contrato
              OpenAPI para o Agente.
            </p>
          </div>
        </section>

        <footer className="flex items-center gap-2 text-xs text-slate-500 pt-4">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>
            RLS por Transportador + Conformidade LGPD para dados de menores e localização.
          </span>
        </footer>
      </div>
    </main>
  );
}
