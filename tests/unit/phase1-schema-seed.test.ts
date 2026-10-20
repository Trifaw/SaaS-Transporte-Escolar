import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  dbStore,
  canActorAccessMinorData,
  type ActorContext,
} from '@/lib/db/store';
import {
  SEED_MOTORISTA_1_ID,
  SEED_MOTORISTA_2_ID,
  SEED_TENANT_ID,
} from '@/lib/db/seed-data';
import { recordLgpdAccessLog } from '@/core/security/lgpd-audit';

describe('Fase 1 — Schema, Auth, RLS, LGPD & Seed', () => {
  beforeEach(() => {
    dbStore.resetToSeed();
  });

  it('deve possuir as migrations SQL (0001, 0002, 0003) e seed.sql com todas as entidades obrigatórias', () => {
    const rootDir = process.cwd();
    const schemaSql = fs.readFileSync(
      path.join(rootDir, 'supabase/migrations/0001_core_schema.sql'),
      'utf-8'
    );
    const rlsSql = fs.readFileSync(
      path.join(rootDir, 'supabase/migrations/0002_rls_policies.sql'),
      'utf-8'
    );
    const rpcSql = fs.readFileSync(
      path.join(rootDir, 'supabase/migrations/0003_rpc_functions.sql'),
      'utf-8'
    );
    const seedSql = fs.readFileSync(path.join(rootDir, 'supabase/seed.sql'), 'utf-8');

    const requiredTables = [
      'transportador',
      'motorista',
      'veiculo',
      'escola',
      'aluno',
      'responsavel',
      'aluno_responsavel',
      'rota',
      'parada',
      'viagem',
      'viagem_parada',
      'evento_viagem',
      'posicao_veiculo',
      'fatura',
      'pagamento',
      'mensagem_log',
      'outbox_evento',
      'audit_access_log',
    ];

    for (const table of requiredTables) {
      expect(schemaSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
      expect(rlsSql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    }

    expect(rpcSql).toContain('commit_absence_reoptimization');
    expect(seedSql).toContain('Expresso Escolar Tia Ana');
  });

  it('deve conter no seed exatamente 1 transportador, 2 vans, 3 rotas e 25 alunos', () => {
    const state = dbStore.getState();

    expect(state.transportadores).toHaveLength(1);
    expect(state.veiculos).toHaveLength(2);
    expect(state.motoristas).toHaveLength(2);
    expect(state.rotas).toHaveLength(3);
    expect(state.alunos).toHaveLength(25);
    expect(state.responsaveis.length).toBeGreaterThanOrEqual(20);

    // Verifica que existem rotas de ida e volta
    const turnos = new Set(state.rotas.map((r) => r.turno));
    expect(turnos.has('ida')).toBe(true);
    expect(turnos.has('volta')).toBe(true);

    // Verifica viagem ativa com paradas instanciadas
    const viagemAtiva = state.viagens.find((v) => v.status === 'ativa');
    expect(viagemAtiva).toBeDefined();
    const paradasViagemAtiva = state.viagemParadas.filter(
      (vp) => vp.viagem_id === viagemAtiva!.id
    );
    expect(paradasViagemAtiva).toHaveLength(10);
  });

  it('deve aplicar isolamento RLS e LGPD: responsável só acessa seus próprios filhos vinculados', () => {
    const resp01: ActorContext = {
      userId: 'user-resp-01',
      transportadorId: SEED_TENANT_ID,
      role: 'responsavel',
      responsavelId: '55555555-5555-4555-8555-555555555501', // Mãe dos alunos 01 e 02
    };

    // Pode acessar seus filhos (01 e 02)
    expect(canActorAccessMinorData(resp01, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01')).toBe(
      true
    );
    expect(canActorAccessMinorData(resp01, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02')).toBe(
      true
    );

    // Não pode acessar filho de outro responsável (03)
    expect(canActorAccessMinorData(resp01, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03')).toBe(
      false
    );
  });

  it('deve aplicar isolamento RLS e LGPD: motorista só acessa alunos atribuídos às suas viagens', () => {
    const motorista1: ActorContext = {
      userId: 'user-mot-01',
      transportadorId: SEED_TENANT_ID,
      role: 'motorista',
      motoristaId: SEED_MOTORISTA_1_ID, // Atribuído à Viagem 1 (alunos 01..10)
    };

    const motorista2: ActorContext = {
      userId: 'user-mot-02',
      transportadorId: SEED_TENANT_ID,
      role: 'motorista',
      motoristaId: SEED_MOTORISTA_2_ID, // Atribuído à Viagem 2 (alunos 11..25)
    };

    expect(
      canActorAccessMinorData(motorista1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01')
    ).toBe(true);
    expect(
      canActorAccessMinorData(motorista1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15')
    ).toBe(false);

    expect(
      canActorAccessMinorData(motorista2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15')
    ).toBe(true);
    expect(
      canActorAccessMinorData(motorista2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01')
    ).toBe(false);
  });

  it('deve bloquear acesso entre tenants diferentes e registrar log de auditoria LGPD', () => {
    const outroTenantAdmin: ActorContext = {
      userId: 'user-outro-tenant',
      transportadorId: '99999999-0000-4000-8000-000000000000',
      role: 'transportador',
    };

    expect(
      canActorAccessMinorData(outroTenantAdmin, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01')
    ).toBe(false);

    const log = recordLgpdAccessLog({
      actor: outroTenantAdmin,
      alunoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
      recurso: 'status-viagem',
      acao: 'DENIED_ACCESS',
    });

    expect(log.id).toBeDefined();
    expect(dbStore.getState().auditAccessLogs[0].acao).toBe('DENIED_ACCESS');
  });
});
