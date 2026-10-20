import { NextResponse } from 'next/server';
import { dbStore, canActorAccessMinorData } from '@/lib/db/store';
import { getCurrentActorContext } from '@/core/security/auth-guard';
import { recordLgpdAccessLog } from '@/core/security/lgpd-audit';

export async function GET() {
  const actor = await getCurrentActorContext();
  const state = dbStore.getState();

  const tenant = state.transportadores.find((t) => t.id === actor.transportadorId);

  // Filter trips by tenant and role (LGPD enforcement)
  const viagens = state.viagens
    .filter((v) => v.transportador_id === actor.transportadorId)
    .map((viagem) => {
      const rota = state.rotas.find((r) => r.id === viagem.rota_id) || null;
      const veiculo = state.veiculos.find((ve) => ve.id === viagem.veiculo_id) || null;
      const motorista = state.motoristas.find((m) => m.id === viagem.motorista_id) || null;
      const escola = state.escolas.find((e) => e.id === rota?.escola_id) || null;

      const paradas = state.viagemParadas
        .filter((vp) => vp.viagem_id === viagem.id)
        .filter((vp) => canActorAccessMinorData(actor, vp.aluno_id))
        .sort((a, b) => a.ordem_atual - b.ordem_atual)
        .map((vp) => {
          const aluno = state.alunos.find((a) => a.id === vp.aluno_id);
          const vinculo = state.alunoResponsaveis.find((ar) => ar.aluno_id === vp.aluno_id);
          const responsavel = state.responsaveis.find(
            (r) => r.id === vinculo?.responsavel_id
          );
          return {
            ...vp,
            aluno_nome: aluno?.nome ?? 'Aluno',
            aluno_serie: aluno?.serie_turma ?? '',
            responsavel_nome: responsavel?.nome ?? '',
            responsavel_whatsapp: responsavel?.telefone_whatsapp ?? '',
          };
        });

      const concluidasCount = paradas.filter(
        (p) => p.status === 'embarcado' || p.status === 'desembarcado'
      ).length;
      const ausentesCount = paradas.filter((p) => p.status === 'ausente').length;
      const pendentesCount = paradas.filter((p) => p.status === 'pendente').length;

      return {
        ...viagem,
        rota,
        veiculo,
        motorista,
        escola,
        paradas,
        resumoParadas: {
          total: paradas.length,
          concluidas: concluidasCount,
          ausentes: ausentesCount,
          pendentes: pendentesCount,
        },
      };
    });

  recordLgpdAccessLog({
    actor,
    recurso: 'dashboard-live-map',
    acao: 'READ_LOCATION',
    metadata: { tripsCount: viagens.length, role: actor.role },
  });

  return NextResponse.json({
    ok: true,
    actor,
    tenant,
    viagens,
    eventosRecentes: state.eventosViagem.slice(0, 20),
    outboxRecentes: state.outboxEventos.slice(0, 20),
    auditLogsRecentes: state.auditAccessLogs.slice(0, 10),
  });
}
