import { NextResponse } from 'next/server';
import { verifyServiceToken } from '@/core/security/auth-guard';
import { statusViagemQuerySchema } from '@/lib/validations/schemas';
import { dbStore } from '@/lib/db/store';
import { recordLgpdAccessLog } from '@/core/security/lgpd-audit';

export async function GET(request: Request) {
  if (!verifyServiceToken(request.headers.get('authorization'))) {
    return NextResponse.json(
      { ok: false, errorCode: 'UNAUTHORIZED_SERVICE_TOKEN' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = statusViagemQuerySchema.safeParse({
    alunoId: searchParams.get('alunoId'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        issues: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }

  const { alunoId } = parsed.data;
  const state = dbStore.getState();

  const aluno = state.alunos.find((a) => a.id === alunoId);
  if (!aluno) {
    return NextResponse.json(
      { ok: false, errorCode: 'ALUNO_NAO_ENCONTRADO' },
      { status: 404 }
    );
  }

  // Localiza parada do aluno em viagem ativa (ou última viagem do dia)
  const paradasDoAluno = state.viagemParadas.filter((vp) => vp.aluno_id === alunoId);
  const paradaAtiva =
    paradasDoAluno.find((vp) => {
      const v = state.viagens.find((vi) => vi.id === vp.viagem_id);
      return v?.status === 'ativa';
    }) ?? paradasDoAluno[0];

  if (!paradaAtiva) {
    return NextResponse.json(
      { ok: false, errorCode: 'VIAGEM_NAO_ENCONTRADA' },
      { status: 404 }
    );
  }

  const viagem = state.viagens.find((v) => v.id === paradaAtiva.viagem_id);
  if (!viagem) {
    return NextResponse.json(
      { ok: false, errorCode: 'VIAGEM_NAO_ENCONTRADA' },
      { status: 404 }
    );
  }

  const veiculo = state.veiculos.find((ve) => ve.id === viagem.veiculo_id);
  const motorista = state.motoristas.find((m) => m.id === viagem.motorista_id);

  // Parada atual (primeira parada pendente da viagem)
  const proximaParadaViagem = state.viagemParadas
    .filter((vp) => vp.viagem_id === viagem.id && vp.status === 'pendente')
    .sort((a, b) => a.ordem_atual - b.ordem_atual)[0];

  recordLgpdAccessLog({
    actor: {
      userId: 'agent_service',
      transportadorId: aluno.transportador_id,
      role: 'agent_service_token',
    },
    alunoId: aluno.id,
    recurso: '/api/tools/status-viagem',
    acao: 'READ_LOCATION',
    metadata: { viagemId: viagem.id },
  });

  const etaMinutos = paradaAtiva.eta_previsto
    ? Math.max(
        1,
        Math.round((new Date(paradaAtiva.eta_previsto).getTime() - Date.now()) / 60_000)
      )
    : null;

  return NextResponse.json({
    ok: true,
    viagemId: viagem.id,
    statusViagem: viagem.status,
    versaoRota: viagem.versao_rota,
    aluno: {
      id: aluno.id,
      nome: aluno.nome,
      statusParada: paradaAtiva.status,
      ordemAtual: paradaAtiva.ordem_atual,
      etaPrevisto: paradaAtiva.eta_previsto,
      etaMinutos,
      janelaInicio: paradaAtiva.janela_inicio,
      janelaFim: paradaAtiva.janela_fim,
    },
    posicaoVan: {
      lat: viagem.ultima_lat,
      lng: viagem.ultima_lng,
      velocidadeKmh: viagem.ultima_velocidade_kmh,
      atualizadoEm: viagem.ultima_atualizacao_gps,
      veiculoApelido: veiculo?.apelido ?? null,
      veiculoPlaca: veiculo?.placa ?? null,
      motoristaNome: motorista?.nome ?? null,
    },
    paradaAtualDaVan: proximaParadaViagem
      ? {
          paradaId: proximaParadaViagem.parada_id,
          alunoId: proximaParadaViagem.aluno_id,
          ordem: proximaParadaViagem.ordem_atual,
          endereco: proximaParadaViagem.endereco,
        }
      : null,
  });
}
