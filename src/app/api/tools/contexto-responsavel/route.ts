import { NextResponse } from 'next/server';
import { verifyServiceToken } from '@/core/security/auth-guard';
import { contextoResponsavelQuerySchema } from '@/lib/validations/schemas';
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
  const parsed = contextoResponsavelQuerySchema.safeParse({
    telefone: searchParams.get('telefone') || '',
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

  const telefoneNormalizado = parsed.data.telefone;
  const state = dbStore.getState();

  const responsavel = state.responsaveis.find(
    (r) => r.telefone_whatsapp === telefoneNormalizado
  );

  if (!responsavel) {
    return NextResponse.json(
      { ok: false, errorCode: 'RESPONSAVEL_NAO_ENCONTRADO' },
      { status: 404 }
    );
  }

  const vinculos = state.alunoResponsaveis.filter(
    (ar) => ar.responsavel_id === responsavel.id
  );

  const alunos = vinculos
    .map((v) => {
      const aluno = state.alunos.find((a) => a.id === v.aluno_id);
      if (!aluno) return null;

      const escola = state.escolas.find((e) => e.id === aluno.escola_id);
      const paradasRota = state.paradas.filter((p) => p.aluno_id === aluno.id);
      const rotas = paradasRota
        .map((p) => {
          const rota = state.rotas.find((r) => r.id === p.rota_id);
          if (!rota) return null;
          const viagemHoje = state.viagens.find((vi) => vi.rota_id === rota.id);
          const paradaHoje = viagemHoje
            ? state.viagemParadas.find(
                (vp) => vp.viagem_id === viagemHoje.id && vp.aluno_id === aluno.id
              )
            : null;

          return {
            rotaId: rota.id,
            nome: rota.nome,
            turno: rota.turno,
            janelaInicio: p.janela_inicio,
            janelaFim: p.janela_fim,
            viagemHoje: viagemHoje
              ? {
                  viagemId: viagemHoje.id,
                  statusViagem: viagemHoje.status,
                  statusParadaAluno: paradaHoje?.status ?? null,
                  ordemAtual: paradaHoje?.ordem_atual ?? p.ordem,
                  etaPrevisto: paradaHoje?.eta_previsto ?? null,
                }
              : null,
          };
        })
        .filter(Boolean);

      return {
        id: aluno.id,
        nome: aluno.nome,
        serieTurma: aluno.serie_turma,
        enderecoResidencial: aluno.endereco_residencial,
        escola: escola
          ? {
              id: escola.id,
              nome: escola.nome,
            }
          : null,
        rotas,
      };
    })
    .filter(Boolean);

  recordLgpdAccessLog({
    actor: {
      userId: 'agent_service',
      transportadorId: responsavel.transportador_id,
      role: 'agent_service_token',
    },
    recurso: '/api/tools/contexto-responsavel',
    acao: 'READ_MINOR_PROFILE',
    metadata: {
      responsavelId: responsavel.id,
      telefone: telefoneNormalizado,
      alunosCount: alunos.length,
    },
  });

  return NextResponse.json({
    ok: true,
    responsavel: {
      id: responsavel.id,
      transportadorId: responsavel.transportador_id,
      nome: responsavel.nome,
      cpf: responsavel.cpf,
      telefoneWhatsapp: responsavel.telefone_whatsapp,
      email: responsavel.email,
    },
    alunos,
  });
}
