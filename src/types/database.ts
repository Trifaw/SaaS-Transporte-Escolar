export type UserRole = 'transportador' | 'motorista' | 'responsavel';
export type TurnoRota = 'ida' | 'volta';
export type StatusViagem = 'agendada' | 'ativa' | 'concluida' | 'cancelada';
export type StatusParadaViagem = 'pendente' | 'embarcado' | 'desembarcado' | 'ausente';
export type TipoEventoViagem =
  | 'ausencia'
  | 'embarque'
  | 'desembarque'
  | 'atraso'
  | 'van_chegando'
  | 'rota_alterada';
export type StatusFatura = 'pendente' | 'paga' | 'vencida' | 'cancelada';
export type DirecaoMensagem = 'inbound' | 'outbound';
export type StatusEntregaMensagem =
  | 'received'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';
export type TipoOutboxEvento =
  | 'van_chegando'
  | 'atraso'
  | 'rota_alterada'
  | 'fatura_vencendo'
  | 'pagamento_confirmado';
export type StatusOutbox = 'pending' | 'processing' | 'processed' | 'failed';

export type StableErrorCode =
  | 'UNAUTHORIZED_SERVICE_TOKEN'
  | 'VALIDATION_ERROR'
  | 'VIAGEM_NAO_ENCONTRADA'
  | 'VIAGEM_NAO_ATIVA'
  | 'PARADA_NAO_ENCONTRADA'
  | 'PARADA_JA_CONCLUIDA'
  | 'RESPONSAVEL_NAO_ENCONTRADO'
  | 'ALUNO_NAO_ENCONTRADO'
  | 'MOTORISTA_NAO_ENCONTRADO'
  | 'FATURA_NAO_ENCONTRADA'
  | 'FATURA_JA_PAGA'
  | 'FATURA_CANCELADA'
  | 'WEBHOOK_UNAUTHORIZED'
  | 'LGPD_ACCESS_DENIED'
  | 'PROVIDER_ERROR';

export interface Transportador {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj_cpf: string;
  telefone: string;
  email: string;
  config_van_chegando_minutos: number;
  config_atraso_minutos: number;
  config_multa_percentual: number;
  config_juros_mensal_percentual: number;
  config_dia_vencimento_padrao: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Motorista {
  id: string;
  transportador_id: string;
  user_id: string | null;
  nome: string;
  cpf: string;
  cnh: string;
  telefone: string;
  email: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Veiculo {
  id: string;
  transportador_id: string;
  motorista_padrao_id: string | null;
  apelido: string;
  placa: string;
  modelo: string;
  capacidade: number;
  ano: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Escola {
  id: string;
  transportador_id: string;
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
  telefone: string | null;
  contato_portaria: string | null;
  horario_entrada_manha: string | null;
  horario_saida_manha: string | null;
  horario_entrada_tarde: string | null;
  horario_saida_tarde: string | null;
  created_at: string;
  updated_at: string;
}

export interface Responsavel {
  id: string;
  transportador_id: string;
  user_id: string | null;
  nome: string;
  cpf: string;
  telefone_whatsapp: string;
  email: string | null;
  endereco: string | null;
  asaas_customer_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Aluno {
  id: string;
  transportador_id: string;
  escola_id: string;
  nome: string;
  data_nascimento: string;
  serie_turma: string;
  endereco_residencial: string;
  lat: number;
  lng: number;
  valor_mensalidade: number;
  dia_vencimento: number;
  observacoes_medicas: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlunoResponsavel {
  id: string;
  transportador_id: string;
  aluno_id: string;
  responsavel_id: string;
  parentesco: string;
  responsavel_financeiro: boolean;
  pode_registrar_ausencia: boolean;
  created_at: string;
}

export interface UsuarioPerfil {
  id: string;
  user_id: string;
  transportador_id: string;
  role: UserRole;
  motorista_id: string | null;
  responsavel_id: string | null;
  created_at: string;
}

export interface Rota {
  id: string;
  transportador_id: string;
  escola_id: string;
  veiculo_id: string;
  motorista_id: string;
  nome: string;
  turno: TurnoRota;
  ponto_partida_nome: string;
  ponto_partida_lat: number;
  ponto_partida_lng: number;
  horario_inicio_previsto: string;
  horario_chegada_escola_previsto: string;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Parada {
  id: string;
  transportador_id: string;
  rota_id: string;
  aluno_id: string;
  endereco: string;
  lat: number;
  lng: number;
  ordem: number;
  janela_inicio: string;
  janela_fim: string;
  duracao_parada_segundos: number;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Viagem {
  id: string;
  transportador_id: string;
  rota_id: string;
  motorista_id: string;
  veiculo_id: string;
  data_viagem: string;
  turno: TurnoRota;
  status: StatusViagem;
  iniciada_em: string | null;
  encerrada_em: string | null;
  ultima_lat: number | null;
  ultima_lng: number | null;
  ultima_velocidade_kmh: number | null;
  ultima_atualizacao_gps: string | null;
  eta_destino_final: string | null;
  versao_rota: number;
  created_at: string;
  updated_at: string;
}

export interface ViagemParada {
  id: string;
  transportador_id: string;
  viagem_id: string;
  parada_id: string;
  aluno_id: string;
  endereco: string;
  lat: number;
  lng: number;
  ordem_original: number;
  ordem_atual: number;
  janela_inicio: string;
  janela_fim: string;
  status: StatusParadaViagem;
  eta_previsto: string | null;
  eta_anterior: string | null;
  distancia_restante_metros: number | null;
  concluida_em: string | null;
  origem_ausencia: string | null;
  ack_motorista: boolean;
  ack_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventoViagem {
  id: string;
  transportador_id: string;
  viagem_id: string;
  aluno_id: string | null;
  parada_id: string | null;
  tipo: TipoEventoViagem;
  origem: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface PosicaoVeiculo {
  id: string;
  transportador_id: string;
  viagem_id: string;
  veiculo_id: string;
  motorista_id: string;
  lat: number;
  lng: number;
  velocidade_kmh: number;
  direcao_graus: number;
  precisao_metros: number;
  capturado_em: string;
  created_at: string;
}

export interface Fatura {
  id: string;
  transportador_id: string;
  responsavel_id: string;
  aluno_id: string;
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
  pix_expiracao: string | null;
  ultima_cobranca_enviada_em: string | null;
  pago_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pagamento {
  id: string;
  transportador_id: string;
  fatura_id: string;
  external_payment_id: string;
  external_event_id: string;
  valor_pago: number;
  metodo: string;
  status: string;
  payload_webhook: Record<string, unknown>;
  confirmado_em: string;
  created_at: string;
}

export interface MensagemLog {
  id: string;
  transportador_id: string | null;
  responsavel_id: string | null;
  direcao: DirecaoMensagem;
  telefone: string;
  tipo: string;
  template_name: string | null;
  conteudo: string;
  external_message_id: string | null;
  status_entrega: StatusEntregaMensagem;
  tentativas: number;
  erro_detalhe: string | null;
  gateway_response: Record<string, unknown> | null;
  payload_bruto: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OutboxEvento {
  id: string;
  transportador_id: string;
  tipo: TipoOutboxEvento;
  idempotency_key: string;
  payload: Record<string, unknown>;
  status: StatusOutbox;
  tentativas: number;
  proximo_retry_em: string;
  processado_em: string | null;
  erro_detalhe: string | null;
  created_at: string;
}

export interface AuditAccessLog {
  id: string;
  transportador_id: string | null;
  actor_id: string;
  actor_role: UserRole | 'agent_service_token' | 'system';
  aluno_id: string | null;
  recurso: string;
  acao: string;
  origem_ip: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
