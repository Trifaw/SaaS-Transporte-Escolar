-- ==============================================================================
-- Seed Realista — SaaS de Transporte Escolar (MVP)
-- Contém: 1 transportador, 2 vans/motoristas, 2 escolas, 20 responsáveis,
--         25 alunos, 3 rotas (2 ida, 1 volta), paradas, viagens e faturas Pix.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Transportador (Tenant Principal)
-- ------------------------------------------------------------------------------
INSERT INTO public.transportador (
  id, nome, razao_social, cnpj_cpf, telefone, email,
  config_van_chegando_minutos, config_atraso_minutos,
  config_multa_percentual, config_juros_mensal_percentual, config_dia_vencimento_padrao
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Expresso Escolar Tia Ana',
  'Expresso Escolar Tia Ana Transportes Ltda',
  '12.345.678/0001-90',
  '+5511988880000',
  'contato@expressoescolar.com.br',
  5, 10, 2.00, 1.00, 10
) ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. Motoristas (2)
-- ------------------------------------------------------------------------------
INSERT INTO public.motorista (id, transportador_id, nome, cpf, cnh, telefone, email) VALUES
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111111', 'Carlos Eduardo Silva', '111.222.333-44', '12345678901', '+5511988880001', 'carlos.motorista@expressoescolar.com.br'),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111111', 'Roberto Alves Santos', '555.666.777-88', '98765432109', '+5511988880002', 'roberto.motorista@expressoescolar.com.br')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. Veículos / Vans (2)
-- ------------------------------------------------------------------------------
INSERT INTO public.veiculo (id, transportador_id, motorista_padrao_id, apelido, placa, modelo, capacidade, ano) VALUES
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222201', 'Van 01 - Tio Carlos', 'ABC1D23', 'Mercedes-Benz Sprinter 416 Escolar', 15, 2024),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222202', 'Van 02 - Tio Beto', 'XYZ9E87', 'Fiat Ducato Minibus Escolar', 15, 2023)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. Escolas (2)
-- ------------------------------------------------------------------------------
INSERT INTO public.escola (
  id, transportador_id, nome, endereco, lat, lng, telefone, contato_portaria,
  horario_entrada_manha, horario_saida_manha, horario_entrada_tarde, horario_saida_tarde
) VALUES
  (
    '44444444-4444-4444-8444-444444444401',
    '11111111-1111-4111-8111-111111111111',
    'Colégio Dom Pedro II - Unidade Moema',
    'Av. Lavandisca, 500 - Moema, São Paulo - SP',
    -23.601500, -46.665200,
    '+551150510001', 'Portaria Principal - Sr. Marcos',
    '07:15', '12:15', '13:15', '17:45'
  ),
  (
    '44444444-4444-4444-8444-444444444402',
    '11111111-1111-4111-8111-111111111111',
    'Escola Viva Infância - Vila Mariana',
    'Rua Domingos de Morais, 1800 - Vila Mariana, São Paulo - SP',
    -23.591200, -46.636800,
    '+551155720002', 'Recepção Infantil - Dona Helena',
    '07:30', '12:00', '13:30', '18:00'
  )
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. Responsáveis (20 responsáveis para 25 alunos — inclui irmãos)
-- ------------------------------------------------------------------------------
INSERT INTO public.responsavel (id, transportador_id, nome, cpf, telefone_whatsapp, email, endereco, asaas_customer_id) VALUES
  ('55555555-5555-4555-8555-555555555501', '11111111-1111-4111-8111-111111111111', 'Fernanda Oliveira Costa', '201.301.401-01', '+5511991000001', 'fernanda.costa@email.com', 'Al. dos Maracatins, 320 - Moema', 'cus_000000000001'),
  ('55555555-5555-4555-8555-555555555502', '11111111-1111-4111-8111-111111111111', 'Ricardo Mendes Almeida', '201.301.401-02', '+5511991000002', 'ricardo.almeida@email.com', 'Rua Gaivota, 610 - Moema', 'cus_000000000002'),
  ('55555555-5555-4555-8555-555555555503', '11111111-1111-4111-8111-111111111111', 'Juliana Pereira Souza', '201.301.401-03', '+5511991000003', 'juliana.souza@email.com', 'Rua Canário, 890 - Moema', 'cus_000000000003'),
  ('55555555-5555-4555-8555-555555555504', '11111111-1111-4111-8111-111111111111', 'Marcelo Ribeiro Lima', '201.301.401-04', '+5511991000004', 'marcelo.lima@email.com', 'Av. Rouxinol, 210 - Moema', 'cus_000000000004'),
  ('55555555-5555-4555-8555-555555555505', '11111111-1111-4111-8111-111111111111', 'Camila Ferreira Rocha', '201.301.401-05', '+5511991000005', 'camila.rocha@email.com', 'Al. dos Nhambiquaras, 1020 - Indianópolis', 'cus_000000000005'),
  ('55555555-5555-4555-8555-555555555506', '11111111-1111-4111-8111-111111111111', 'André Luiz Martins', '201.301.401-06', '+5511991000006', 'andre.martins@email.com', 'Al. dos Anapurus, 740 - Indianópolis', 'cus_000000000006'),
  ('55555555-5555-4555-8555-555555555507', '11111111-1111-4111-8111-111111111111', 'Patrícia Gomes Barbosa', '201.301.401-07', '+5511991000007', 'patricia.barbosa@email.com', 'Rua Inhambu, 1150 - Moema', 'cus_000000000007'),
  ('55555555-5555-4555-8555-555555555508', '11111111-1111-4111-8111-111111111111', 'Gustavo Henrique Cardoso', '201.301.401-08', '+5511991000008', 'gustavo.cardoso@email.com', 'Rua Tuim, 430 - Moema', 'cus_000000000008'),
  ('55555555-5555-4555-8555-555555555509', '11111111-1111-4111-8111-111111111111', 'Beatriz Castro Teixeira', '201.301.401-09', '+5511991000009', 'beatriz.teixeira@email.com', 'Rua França Pinto, 310 - Vila Mariana', 'cus_000000000009'),
  ('55555555-5555-4555-8555-555555555510', '11111111-1111-4111-8111-111111111111', 'Thiago Nascimento Dias', '201.301.401-10', '+5511991000010', 'thiago.dias@email.com', 'Rua Morgado de Mateus, 450 - Vila Mariana', 'cus_000000000010'),
  ('55555555-5555-4555-8555-555555555511', '11111111-1111-4111-8111-111111111111', 'Larissa Moreira Araújo', '201.301.401-11', '+5511991000011', 'larissa.araujo@email.com', 'Rua Pelotas, 280 - Vila Mariana', 'cus_000000000011'),
  ('55555555-5555-4555-8555-555555555512', '11111111-1111-4111-8111-111111111111', 'Felipe Augusto Correia', '201.301.401-12', '+5511991000012', 'felipe.correia@email.com', 'Rua Humberto I, 620 - Vila Mariana', 'cus_000000000012'),
  ('55555555-5555-4555-8555-555555555513', '11111111-1111-4111-8111-111111111111', 'Vanessa Carvalho Nunes', '201.301.401-13', '+5511991000013', 'vanessa.nunes@email.com', 'Rua Joaquim Távora, 950 - Vila Mariana', 'cus_000000000013'),
  ('55555555-5555-4555-8555-555555555514', '11111111-1111-4111-8111-111111111111', 'Daniel Monteiro Vieira', '201.301.401-14', '+5511991000014', 'daniel.vieira@email.com', 'Rua Sena Madureira, 780 - Vila Mariana', 'cus_000000000014'),
  ('55555555-5555-4555-8555-555555555515', '11111111-1111-4111-8111-111111111111', 'Aline Freitas Cavalcanti', '201.301.401-15', '+5511991000015', 'aline.cavalcanti@email.com', 'Rua Borges Lagoa, 540 - Vila Clementino', 'cus_000000000015'),
  ('55555555-5555-4555-8555-555555555516', '11111111-1111-4111-8111-111111111111', 'Leonardo Barros Peixoto', '201.301.401-16', '+5511991000016', 'leonardo.peixoto@email.com', 'Rua Pedro de Toledo, 410 - Vila Clementino', 'cus_000000000016'),
  ('55555555-5555-4555-8555-555555555517', '11111111-1111-4111-8111-111111111111', 'Renata Campos Machado', '201.301.401-17', '+5511991000017', 'renata.machado@email.com', 'Rua Loefgren, 1120 - Vila Clementino', 'cus_000000000017'),
  ('55555555-5555-4555-8555-555555555518', '11111111-1111-4111-8111-111111111111', 'Eduardo Batista Ramos', '201.301.401-18', '+5511991000018', 'eduardo.ramos@email.com', 'Rua Botucatu, 670 - Vila Mariana', 'cus_000000000018'),
  ('55555555-5555-4555-8555-555555555519', '11111111-1111-4111-8111-111111111111', 'Tatiana Duarte Azevedo', '201.301.401-19', '+5511991000019', 'tatiana.azevedo@email.com', 'Rua Afonso Celso, 830 - Vila Mariana', 'cus_000000000019'),
  ('55555555-5555-4555-8555-555555555520', '11111111-1111-4111-8111-111111111111', 'Rodrigo Cunha Melo', '201.301.401-20', '+5511991000020', 'rodrigo.melo@email.com', 'Rua Luís Góis, 990 - Saúde', 'cus_000000000020')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. Alunos (25 alunos: 10 no Colégio Dom Pedro II, 15 na Escola Viva Infância)
-- ------------------------------------------------------------------------------
INSERT INTO public.aluno (
  id, transportador_id, escola_id, nome, data_nascimento, serie_turma,
  endereco_residencial, lat, lng, valor_mensalidade, dia_vencimento, observacoes_medicas
) VALUES
  -- Alunos 01 a 10 (Colégio Dom Pedro II - Moema/Indianópolis)
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444401', 'Lucas Oliveira Costa', '2016-03-14', '4º Ano A', 'Al. dos Maracatins, 320 - Moema', -23.606200, -46.660100, 480.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444401', 'Sofia Oliveira Costa', '2018-07-22', '2º Ano B', 'Al. dos Maracatins, 320 - Moema', -23.606200, -46.660100, 450.00, 10, 'Usa assento de elevação'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444401', 'Pedro Mendes Almeida', '2015-11-05', '5º Ano A', 'Rua Gaivota, 610 - Moema', -23.604800, -46.662500, 480.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444401', 'Helena Pereira Souza', '2017-01-19', '3º Ano C', 'Rua Canário, 890 - Moema', -23.603100, -46.664100, 480.00, 10, 'Alergia leve a amendoim'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444401', 'Gabriel Ribeiro Lima', '2016-09-30', '4º Ano B', 'Av. Rouxinol, 210 - Moema', -23.602000, -46.668000, 490.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444401', 'Alice Ferreira Rocha', '2017-05-12', '3º Ano A', 'Al. dos Nhambiquaras, 1020 - Indianópolis', -23.608500, -46.658900, 500.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444401', 'Miguel Ferreira Rocha', '2019-08-08', '1º Ano A', 'Al. dos Nhambiquaras, 1020 - Indianópolis', -23.608500, -46.658900, 450.00, 10, 'Irmão da Alice'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444401', 'Laura Luiz Martins', '2015-04-25', '5º Ano B', 'Al. dos Anapurus, 740 - Indianópolis', -23.607100, -46.661200, 480.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444401', 'Arthur Gomes Barbosa', '2016-12-02', '4º Ano A', 'Rua Inhambu, 1150 - Moema', -23.600500, -46.669500, 480.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444401', 'Valentina Henrique Cardoso', '2018-02-14', '2º Ano A', 'Rua Tuim, 430 - Moema', -23.599800, -46.667200, 480.00, 10, NULL),

  -- Alunos 11 a 25 (Escola Viva Infância - Vila Mariana/Vila Clementino/Saúde)
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Bernardo Castro Teixeira', '2019-06-11', 'Infantil II', 'Rua França Pinto, 310 - Vila Mariana', -23.587200, -46.639100, 520.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Manuela Nascimento Dias', '2018-10-03', '1º Ano B', 'Rua Morgado de Mateus, 450 - Vila Mariana', -23.588900, -46.637500, 520.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Heitor Moreira Araújo', '2017-09-17', '2º Ano A', 'Rua Pelotas, 280 - Vila Mariana', -23.586100, -46.642200, 520.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa14', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Clara Moreira Araújo', '2020-01-29', 'Infantil I', 'Rua Pelotas, 280 - Vila Mariana', -23.586100, -46.642200, 490.00, 10, 'Cadeirinha infantil'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Davi Augusto Correia', '2018-04-09', '1º Ano A', 'Rua Humberto I, 620 - Vila Mariana', -23.589500, -46.635200, 520.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa16', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Júlia Carvalho Nunes', '2017-12-21', '2º Ano B', 'Rua Joaquim Távora, 950 - Vila Mariana', -23.588100, -46.633900, 520.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Lorenzo Monteiro Vieira', '2019-03-04', 'Infantil II', 'Rua Sena Madureira, 780 - Vila Mariana', -23.592800, -46.641000, 520.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Isabella Freitas Cavalcanti', '2016-08-15', '3º Ano A', 'Rua Borges Lagoa, 540 - Vila Clementino', -23.596100, -46.643500, 540.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa19', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Theo Freitas Cavalcanti', '2019-11-11', 'Infantil II', 'Rua Borges Lagoa, 540 - Vila Clementino', -23.596100, -46.643500, 500.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Lívia Barros Peixoto', '2017-07-07', '2º Ano C', 'Rua Pedro de Toledo, 410 - Vila Clementino', -23.597400, -46.641800, 520.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Gael Campos Machado', '2018-05-26', '1º Ano B', 'Rua Loefgren, 1120 - Vila Clementino', -23.598900, -46.639200, 520.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa22', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Giovanna Batista Ramos', '2016-10-18', '3º Ano B', 'Rua Botucatu, 670 - Vila Mariana', -23.595200, -46.637800, 520.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa23', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Noah Batista Ramos', '2019-02-28', 'Infantil II', 'Rua Botucatu, 670 - Vila Mariana', -23.595200, -46.637800, 490.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa24', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Maria Eduarda Duarte Azevedo', '2017-04-13', '2º Ano A', 'Rua Afonso Celso, 830 - Vila Mariana', -23.600100, -46.636100, 520.00, 10, NULL),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa25', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444402', 'Samuel Cunha Melo', '2016-06-30', '3º Ano A', 'Rua Luís Góis, 990 - Saúde', -23.603500, -46.634800, 540.00, 10, NULL)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. Vínculo Aluno-Responsável
-- ------------------------------------------------------------------------------
INSERT INTO public.aluno_responsavel (transportador_id, aluno_id, responsavel_id, parentesco, responsavel_financeiro) VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', '55555555-5555-4555-8555-555555555501', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', '55555555-5555-4555-8555-555555555501', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', '55555555-5555-4555-8555-555555555502', 'Pai', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04', '55555555-5555-4555-8555-555555555503', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05', '55555555-5555-4555-8555-555555555504', 'Pai', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06', '55555555-5555-4555-8555-555555555505', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07', '55555555-5555-4555-8555-555555555505', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08', '55555555-5555-4555-8555-555555555506', 'Pai', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09', '55555555-5555-4555-8555-555555555507', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', '55555555-5555-4555-8555-555555555508', 'Pai', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11', '55555555-5555-4555-8555-555555555509', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12', '55555555-5555-4555-8555-555555555510', 'Pai', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13', '55555555-5555-4555-8555-555555555511', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa14', '55555555-5555-4555-8555-555555555511', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15', '55555555-5555-4555-8555-555555555512', 'Pai', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa16', '55555555-5555-4555-8555-555555555513', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17', '55555555-5555-4555-8555-555555555514', 'Pai', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18', '55555555-5555-4555-8555-555555555515', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa19', '55555555-5555-4555-8555-555555555515', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20', '55555555-5555-4555-8555-555555555516', 'Pai', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21', '55555555-5555-4555-8555-555555555517', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa22', '55555555-5555-4555-8555-555555555518', 'Pai', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa23', '55555555-5555-4555-8555-555555555518', 'Pai', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa24', '55555555-5555-4555-8555-555555555519', 'Mãe', TRUE),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa25', '55555555-5555-4555-8555-555555555520', 'Pai', TRUE)
ON CONFLICT (aluno_id, responsavel_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. Rotas (3 rotas: Manhã Ida, Meio-dia Volta, Tarde Ida)
-- ------------------------------------------------------------------------------
INSERT INTO public.rota (
  id, transportador_id, escola_id, veiculo_id, motorista_id,
  nome, turno, ponto_partida_nome, ponto_partida_lat, ponto_partida_lng,
  horario_inicio_previsto, horario_chegada_escola_previsto
) VALUES
  (
    '66666666-6666-4666-8666-666666666601',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444401',
    '33333333-3333-4333-8333-333333333301',
    '22222222-2222-4222-8222-222222222201',
    'Rota 01 - Manhã Ida (Moema/Indianópolis -> Colégio Dom Pedro II)',
    'ida',
    'Garagem Moema - Av. Moreira Guimarães, 900',
    -23.610200, -46.657000,
    '06:15', '07:10'
  ),
  (
    '66666666-6666-4666-8666-666666666602',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444401',
    '33333333-3333-4333-8333-333333333301',
    '22222222-2222-4222-8222-222222222201',
    'Rota 02 - Meio-Dia Volta (Colégio Dom Pedro II -> Moema/Indianópolis)',
    'volta',
    'Colégio Dom Pedro II - Av. Lavandisca, 500',
    -23.601500, -46.665200,
    '12:15', '13:10'
  ),
  (
    '66666666-6666-4666-8666-666666666603',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444402',
    '33333333-3333-4333-8333-333333333302',
    '22222222-2222-4222-8222-222222222202',
    'Rota 03 - Tarde Ida (Vila Mariana/Saúde -> Escola Viva Infância)',
    'ida',
    'Base Vila Mariana - Rua Domingos de Morais, 2400',
    -23.599000, -46.636500,
    '12:20', '13:25'
  )
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 9. Paradas (10 paradas na Rota 01, 10 na Rota 02, 15 na Rota 03)
-- ------------------------------------------------------------------------------
INSERT INTO public.parada (id, transportador_id, rota_id, aluno_id, endereco, lat, lng, ordem, janela_inicio, janela_fim) VALUES
  -- Rota 01 (Manhã Ida)
  ('88888888-8888-4888-8888-888888888101', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666601', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06', 'Al. dos Nhambiquaras, 1020 - Indianópolis', -23.608500, -46.658900, 1, '06:18', '06:25'),
  ('88888888-8888-4888-8888-888888888102', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666601', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07', 'Al. dos Nhambiquaras, 1020 - Indianópolis', -23.608500, -46.658900, 2, '06:18', '06:25'),
  ('88888888-8888-4888-8888-888888888103', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666601', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08', 'Al. dos Anapurus, 740 - Indianópolis', -23.607100, -46.661200, 3, '06:24', '06:32'),
  ('88888888-8888-4888-8888-888888888104', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666601', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'Al. dos Maracatins, 320 - Moema', -23.606200, -46.660100, 4, '06:30', '06:38'),
  ('88888888-8888-4888-8888-888888888105', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666601', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', 'Al. dos Maracatins, 320 - Moema', -23.606200, -46.660100, 5, '06:30', '06:38'),
  ('88888888-8888-4888-8888-888888888106', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666601', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', 'Rua Gaivota, 610 - Moema', -23.604800, -46.662500, 6, '06:36', '06:45'),
  ('88888888-8888-4888-8888-888888888107', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666601', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04', 'Rua Canário, 890 - Moema', -23.603100, -46.664100, 7, '06:42', '06:50'),
  ('88888888-8888-4888-8888-888888888108', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666601', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05', 'Av. Rouxinol, 210 - Moema', -23.602000, -46.668000, 8, '06:48', '06:56'),
  ('88888888-8888-4888-8888-888888888109', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666601', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09', 'Rua Inhambu, 1150 - Moema', -23.600500, -46.669500, 9, '06:54', '07:02'),
  ('88888888-8888-4888-8888-888888888110', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666601', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', 'Rua Tuim, 430 - Moema', -23.599800, -46.667200, 10, '06:58', '07:08'),

  -- Rota 02 (Meio-Dia Volta — Ordem Inversa)
  ('88888888-8888-4888-8888-888888888201', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666602', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', 'Rua Tuim, 430 - Moema', -23.599800, -46.667200, 1, '12:20', '12:28'),
  ('88888888-8888-4888-8888-888888888202', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666602', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa09', 'Rua Inhambu, 1150 - Moema', -23.600500, -46.669500, 2, '12:25', '12:33'),
  ('88888888-8888-4888-8888-888888888203', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666602', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05', 'Av. Rouxinol, 210 - Moema', -23.602000, -46.668000, 3, '12:30', '12:38'),
  ('88888888-8888-4888-8888-888888888204', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666602', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04', 'Rua Canário, 890 - Moema', -23.603100, -46.664100, 4, '12:35', '12:43'),
  ('88888888-8888-4888-8888-888888888205', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666602', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', 'Rua Gaivota, 610 - Moema', -23.604800, -46.662500, 5, '12:40', '12:48'),
  ('88888888-8888-4888-8888-888888888206', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666602', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'Al. dos Maracatins, 320 - Moema', -23.606200, -46.660100, 6, '12:45', '12:53'),
  ('88888888-8888-4888-8888-888888888207', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666602', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', 'Al. dos Maracatins, 320 - Moema', -23.606200, -46.660100, 7, '12:45', '12:53'),
  ('88888888-8888-4888-8888-888888888208', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666602', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08', 'Al. dos Anapurus, 740 - Indianópolis', -23.607100, -46.661200, 8, '12:52', '13:00'),
  ('88888888-8888-4888-8888-888888888209', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666602', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa06', 'Al. dos Nhambiquaras, 1020 - Indianópolis', -23.608500, -46.658900, 9, '12:58', '13:08'),
  ('88888888-8888-4888-8888-888888888210', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666602', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa07', 'Al. dos Nhambiquaras, 1020 - Indianópolis', -23.608500, -46.658900, 10, '12:58', '13:08'),

  -- Rota 03 (Tarde Ida — 15 alunos)
  ('88888888-8888-4888-8888-888888888301', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa25', 'Rua Luís Góis, 990 - Saúde', -23.603500, -46.634800, 1, '12:22', '12:30'),
  ('88888888-8888-4888-8888-888888888302', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa24', 'Rua Afonso Celso, 830 - Vila Mariana', -23.600100, -46.636100, 2, '12:26', '12:34'),
  ('88888888-8888-4888-8888-888888888303', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21', 'Rua Loefgren, 1120 - Vila Clementino', -23.598900, -46.639200, 3, '12:30', '12:38'),
  ('88888888-8888-4888-8888-888888888304', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20', 'Rua Pedro de Toledo, 410 - Vila Clementino', -23.597400, -46.641800, 4, '12:34', '12:42'),
  ('88888888-8888-4888-8888-888888888305', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18', 'Rua Borges Lagoa, 540 - Vila Clementino', -23.596100, -46.643500, 5, '12:38', '12:46'),
  ('88888888-8888-4888-8888-888888888306', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa19', 'Rua Borges Lagoa, 540 - Vila Clementino', -23.596100, -46.643500, 6, '12:38', '12:46'),
  ('88888888-8888-4888-8888-888888888307', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa22', 'Rua Botucatu, 670 - Vila Mariana', -23.595200, -46.637800, 7, '12:44', '12:52'),
  ('88888888-8888-4888-8888-888888888308', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa23', 'Rua Botucatu, 670 - Vila Mariana', -23.595200, -46.637800, 8, '12:44', '12:52'),
  ('88888888-8888-4888-8888-888888888309', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17', 'Rua Sena Madureira, 780 - Vila Mariana', -23.592800, -46.641000, 9, '12:50', '12:58'),
  ('88888888-8888-4888-8888-888888888310', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15', 'Rua Humberto I, 620 - Vila Mariana', -23.589500, -46.635200, 10, '12:56', '13:04'),
  ('88888888-8888-4888-8888-888888888311', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12', 'Rua Morgado de Mateus, 450 - Vila Mariana', -23.588900, -46.637500, 11, '13:00', '13:08'),
  ('88888888-8888-4888-8888-888888888312', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa16', 'Rua Joaquim Távora, 950 - Vila Mariana', -23.588100, -46.633900, 12, '13:05', '13:13'),
  ('88888888-8888-4888-8888-888888888313', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11', 'Rua França Pinto, 310 - Vila Mariana', -23.587200, -46.639100, 13, '13:10', '13:18'),
  ('88888888-8888-4888-8888-888888888314', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13', 'Rua Pelotas, 280 - Vila Mariana', -23.586100, -46.642200, 14, '13:14', '13:22'),
  ('88888888-8888-4888-8888-888888888315', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666603', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa14', 'Rua Pelotas, 280 - Vila Mariana', -23.586100, -46.642200, 15, '13:14', '13:22')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 10. Viagens do Dia (1 Ativa com paradas instanciadas, 1 Agendada)
-- ------------------------------------------------------------------------------
INSERT INTO public.viagem (
  id, transportador_id, rota_id, motorista_id, veiculo_id,
  data_viagem, turno, status, iniciada_em,
  ultima_lat, ultima_lng, ultima_velocidade_kmh, ultima_atualizacao_gps,
  eta_destino_final, versao_rota
) VALUES
  (
    '77777777-7777-4777-8777-777777777701',
    '11111111-1111-4111-8111-111111111111',
    '66666666-6666-4666-8666-666666666601',
    '22222222-2222-4222-8222-222222222201',
    '33333333-3333-4333-8333-333333333301',
    CURRENT_DATE,
    'ida',
    'ativa',
    NOW() - INTERVAL '12 minutes',
    -23.607500, -46.660500, 28.5, NOW() - INTERVAL '15 seconds',
    NOW() + INTERVAL '35 minutes',
    1
  ),
  (
    '77777777-7777-4777-8777-777777777702',
    '11111111-1111-4111-8111-111111111111',
    '66666666-6666-4666-8666-666666666603',
    '22222222-2222-4222-8222-222222222202',
    '33333333-3333-4333-8333-333333333302',
    CURRENT_DATE,
    'ida',
    'agendada',
    NULL,
    -23.599000, -46.636500, 0, NULL,
    NULL,
    1
  )
ON CONFLICT (id) DO NOTHING;

-- Instancia paradas para as duas viagens via função transacional
SELECT public.instantiate_trip_stops('77777777-7777-4777-8777-777777777701');
SELECT public.instantiate_trip_stops('77777777-7777-4777-8777-777777777702');

-- Marca as 2 primeiras paradas da Viagem 01 como já embarcadas (van já passou)
UPDATE public.viagem_parada
SET status = 'embarcado',
    concluida_em = NOW() - INTERVAL '6 minutes'
WHERE viagem_id = '77777777-7777-4777-8777-777777777701'
  AND ordem_original IN (1, 2);

-- Define ETAs iniciais para as paradas pendentes da Viagem 01
UPDATE public.viagem_parada
SET eta_previsto = NOW() + ((ordem_atual - 2) * INTERVAL '4 minutes')
WHERE viagem_id = '77777777-7777-4777-8777-777777777701'
  AND status = 'pendente';

-- ------------------------------------------------------------------------------
-- 11. Posição Inicial da Van Ativa
-- ------------------------------------------------------------------------------
INSERT INTO public.posicao_veiculo (
  transportador_id, viagem_id, veiculo_id, motorista_id,
  lat, lng, velocidade_kmh, direcao_graus, precisao_metros
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  '77777777-7777-4777-8777-777777777701',
  '33333333-3333-4333-8333-333333333301',
  '22222222-2222-4222-8222-222222222201',
  -23.607500, -46.660500, 28.5, 315.0, 5.0
);

-- ------------------------------------------------------------------------------
-- 12. Faturas Financeiras (Exemplos: pendente, paga, vencida)
-- ------------------------------------------------------------------------------
INSERT INTO public.fatura (
  id, transportador_id, responsavel_id, aluno_id, competencia,
  valor_original, multa_aplicada, juros_aplicado, valor_total,
  data_vencimento, status, external_charge_id, pix_txid, pix_copia_e_cola, pago_em
) VALUES
  (
    '99999999-9999-4999-8999-999999999901',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555501',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
    '2026-10',
    480.00, 0.00, 0.00, 480.00,
    CURRENT_DATE + 5,
    'pendente',
    'pay_asaas_seed_001',
    'txid_seed_001',
    '00020126580014br.gov.bcb.pix013611111111-1111-4111-8111-1111111111115204000053039865406480.005802BR5924EXPRESSO ESCOLAR TIA ANA6009SAO PAULO62070503***6304ABCD',
    NULL
  ),
  (
    '99999999-9999-4999-8999-999999999902',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555502',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
    '2026-10',
    480.00, 9.60, 1.44, 491.04,
    CURRENT_DATE - 9,
    'vencida',
    'pay_asaas_seed_002',
    'txid_seed_002',
    '00020126580014br.gov.bcb.pix013611111111-1111-4111-8111-1111111111115204000053039865406491.045802BR5924EXPRESSO ESCOLAR TIA ANA6009SAO PAULO62070503***6304EF01',
    NULL
  ),
  (
    '99999999-9999-4999-8999-999999999903',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555503',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04',
    '2026-10',
    480.00, 0.00, 0.00, 480.00,
    CURRENT_DATE - 5,
    'paga',
    'pay_asaas_seed_003',
    'txid_seed_003',
    '00020126580014br.gov.bcb.pix013611111111-1111-4111-8111-1111111111115204000053039865406480.005802BR5924EXPRESSO ESCOLAR TIA ANA6009SAO PAULO62070503***63049988',
    NOW() - INTERVAL '5 days'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
