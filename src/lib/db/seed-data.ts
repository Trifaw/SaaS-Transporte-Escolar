import type {
  Aluno,
  AlunoResponsavel,
  Escola,
  Fatura,
  Motorista,
  Parada,
  PosicaoVeiculo,
  Responsavel,
  Rota,
  Transportador,
  UsuarioPerfil,
  Veiculo,
  Viagem,
  ViagemParada,
} from '@/types/database';

export const SEED_TENANT_ID = '11111111-1111-4111-8111-111111111111';

export const SEED_MOTORISTA_1_ID = '22222222-2222-4222-8222-222222222201';
export const SEED_MOTORISTA_2_ID = '22222222-2222-4222-8222-222222222202';

export const SEED_VEICULO_1_ID = '33333333-3333-4333-8333-333333333301';
export const SEED_VEICULO_2_ID = '33333333-3333-4333-8333-333333333302';

export const SEED_ESCOLA_1_ID = '44444444-4444-4444-8444-444444444401';
export const SEED_ESCOLA_2_ID = '44444444-4444-4444-8444-444444444402';

export const SEED_ROTA_1_ID = '66666666-6666-4666-8666-666666666601';
export const SEED_ROTA_2_ID = '66666666-6666-4666-8666-666666666602';
export const SEED_ROTA_3_ID = '66666666-6666-4666-8666-666666666603';

export const SEED_VIAGEM_ATIVA_ID = '77777777-7777-4777-8777-777777777701';
export const SEED_VIAGEM_AGENDADA_ID = '77777777-7777-4777-8777-777777777702';

const BASE_TIMESTAMP = '2026-10-19T09:00:00.000Z';

export function buildSeedDataset() {
  const transportadores: Transportador[] = [
    {
      id: SEED_TENANT_ID,
      nome: 'Expresso Escolar Tia Ana',
      razao_social: 'Expresso Escolar Tia Ana Transportes Ltda',
      cnpj_cpf: '12.345.678/0001-90',
      telefone: '+5511988880000',
      email: 'contato@expressoescolar.com.br',
      config_van_chegando_minutos: 5,
      config_atraso_minutos: 10,
      config_multa_percentual: 2.0,
      config_juros_mensal_percentual: 1.0,
      config_dia_vencimento_padrao: 10,
      ativo: true,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
  ];

  const motoristas: Motorista[] = [
    {
      id: SEED_MOTORISTA_1_ID,
      transportador_id: SEED_TENANT_ID,
      user_id: '00000000-0000-4000-8000-000000000002',
      nome: 'Carlos Eduardo Silva',
      cpf: '111.222.333-44',
      cnh: '12345678901',
      telefone: '+5511988880001',
      email: 'carlos.motorista@expressoescolar.com.br',
      ativo: true,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
    {
      id: SEED_MOTORISTA_2_ID,
      transportador_id: SEED_TENANT_ID,
      user_id: '00000000-0000-4000-8000-000000000003',
      nome: 'Roberto Alves Santos',
      cpf: '555.666.777-88',
      cnh: '98765432109',
      telefone: '+5511988880002',
      email: 'roberto.motorista@expressoescolar.com.br',
      ativo: true,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
  ];

  const veiculos: Veiculo[] = [
    {
      id: SEED_VEICULO_1_ID,
      transportador_id: SEED_TENANT_ID,
      motorista_padrao_id: SEED_MOTORISTA_1_ID,
      apelido: 'Van 01 - Tio Carlos',
      placa: 'ABC1D23',
      modelo: 'Mercedes-Benz Sprinter 416 Escolar',
      capacidade: 15,
      ano: 2024,
      ativo: true,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
    {
      id: SEED_VEICULO_2_ID,
      transportador_id: SEED_TENANT_ID,
      motorista_padrao_id: SEED_MOTORISTA_2_ID,
      apelido: 'Van 02 - Tio Beto',
      placa: 'XYZ9E87',
      modelo: 'Fiat Ducato Minibus Escolar',
      capacidade: 15,
      ano: 2023,
      ativo: true,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
  ];

  const escolas: Escola[] = [
    {
      id: SEED_ESCOLA_1_ID,
      transportador_id: SEED_TENANT_ID,
      nome: 'Colégio Dom Pedro II - Unidade Moema',
      endereco: 'Av. Lavandisca, 500 - Moema, São Paulo - SP',
      lat: -23.6015,
      lng: -46.6652,
      telefone: '+551150510001',
      contato_portaria: 'Portaria Principal - Sr. Marcos',
      horario_entrada_manha: '07:15',
      horario_saida_manha: '12:15',
      horario_entrada_tarde: '13:15',
      horario_saida_tarde: '17:45',
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
    {
      id: SEED_ESCOLA_2_ID,
      transportador_id: SEED_TENANT_ID,
      nome: 'Escola Viva Infância - Vila Mariana',
      endereco: 'Rua Domingos de Morais, 1800 - Vila Mariana, São Paulo - SP',
      lat: -23.5912,
      lng: -46.6368,
      telefone: '+551155720002',
      contato_portaria: 'Recepção Infantil - Dona Helena',
      horario_entrada_manha: '07:30',
      horario_saida_manha: '12:00',
      horario_entrada_tarde: '13:30',
      horario_saida_tarde: '18:00',
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
  ];

  const responsavelSpecs = [
    ['01', 'Fernanda Oliveira Costa', 'Al. dos Maracatins, 320 - Moema'],
    ['02', 'Ricardo Mendes Almeida', 'Rua Gaivota, 610 - Moema'],
    ['03', 'Juliana Pereira Souza', 'Rua Canário, 890 - Moema'],
    ['04', 'Marcelo Ribeiro Lima', 'Av. Rouxinol, 210 - Moema'],
    ['05', 'Camila Ferreira Rocha', 'Al. dos Nhambiquaras, 1020 - Indianópolis'],
    ['06', 'André Luiz Martins', 'Al. dos Anapurus, 740 - Indianópolis'],
    ['07', 'Patrícia Gomes Barbosa', 'Rua Inhambu, 1150 - Moema'],
    ['08', 'Gustavo Henrique Cardoso', 'Rua Tuim, 430 - Moema'],
    ['09', 'Beatriz Castro Teixeira', 'Rua França Pinto, 310 - Vila Mariana'],
    ['10', 'Thiago Nascimento Dias', 'Rua Morgado de Mateus, 450 - Vila Mariana'],
    ['11', 'Larissa Moreira Araújo', 'Rua Pelotas, 280 - Vila Mariana'],
    ['12', 'Felipe Augusto Correia', 'Rua Humberto I, 620 - Vila Mariana'],
    ['13', 'Vanessa Carvalho Nunes', 'Rua Joaquim Távora, 950 - Vila Mariana'],
    ['14', 'Daniel Monteiro Vieira', 'Rua Sena Madureira, 780 - Vila Mariana'],
    ['15', 'Aline Freitas Cavalcanti', 'Rua Borges Lagoa, 540 - Vila Clementino'],
    ['16', 'Leonardo Barros Peixoto', 'Rua Pedro de Toledo, 410 - Vila Clementino'],
    ['17', 'Renata Campos Machado', 'Rua Loefgren, 1120 - Vila Clementino'],
    ['18', 'Eduardo Batista Ramos', 'Rua Botucatu, 670 - Vila Mariana'],
    ['19', 'Tatiana Duarte Azevedo', 'Rua Afonso Celso, 830 - Vila Mariana'],
    ['20', 'Rodrigo Cunha Melo', 'Rua Luís Góis, 990 - Saúde'],
  ] as const;

  const responsaveis: Responsavel[] = responsavelSpecs.map(([num, nome, endereco], idx) => ({
    id: `55555555-5555-4555-8555-5555555555${num}`,
    transportador_id: SEED_TENANT_ID,
    user_id: idx === 0 ? '00000000-0000-4000-8000-000000000004' : null,
    nome,
    cpf: `201.301.401-${num}`,
    telefone_whatsapp: `+55119910000${num}`,
    email: `responsavel${num}@email.com`,
    endereco,
    asaas_customer_id: `cus_0000000000${num}`,
    ativo: true,
    created_at: BASE_TIMESTAMP,
    updated_at: BASE_TIMESTAMP,
  }));

  const alunoSpecs: Array<{
    num: string;
    escolaId: string;
    nome: string;
    nasc: string;
    serie: string;
    endereco: string;
    lat: number;
    lng: number;
    mensalidade: number;
    respNum: string;
    obs: string | null;
  }> = [
    { num: '01', escolaId: SEED_ESCOLA_1_ID, nome: 'Lucas Oliveira Costa', nasc: '2016-03-14', serie: '4º Ano A', endereco: 'Al. dos Maracatins, 320 - Moema', lat: -23.6062, lng: -46.6601, mensalidade: 480, respNum: '01', obs: null },
    { num: '02', escolaId: SEED_ESCOLA_1_ID, nome: 'Sofia Oliveira Costa', nasc: '2018-07-22', serie: '2º Ano B', endereco: 'Al. dos Maracatins, 320 - Moema', lat: -23.6062, lng: -46.6601, mensalidade: 450, respNum: '01', obs: 'Usa assento de elevação' },
    { num: '03', escolaId: SEED_ESCOLA_1_ID, nome: 'Pedro Mendes Almeida', nasc: '2015-11-05', serie: '5º Ano A', endereco: 'Rua Gaivota, 610 - Moema', lat: -23.6048, lng: -46.6625, mensalidade: 480, respNum: '02', obs: null },
    { num: '04', escolaId: SEED_ESCOLA_1_ID, nome: 'Helena Pereira Souza', nasc: '2017-01-19', serie: '3º Ano C', endereco: 'Rua Canário, 890 - Moema', lat: -23.6031, lng: -46.6641, mensalidade: 480, respNum: '03', obs: 'Alergia leve a amendoim' },
    { num: '05', escolaId: SEED_ESCOLA_1_ID, nome: 'Gabriel Ribeiro Lima', nasc: '2016-09-30', serie: '4º Ano B', endereco: 'Av. Rouxinol, 210 - Moema', lat: -23.602, lng: -46.668, mensalidade: 490, respNum: '04', obs: null },
    { num: '06', escolaId: SEED_ESCOLA_1_ID, nome: 'Alice Ferreira Rocha', nasc: '2017-05-12', serie: '3º Ano A', endereco: 'Al. dos Nhambiquaras, 1020 - Indianópolis', lat: -23.6085, lng: -46.6589, mensalidade: 500, respNum: '05', obs: null },
    { num: '07', escolaId: SEED_ESCOLA_1_ID, nome: 'Miguel Ferreira Rocha', nasc: '2019-08-08', serie: '1º Ano A', endereco: 'Al. dos Nhambiquaras, 1020 - Indianópolis', lat: -23.6085, lng: -46.6589, mensalidade: 450, respNum: '05', obs: 'Irmão da Alice' },
    { num: '08', escolaId: SEED_ESCOLA_1_ID, nome: 'Laura Luiz Martins', nasc: '2015-04-25', serie: '5º Ano B', endereco: 'Al. dos Anapurus, 740 - Indianópolis', lat: -23.6071, lng: -46.6612, mensalidade: 480, respNum: '06', obs: null },
    { num: '09', escolaId: SEED_ESCOLA_1_ID, nome: 'Arthur Gomes Barbosa', nasc: '2016-12-02', serie: '4º Ano A', endereco: 'Rua Inhambu, 1150 - Moema', lat: -23.6005, lng: -46.6695, mensalidade: 480, respNum: '07', obs: null },
    { num: '10', escolaId: SEED_ESCOLA_1_ID, nome: 'Valentina Henrique Cardoso', nasc: '2018-02-14', serie: '2º Ano A', endereco: 'Rua Tuim, 430 - Moema', lat: -23.5998, lng: -46.6672, mensalidade: 480, respNum: '08', obs: null },
    { num: '11', escolaId: SEED_ESCOLA_2_ID, nome: 'Bernardo Castro Teixeira', nasc: '2019-06-11', serie: 'Infantil II', endereco: 'Rua França Pinto, 310 - Vila Mariana', lat: -23.5872, lng: -46.6391, mensalidade: 520, respNum: '09', obs: null },
    { num: '12', escolaId: SEED_ESCOLA_2_ID, nome: 'Manuela Nascimento Dias', nasc: '2018-10-03', serie: '1º Ano B', endereco: 'Rua Morgado de Mateus, 450 - Vila Mariana', lat: -23.5889, lng: -46.6375, mensalidade: 520, respNum: '10', obs: null },
    { num: '13', escolaId: SEED_ESCOLA_2_ID, nome: 'Heitor Moreira Araújo', nasc: '2017-09-17', serie: '2º Ano A', endereco: 'Rua Pelotas, 280 - Vila Mariana', lat: -23.5861, lng: -46.6422, mensalidade: 520, respNum: '11', obs: null },
    { num: '14', escolaId: SEED_ESCOLA_2_ID, nome: 'Clara Moreira Araújo', nasc: '2020-01-29', serie: 'Infantil I', endereco: 'Rua Pelotas, 280 - Vila Mariana', lat: -23.5861, lng: -46.6422, mensalidade: 490, respNum: '11', obs: 'Cadeirinha infantil' },
    { num: '15', escolaId: SEED_ESCOLA_2_ID, nome: 'Davi Augusto Correia', nasc: '2018-04-09', serie: '1º Ano A', endereco: 'Rua Humberto I, 620 - Vila Mariana', lat: -23.5895, lng: -46.6352, mensalidade: 520, respNum: '12', obs: null },
    { num: '16', escolaId: SEED_ESCOLA_2_ID, nome: 'Júlia Carvalho Nunes', nasc: '2017-12-21', serie: '2º Ano B', endereco: 'Rua Joaquim Távora, 950 - Vila Mariana', lat: -23.5881, lng: -46.6339, mensalidade: 520, respNum: '13', obs: null },
    { num: '17', escolaId: SEED_ESCOLA_2_ID, nome: 'Lorenzo Monteiro Vieira', nasc: '2019-03-04', serie: 'Infantil II', endereco: 'Rua Sena Madureira, 780 - Vila Mariana', lat: -23.5928, lng: -46.641, mensalidade: 520, respNum: '14', obs: null },
    { num: '18', escolaId: SEED_ESCOLA_2_ID, nome: 'Isabella Freitas Cavalcanti', nasc: '2016-08-15', serie: '3º Ano A', endereco: 'Rua Borges Lagoa, 540 - Vila Clementino', lat: -23.5961, lng: -46.6435, mensalidade: 540, respNum: '15', obs: null },
    { num: '19', escolaId: SEED_ESCOLA_2_ID, nome: 'Theo Freitas Cavalcanti', nasc: '2019-11-11', serie: 'Infantil II', endereco: 'Rua Borges Lagoa, 540 - Vila Clementino', lat: -23.5961, lng: -46.6435, mensalidade: 500, respNum: '15', obs: null },
    { num: '20', escolaId: SEED_ESCOLA_2_ID, nome: 'Lívia Barros Peixoto', nasc: '2017-07-07', serie: '2º Ano C', endereco: 'Rua Pedro de Toledo, 410 - Vila Clementino', lat: -23.5974, lng: -46.6418, mensalidade: 520, respNum: '16', obs: null },
    { num: '21', escolaId: SEED_ESCOLA_2_ID, nome: 'Gael Campos Machado', nasc: '2018-05-26', serie: '1º Ano B', endereco: 'Rua Loefgren, 1120 - Vila Clementino', lat: -23.5989, lng: -46.6392, mensalidade: 520, respNum: '17', obs: null },
    { num: '22', escolaId: SEED_ESCOLA_2_ID, nome: 'Giovanna Batista Ramos', nasc: '2016-10-18', serie: '3º Ano B', endereco: 'Rua Botucatu, 670 - Vila Mariana', lat: -23.5952, lng: -46.6378, mensalidade: 520, respNum: '18', obs: null },
    { num: '23', escolaId: SEED_ESCOLA_2_ID, nome: 'Noah Batista Ramos', nasc: '2019-02-28', serie: 'Infantil II', endereco: 'Rua Botucatu, 670 - Vila Mariana', lat: -23.5952, lng: -46.6378, mensalidade: 490, respNum: '18', obs: null },
    { num: '24', escolaId: SEED_ESCOLA_2_ID, nome: 'Maria Eduarda Duarte Azevedo', nasc: '2017-04-13', serie: '2º Ano A', endereco: 'Rua Afonso Celso, 830 - Vila Mariana', lat: -23.6001, lng: -46.6361, mensalidade: 520, respNum: '19', obs: null },
    { num: '25', escolaId: SEED_ESCOLA_2_ID, nome: 'Samuel Cunha Melo', nasc: '2016-06-30', serie: '3º Ano A', endereco: 'Rua Luís Góis, 990 - Saúde', lat: -23.6035, lng: -46.6348, mensalidade: 540, respNum: '20', obs: null },
  ];

  const alunos: Aluno[] = alunoSpecs.map((spec) => ({
    id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${spec.num}`,
    transportador_id: SEED_TENANT_ID,
    escola_id: spec.escolaId,
    nome: spec.nome,
    data_nascimento: spec.nasc,
    serie_turma: spec.serie,
    endereco_residencial: spec.endereco,
    lat: spec.lat,
    lng: spec.lng,
    valor_mensalidade: spec.mensalidade,
    dia_vencimento: 10,
    observacoes_medicas: spec.obs,
    ativo: true,
    created_at: BASE_TIMESTAMP,
    updated_at: BASE_TIMESTAMP,
  }));

  const alunoResponsaveis: AlunoResponsavel[] = alunoSpecs.map((spec) => ({
    id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb${spec.num}`,
    transportador_id: SEED_TENANT_ID,
    aluno_id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${spec.num}`,
    responsavel_id: `55555555-5555-4555-8555-5555555555${spec.respNum}`,
    parentesco: 'Mãe/Pai',
    responsavel_financeiro: true,
    pode_registrar_ausencia: true,
    created_at: BASE_TIMESTAMP,
  }));

  const usuarioPerfis: UsuarioPerfil[] = [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
      user_id: '00000000-0000-4000-8000-000000000001',
      transportador_id: SEED_TENANT_ID,
      role: 'transportador',
      motorista_id: null,
      responsavel_id: null,
      created_at: BASE_TIMESTAMP,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc02',
      user_id: '00000000-0000-4000-8000-000000000002',
      transportador_id: SEED_TENANT_ID,
      role: 'motorista',
      motorista_id: SEED_MOTORISTA_1_ID,
      responsavel_id: null,
      created_at: BASE_TIMESTAMP,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc03',
      user_id: '00000000-0000-4000-8000-000000000003',
      transportador_id: SEED_TENANT_ID,
      role: 'motorista',
      motorista_id: SEED_MOTORISTA_2_ID,
      responsavel_id: null,
      created_at: BASE_TIMESTAMP,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc04',
      user_id: '00000000-0000-4000-8000-000000000004',
      transportador_id: SEED_TENANT_ID,
      role: 'responsavel',
      motorista_id: null,
      responsavel_id: '55555555-5555-4555-8555-555555555501',
      created_at: BASE_TIMESTAMP,
    },
  ];

  const rotas: Rota[] = [
    {
      id: SEED_ROTA_1_ID,
      transportador_id: SEED_TENANT_ID,
      escola_id: SEED_ESCOLA_1_ID,
      veiculo_id: SEED_VEICULO_1_ID,
      motorista_id: SEED_MOTORISTA_1_ID,
      nome: 'Rota 01 - Manhã Ida (Moema/Indianópolis -> Colégio Dom Pedro II)',
      turno: 'ida',
      ponto_partida_nome: 'Garagem Moema - Av. Moreira Guimarães, 900',
      ponto_partida_lat: -23.6102,
      ponto_partida_lng: -46.657,
      horario_inicio_previsto: '06:15',
      horario_chegada_escola_previsto: '07:10',
      ativa: true,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
    {
      id: SEED_ROTA_2_ID,
      transportador_id: SEED_TENANT_ID,
      escola_id: SEED_ESCOLA_1_ID,
      veiculo_id: SEED_VEICULO_1_ID,
      motorista_id: SEED_MOTORISTA_1_ID,
      nome: 'Rota 02 - Meio-Dia Volta (Colégio Dom Pedro II -> Moema/Indianópolis)',
      turno: 'volta',
      ponto_partida_nome: 'Colégio Dom Pedro II - Av. Lavandisca, 500',
      ponto_partida_lat: -23.6015,
      ponto_partida_lng: -46.6652,
      horario_inicio_previsto: '12:15',
      horario_chegada_escola_previsto: '13:10',
      ativa: true,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
    {
      id: SEED_ROTA_3_ID,
      transportador_id: SEED_TENANT_ID,
      escola_id: SEED_ESCOLA_2_ID,
      veiculo_id: SEED_VEICULO_2_ID,
      motorista_id: SEED_MOTORISTA_2_ID,
      nome: 'Rota 03 - Tarde Ida (Vila Mariana/Saúde -> Escola Viva Infância)',
      turno: 'ida',
      ponto_partida_nome: 'Base Vila Mariana - Rua Domingos de Morais, 2400',
      ponto_partida_lat: -23.599,
      ponto_partida_lng: -46.6365,
      horario_inicio_previsto: '12:20',
      horario_chegada_escola_previsto: '13:25',
      ativa: true,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
  ];

  const rota1Order = ['06', '07', '08', '01', '02', '03', '04', '05', '09', '10'];
  const rota1Windows: Array<[string, string]> = [
    ['06:18', '06:25'],
    ['06:18', '06:25'],
    ['06:24', '06:32'],
    ['06:30', '06:38'],
    ['06:30', '06:38'],
    ['06:36', '06:45'],
    ['06:42', '06:50'],
    ['06:48', '06:56'],
    ['06:54', '07:02'],
    ['06:58', '07:08'],
  ];

  const paradasRota1: Parada[] = rota1Order.map((alunoNum, idx) => {
    const aluno = alunos.find((a) => a.id.endsWith(alunoNum))!;
    const ord = idx + 1;
    const ordStr = String(ord).padStart(2, '0');
    return {
      id: `88888888-8888-4888-8888-8888888881${ordStr}`,
      transportador_id: SEED_TENANT_ID,
      rota_id: SEED_ROTA_1_ID,
      aluno_id: aluno.id,
      endereco: aluno.endereco_residencial,
      lat: aluno.lat,
      lng: aluno.lng,
      ordem: ord,
      janela_inicio: rota1Windows[idx][0],
      janela_fim: rota1Windows[idx][1],
      duracao_parada_segundos: 60,
      ativa: true,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    };
  });

  const rota2Order = [...rota1Order].reverse();
  const paradasRota2: Parada[] = rota2Order.map((alunoNum, idx) => {
    const aluno = alunos.find((a) => a.id.endsWith(alunoNum))!;
    const ord = idx + 1;
    const ordStr = String(ord).padStart(2, '0');
    return {
      id: `88888888-8888-4888-8888-8888888882${ordStr}`,
      transportador_id: SEED_TENANT_ID,
      rota_id: SEED_ROTA_2_ID,
      aluno_id: aluno.id,
      endereco: aluno.endereco_residencial,
      lat: aluno.lat,
      lng: aluno.lng,
      ordem: ord,
      janela_inicio: '12:20',
      janela_fim: '13:10',
      duracao_parada_segundos: 60,
      ativa: true,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    };
  });

  const rota3Order = [
    '25',
    '24',
    '21',
    '20',
    '18',
    '19',
    '22',
    '23',
    '17',
    '15',
    '12',
    '16',
    '11',
    '13',
    '14',
  ];
  const paradasRota3: Parada[] = rota3Order.map((alunoNum, idx) => {
    const aluno = alunos.find((a) => a.id.endsWith(alunoNum))!;
    const ord = idx + 1;
    const ordStr = String(ord).padStart(2, '0');
    return {
      id: `88888888-8888-4888-8888-8888888883${ordStr}`,
      transportador_id: SEED_TENANT_ID,
      rota_id: SEED_ROTA_3_ID,
      aluno_id: aluno.id,
      endereco: aluno.endereco_residencial,
      lat: aluno.lat,
      lng: aluno.lng,
      ordem: ord,
      janela_inicio: '12:22',
      janela_fim: '13:22',
      duracao_parada_segundos: 60,
      ativa: true,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    };
  });

  const paradas: Parada[] = [...paradasRota1, ...paradasRota2, ...paradasRota3];

  const nowMs = Date.now();
  const viagens: Viagem[] = [
    {
      id: SEED_VIAGEM_ATIVA_ID,
      transportador_id: SEED_TENANT_ID,
      rota_id: SEED_ROTA_1_ID,
      motorista_id: SEED_MOTORISTA_1_ID,
      veiculo_id: SEED_VEICULO_1_ID,
      data_viagem: new Date(nowMs).toISOString().slice(0, 10),
      turno: 'ida',
      status: 'ativa',
      iniciada_em: new Date(nowMs - 12 * 60_000).toISOString(),
      encerrada_em: null,
      ultima_lat: -23.6075,
      ultima_lng: -46.6605,
      ultima_velocidade_kmh: 28.5,
      ultima_atualizacao_gps: new Date(nowMs - 10_000).toISOString(),
      eta_destino_final: new Date(nowMs + 32 * 60_000).toISOString(),
      versao_rota: 1,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
    {
      id: SEED_VIAGEM_AGENDADA_ID,
      transportador_id: SEED_TENANT_ID,
      rota_id: SEED_ROTA_3_ID,
      motorista_id: SEED_MOTORISTA_2_ID,
      veiculo_id: SEED_VEICULO_2_ID,
      data_viagem: new Date(nowMs).toISOString().slice(0, 10),
      turno: 'ida',
      status: 'agendada',
      iniciada_em: null,
      encerrada_em: null,
      ultima_lat: -23.599,
      ultima_lng: -46.6365,
      ultima_velocidade_kmh: 0,
      ultima_atualizacao_gps: null,
      eta_destino_final: null,
      versao_rota: 1,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
  ];

  const viagemParadas: ViagemParada[] = [
    ...paradasRota1.map((p) => {
      const isCompleted = p.ordem <= 2;
      const etaMs = nowMs + (p.ordem - 2) * 4 * 60_000;
      const ordStr = String(p.ordem).padStart(2, '0');
      return {
        id: `dddddddd-dddd-4ddd-8ddd-dddddddd01${ordStr}`,
        transportador_id: SEED_TENANT_ID,
        viagem_id: SEED_VIAGEM_ATIVA_ID,
        parada_id: p.id,
        aluno_id: p.aluno_id,
        endereco: p.endereco,
        lat: p.lat,
        lng: p.lng,
        ordem_original: p.ordem,
        ordem_atual: p.ordem,
        janela_inicio: p.janela_inicio,
        janela_fim: p.janela_fim,
        status: isCompleted ? ('embarcado' as const) : ('pendente' as const),
        eta_previsto: isCompleted ? null : new Date(etaMs).toISOString(),
        eta_anterior: null,
        distancia_restante_metros: isCompleted ? 0 : (p.ordem - 2) * 850,
        concluida_em: isCompleted ? new Date(nowMs - 6 * 60_000).toISOString() : null,
        origem_ausencia: null,
        ack_motorista: true,
        ack_em: null,
        created_at: BASE_TIMESTAMP,
        updated_at: BASE_TIMESTAMP,
      };
    }),
    ...paradasRota3.map((p) => {
      const ordStr = String(p.ordem).padStart(2, '0');
      return {
        id: `dddddddd-dddd-4ddd-8ddd-dddddddd03${ordStr}`,
        transportador_id: SEED_TENANT_ID,
        viagem_id: SEED_VIAGEM_AGENDADA_ID,
        parada_id: p.id,
        aluno_id: p.aluno_id,
        endereco: p.endereco,
        lat: p.lat,
        lng: p.lng,
        ordem_original: p.ordem,
        ordem_atual: p.ordem,
        janela_inicio: p.janela_inicio,
        janela_fim: p.janela_fim,
        status: 'pendente' as const,
        eta_previsto: null,
        eta_anterior: null,
        distancia_restante_metros: null,
        concluida_em: null,
        origem_ausencia: null,
        ack_motorista: true,
        ack_em: null,
        created_at: BASE_TIMESTAMP,
        updated_at: BASE_TIMESTAMP,
      };
    }),
  ];

  const posicoesVeiculo: PosicaoVeiculo[] = [
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
      transportador_id: SEED_TENANT_ID,
      viagem_id: SEED_VIAGEM_ATIVA_ID,
      veiculo_id: SEED_VEICULO_1_ID,
      motorista_id: SEED_MOTORISTA_1_ID,
      lat: -23.6075,
      lng: -46.6605,
      velocidade_kmh: 28.5,
      direcao_graus: 315.0,
      precisao_metros: 5.0,
      capturado_em: new Date(nowMs - 10_000).toISOString(),
      created_at: new Date(nowMs - 10_000).toISOString(),
    },
  ];

  const faturas: Fatura[] = [
    {
      id: '99999999-9999-4999-8999-999999999901',
      transportador_id: SEED_TENANT_ID,
      responsavel_id: '55555555-5555-4555-8555-555555555501',
      aluno_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
      competencia: '2026-10',
      valor_original: 480.0,
      multa_aplicada: 0,
      juros_aplicado: 0,
      valor_total: 480.0,
      data_vencimento: '2026-10-25',
      status: 'pendente',
      external_charge_id: 'pay_asaas_seed_001',
      pix_txid: 'txid_seed_001',
      pix_qr_code_base64: null,
      pix_copia_e_cola:
        '00020126580014br.gov.bcb.pix013611111111-1111-4111-8111-1111111111115204000053039865406480.005802BR5924EXPRESSO ESCOLAR TIA ANA6009SAO PAULO62070503***6304ABCD',
      pix_expiracao: new Date(nowMs + 5 * 86400_000).toISOString(),
      ultima_cobranca_enviada_em: null,
      pago_em: null,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
    {
      id: '99999999-9999-4999-8999-999999999902',
      transportador_id: SEED_TENANT_ID,
      responsavel_id: '55555555-5555-4555-8555-555555555502',
      aluno_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
      competencia: '2026-10',
      valor_original: 480.0,
      multa_aplicada: 9.6,
      juros_aplicado: 1.44,
      valor_total: 491.04,
      data_vencimento: '2026-10-10',
      status: 'vencida',
      external_charge_id: 'pay_asaas_seed_002',
      pix_txid: 'txid_seed_002',
      pix_qr_code_base64: null,
      pix_copia_e_cola:
        '00020126580014br.gov.bcb.pix013611111111-1111-4111-8111-1111111111115204000053039865406491.045802BR5924EXPRESSO ESCOLAR TIA ANA6009SAO PAULO62070503***6304EF01',
      pix_expiracao: new Date(nowMs + 2 * 86400_000).toISOString(),
      ultima_cobranca_enviada_em: null,
      pago_em: null,
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
    {
      id: '99999999-9999-4999-8999-999999999903',
      transportador_id: SEED_TENANT_ID,
      responsavel_id: '55555555-5555-4555-8555-555555555503',
      aluno_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04',
      competencia: '2026-10',
      valor_original: 480.0,
      multa_aplicada: 0,
      juros_aplicado: 0,
      valor_total: 480.0,
      data_vencimento: '2026-10-10',
      status: 'paga',
      external_charge_id: 'pay_asaas_seed_003',
      pix_txid: 'txid_seed_003',
      pix_qr_code_base64: null,
      pix_copia_e_cola:
        '00020126580014br.gov.bcb.pix013611111111-1111-4111-8111-1111111111115204000053039865406480.005802BR5924EXPRESSO ESCOLAR TIA ANA6009SAO PAULO62070503***63049988',
      pix_expiracao: null,
      ultima_cobranca_enviada_em: null,
      pago_em: '2026-10-10T14:22:00.000Z',
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
    },
  ];

  return {
    transportadores,
    motoristas,
    veiculos,
    escolas,
    responsaveis,
    alunos,
    alunoResponsaveis,
    usuarioPerfis,
    rotas,
    paradas,
    viagens,
    viagemParadas,
    posicoesVeiculo,
    faturas,
    pagamentos: [],
    eventosViagem: [],
    mensagensLog: [],
    outboxEventos: [],
    auditAccessLogs: [],
  };
}
