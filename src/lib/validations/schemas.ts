import { z } from 'zod';

export const uuidSchema = z.string().uuid('UUID inválido');

export const phoneE164Schema = z
  .string()
  .trim()
  .transform((val) => {
    const digits = val.replace(/\D/g, '');
    if (digits.startsWith('55')) return `+${digits}`;
    if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
    return val.startsWith('+') ? val : `+${digits}`;
  })
  .refine((val) => /^\+\d{10,15}$/.test(val), {
    message: 'Telefone WhatsApp deve estar em formato válido (ex: +5511999990000)',
  });

export const timeWindowSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Horário inválido (use HH:MM)');

export const userRoleSchema = z.enum(['transportador', 'motorista', 'responsavel']);

export const turnoRotaSchema = z.enum(['ida', 'volta']);

export const statusViagemSchema = z.enum(['agendada', 'ativa', 'concluida', 'cancelada']);

export const statusParadaViagemSchema = z.enum([
  'pendente',
  'embarcado',
  'desembarcado',
  'ausente',
]);

export const statusFaturaSchema = z.enum(['pendente', 'paga', 'vencida', 'cancelada']);

export const registrarAusenciaInputSchema = z.object({
  viagemId: uuidSchema,
  alunoId: uuidSchema,
  origem: z.string().min(1).max(64).default('agent_tool'),
});

export const statusViagemQuerySchema = z.object({
  alunoId: uuidSchema,
});

export const faturaQuerySchema = z.object({
  responsavelId: uuidSchema,
});

export const gerarPixInputSchema = z.object({
  faturaId: uuidSchema,
  forcarSegundaVia: z.boolean().optional().default(false),
});

export const notificarMotoristaInputSchema = z.object({
  viagemId: uuidSchema,
  mensagem: z.string().min(2).max(280),
  urgencia: z.enum(['info', 'alerta', 'critico']).optional().default('alerta'),
  alunoId: uuidSchema.optional(),
});

export const contextoResponsavelQuerySchema = z.object({
  telefone: phoneE164Schema,
});

export const gpsPingSchema = z.object({
  viagemId: uuidSchema,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  velocidadeKmh: z.number().min(0).max(200).optional().default(0),
  direcaoGraus: z.number().min(0).max(360).optional().default(0),
  precisaoMetros: z.number().min(0).max(5000).optional().default(10),
  capturadoEm: z.string().datetime().optional(),
});

export const gpsPingBatchSchema = z.object({
  pings: z.array(gpsPingSchema).min(1).max(50),
});
