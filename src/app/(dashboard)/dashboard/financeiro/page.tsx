'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Wallet,
  QrCode,
  Copy,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  PlusCircle,
  ArrowLeft,
  RefreshCw,
  Zap,
} from 'lucide-react';
import type { StatusFatura } from '@/types/database';

interface EnrichedInvoice {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  aluno_serie: string;
  responsavel_id: string;
  responsavel_nome: string;
  responsavel_whatsapp: string;
  responsavel_cpf: string;
  competencia: string;
  valor_original: number;
  multa_aplicada: number;
  juros_aplicado: number;
  valor_total: number;
  data_vencimento: string;
  status: StatusFatura;
  external_charge_id: string | null;
  pix_txid: string | null;
  pix_qr_code_base64: string | null;
  pix_copia_e_cola: string | null;
  ultima_cobranca_enviada_em: string | null;
  pago_em: string | null;
}

interface FinanceOverviewResponse {
  ok: boolean;
  tenant: {
    nome: string;
    config_multa_percentual: number;
    config_juros_mensal_percentual: number;
    config_dia_vencimento_padrao: number;
  };
  kpis: {
    aReceber: number;
    inadimplencia: number;
    pagosNoMes: number;
    totalFaturas: number;
    inadimplentesCount: number;
  };
  faturas: EnrichedInvoice[];
  alunosDisponiveis: Array<{
    id: string;
    nome: string;
    valor_mensalidade: number;
    dia_vencimento: number;
  }>;
}

export default function FinanceiroDashboardPage() {
  const [data, setData] = useState<FinanceOverviewResponse | null>(null);
  const [filterStatus, setFilterStatus] = useState<'todas' | StatusFatura>('todas');
  const [selectedPixInvoice, setSelectedPixInvoice] = useState<EnrichedInvoice | null>(
    null
  );
  const [newInvoiceAlunoId, setNewInvoiceAlunoId] = useState<string>('');
  const [newInvoiceDueDate, setNewInvoiceDueDate] = useState<string>('2026-10-28');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadFinanceData = useCallback(async () => {
    const res = await fetch('/api/finance', { cache: 'no-store' });
    if (res.ok) {
      const json: FinanceOverviewResponse = await res.json();
      setData(json);
      if (!newInvoiceAlunoId && json.alunosDisponiveis[4]) {
        setNewInvoiceAlunoId(json.alunosDisponiveis[4].id);
      }
    }
  }, [newInvoiceAlunoId]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  async function handleAction(
    faturaId: string,
    acao: 'gerar_pix' | 'reenviar_cobranca' | 'simular_webhook_pix' | 'cancelar_fatura'
  ) {
    setBusyId(faturaId);
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, faturaId }),
      });
      const json = await res.json();
      await loadFinanceData();

      if (acao === 'gerar_pix' && json.fatura) {
        const refreshedList = await fetch('/api/finance').then((r) => r.json());
        const updated = refreshedList.faturas.find(
          (f: EnrichedInvoice) => f.id === faturaId
        );
        if (updated) setSelectedPixInvoice(updated);
        setFeedback('QR Code Pix e Copia-e-Cola gerados/atualizados com sucesso!');
      } else if (acao === 'reenviar_cobranca') {
        setFeedback(
          'Cobrança Pix reenviada e publicada em outbox_evento (fatura_vencendo)!'
        );
      } else if (acao === 'simular_webhook_pix') {
        setFeedback(
          json.idempotent
            ? 'Webhook reprocessado de forma idempotente (sem duplicar baixa)!'
            : 'Pagamento Pix confirmado via Webhook Asaas! Fatura baixada.'
        );
      } else if (acao === 'cancelar_fatura') {
        setFeedback('Fatura cancelada.');
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!newInvoiceAlunoId) return;
    setBusyId('new');
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'criar_fatura',
          alunoId: newInvoiceAlunoId,
          competencia: newInvoiceDueDate.slice(0, 7),
          dataVencimento: newInvoiceDueDate,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setFeedback('Nova mensalidade Pix gerada com sucesso!');
        await loadFinanceData();
      }
    } finally {
      setBusyId(null);
    }
  }

  function formatBRL(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-300">
          <RefreshCw className="h-5 w-5 animate-spin text-amber-400" />
          <span>Carregando painel financeiro Pix...</span>
        </div>
      </div>
    );
  }

  const filteredInvoices =
    filterStatus === 'todas'
      ? data.faturas
      : data.faturas.filter((f) => f.status === filterStatus);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-20 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Wallet className="h-5 w-5 text-amber-400" />
                Gestão Financeira & Cobranças Pix (Asaas)
              </h1>
              <p className="text-xs text-slate-400">
                Multa configurada: {data.tenant.config_multa_percentual}% • Juros:{' '}
                {data.tenant.config_juros_mensal_percentual}% a.m. • Vencimento padrão dia{' '}
                {data.tenant.config_dia_vencimento_padrao}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200"
            >
              Voltar ao Mapa ao Vivo
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {feedback && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-4 py-3 text-xs text-emerald-300 flex items-center justify-between">
            <span>{feedback}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-emerald-400 hover:underline font-bold"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Financial KPIs */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-400" />A Receber (Pendentes)
            </div>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {formatBRL(data.kpis.aReceber)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Dentro do vencimento</div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-rose-900/50 p-5">
            <div className="text-xs text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              Inadimplência (Vencidas)
            </div>
            <div className="text-2xl font-black text-rose-400 mt-1">
              {formatBRL(data.kpis.inadimplencia)}
            </div>
            <div className="text-xs text-rose-300/80 mt-1">
              {data.kpis.inadimplentesCount} fatura(s) com multa e juros
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-emerald-900/50 p-5">
            <div className="text-xs text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Pagos no Mês (Confirmados)
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {formatBRL(data.kpis.pagosNoMes)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Conciliados via Webhook Pix</div>
          </div>

          {/* Emitir Nova Mensalidade */}
          <form
            onSubmit={handleCreateInvoice}
            className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col justify-between gap-2"
          >
            <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <PlusCircle className="h-4 w-4 text-amber-400" />
              Emitir Nova Cobrança Pix
            </div>
            <select
              value={newInvoiceAlunoId}
              onChange={(e) => setNewInvoiceAlunoId(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white"
            >
              {data.alunosDisponiveis.map((al) => (
                <option key={al.id} value={al.id}>
                  {al.nome} ({formatBRL(al.valor_mensalidade)})
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={newInvoiceDueDate}
                onChange={(e) => setNewInvoiceDueDate(e.target.value)}
                className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-white"
              />
              <button
                type="submit"
                disabled={busyId === 'new'}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 cursor-pointer"
              >
                Gerar Pix
              </button>
            </div>
          </form>
        </section>

        {/* Filter Bar + Invoices Table */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(['todas', 'pendente', 'vencida', 'paga', 'cancelada'] as const).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFilterStatus(st)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-bold uppercase transition cursor-pointer ${
                      filterStatus === st
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                )
              )}
            </div>
            <span className="text-xs text-slate-400">
              Exibindo {filteredInvoices.length} fatura(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase">
                  <th className="py-3 px-3">Aluno / Responsável</th>
                  <th className="py-3 px-3">Competência / Venc.</th>
                  <th className="py-3 px-3">Valor / Encargos</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Ações Pix & Webhook</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-white text-sm">{inv.aluno_nome}</div>
                      <div className="text-slate-400">
                        Resp: {inv.responsavel_nome} ({inv.responsavel_whatsapp})
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-mono">
                      <div className="text-slate-200">{inv.competencia}</div>
                      <div className="text-slate-400">Venc: {inv.data_vencimento}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-sm text-white">
                        {formatBRL(inv.valor_total)}
                      </div>
                      {(inv.multa_aplicada > 0 || inv.juros_aplicado > 0) && (
                        <div className="text-[11px] text-rose-400">
                          Orig: {formatBRL(inv.valor_original)} + Multa{' '}
                          {formatBRL(inv.multa_aplicada)} + Juros{' '}
                          {formatBRL(inv.juros_aplicado)}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                          inv.status === 'paga'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : inv.status === 'vencida'
                            ? 'bg-rose-500/20 text-rose-300'
                            : inv.status === 'cancelada'
                            ? 'bg-slate-700 text-slate-400'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {inv.status !== 'cancelada' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!inv.pix_qr_code_base64 && inv.status !== 'paga') {
                                handleAction(inv.id, 'gerar_pix');
                              } else {
                                setSelectedPixInvoice(inv);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-slate-200 font-semibold cursor-pointer"
                          >
                            <QrCode className="h-3.5 w-3.5 text-amber-400" />
                            QR / Copia-e-Cola
                          </button>
                        )}

                        {(inv.status === 'pendente' || inv.status === 'vencida') && (
                          <>
                            <button
                              type="button"
                              disabled={busyId === inv.id}
                              onClick={() => handleAction(inv.id, 'reenviar_cobranca')}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 px-2.5 py-1.5 text-blue-300 font-semibold cursor-pointer"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Reenviar Cobrança
                            </button>

                            <button
                              type="button"
                              disabled={busyId === inv.id}
                              onClick={() => handleAction(inv.id, 'simular_webhook_pix')}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-2.5 py-1.5 text-slate-950 font-bold cursor-pointer"
                            >
                              <Zap className="h-3.5 w-3.5" />
                              Simular Webhook Pix
                            </button>

                            <button
                              type="button"
                              disabled={busyId === inv.id}
                              onClick={() => handleAction(inv.id, 'cancelar_fatura')}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 px-2 py-1.5 text-rose-300 cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pix QR Code & Copia-e-Cola Inspector Modal */}
        {selectedPixInvoice && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-amber-400" />
                  Fatura Pix — {selectedPixInvoice.aluno_nome}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedPixInvoice(null)}
                  className="text-slate-400 hover:text-white text-xs font-bold"
                >
                  FECHAR ✕
                </button>
              </div>

              <div className="rounded-xl bg-white p-4 flex flex-col items-center justify-center">
                {selectedPixInvoice.pix_qr_code_base64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedPixInvoice.pix_qr_code_base64}
                    alt="QR Code Pix"
                    className="h-44 w-44"
                  />
                ) : (
                  <div className="h-40 w-40 flex items-center justify-center text-slate-800 text-xs font-bold">
                    QR Code Disponível
                  </div>
                )}
                <span className="mt-2 text-xs font-mono font-bold text-slate-800">
                  Valor: {formatBRL(selectedPixInvoice.valor_total)} • Venc:{' '}
                  {selectedPixInvoice.data_vencimento}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Pix Copia-e-Cola (BRCode EMVCo):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={selectedPixInvoice.pix_copia_e_cola ?? ''}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs font-mono text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        selectedPixInvoice.pix_copia_e_cola ?? ''
                      );
                      setFeedback('Código Pix Copia-e-Cola copiado!');
                    }}
                    className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
