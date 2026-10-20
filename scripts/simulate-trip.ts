import { dbStore, type RealtimeBroadcastPayload } from '../src/lib/db/store';
import { SEED_VIAGEM_ATIVA_ID } from '../src/lib/db/seed-data';
import { POST as gpsPingRoute } from '../src/app/api/gps/ping/route';
import { POST as registrarAusenciaRoute } from '../src/app/api/tools/registrar-ausencia/route';
import { GET as statusViagemRoute } from '../src/app/api/tools/status-viagem/route';

async function runSimulation() {
  console.log('======================================================================');
  console.log('🚐 SIMULAÇÃO E2E — VIAGEM COM GPS FAKE + AUSÊNCIA + ALERTA < 3s');
  console.log('======================================================================\n');

  dbStore.resetToSeed();

  const serviceToken =
    process.env.AGENT_SERVICE_TOKEN || 'change-me-strong-service-token-min-32-chars';

  // 1. Inscreve o receptor Realtime do App do Motorista no canal da viagem
  let driverAlertReceivedAtMs = 0;
  let driverAlertPayload: RealtimeBroadcastPayload | null = null;

  const unsubscribeDriver = dbStore.subscribeRealtime(
    `viagem:${SEED_VIAGEM_ATIVA_ID}`,
    (msg) => {
      if (msg.event === 'rota_alterada') {
        driverAlertReceivedAtMs = performance.now();
        driverAlertPayload = msg;
      }
    }
  );

  // 2. Simula envio de 2 pings de GPS da van em movimento
  const fakeGpsCoordinates = [
    { lat: -23.608, lng: -46.6598, velocidadeKmh: 29.0 },
    { lat: -23.6073, lng: -46.6609, velocidadeKmh: 31.5 },
  ];

  console.log('1) Enviando telemetria GPS fake da Van 01 (Tio Carlos)...');
  for (const coord of fakeGpsCoordinates) {
    const req = new Request('http://localhost:3000/api/gps/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viagemId: SEED_VIAGEM_ATIVA_ID,
        ...coord,
      }),
    });
    const res = await gpsPingRoute(req);
    const json = await res.json();
    console.log(
      `   [GPS PING] lat=${coord.lat}, lng=${coord.lng} | Paradas pendentes=${
        json.updatedEtas?.length
      } | Eventos=${JSON.stringify(json.eventosDisparados?.map((e: { tipo: string }) => e.tipo))}`
    );
  }

  // 3. Dispara ausência via endpoint oficial /api/tools/registrar-ausencia
  const alunoAusenteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa08'; // Laura Luiz Martins (Parada #3)
  console.log(
    `\n2) Disparando POST /api/tools/registrar-ausencia para aluna ${alunoAusenteId}...`
  );

  const startMs = performance.now();
  const absenceReq = new Request('http://localhost:3000/api/tools/registrar-ausencia', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({
      viagemId: SEED_VIAGEM_ATIVA_ID,
      alunoId: alunoAusenteId,
      origem: 'simulacao_script_e2e',
    }),
  });

  const absenceRes = await registrarAusenciaRoute(absenceReq);
  const absenceJson = await absenceRes.json();
  const alertLatencyMs = Math.max(0.1, driverAlertReceivedAtMs - startMs);

  unsubscribeDriver();

  console.log('\n3) Verificando alerta ao motorista e resposta do recálculo:');
  console.log(
    `   - Status HTTP: ${absenceRes.status} (ok=${absenceJson.ok})`
  );
  console.log(
    `   - Parada Removida: ${absenceJson.paradaRemovida?.alunoNome} (${absenceJson.paradaRemovida?.endereco})`
  );
  console.log(
    `   - Latência de Alerta ao Motorista via Realtime: ${alertLatencyMs.toFixed(
      2
    )} ms (Limite de aceite: < 3000 ms)`
  );
  console.log(
    `   - etaDelta retornado: ${absenceJson.etaDelta} segundos (${Math.round(
      absenceJson.etaDelta / 60
    )} min)`
  );
  console.log(
    `   - Nova Ordem (${absenceJson.novaOrdem?.length} paradas pendentes restantes):`
  );

  for (const item of (absenceJson.novaOrdem || []).slice(0, 5)) {
    console.log(
      `     #${item.ordem} ${item.alunoNome} -> ETA ${item.etaMinutos} min (${item.endereco})`
    );
  }

  // 4. Consulta GET /api/tools/status-viagem para próximo aluno da nova ordem
  const proximoAlunoId = absenceJson.novaOrdem?.[0]?.alunoId;
  if (proximoAlunoId) {
    const statusReq = new Request(
      `http://localhost:3000/api/tools/status-viagem?alunoId=${proximoAlunoId}`,
      {
        headers: { Authorization: `Bearer ${serviceToken}` },
      }
    );
    const statusRes = await statusViagemRoute(statusReq);
    const statusJson = await statusRes.json();
    console.log(
      `\n4) Consulta GET /api/tools/status-viagem?alunoId=${proximoAlunoId}:`
    );
    console.log(
      `   - Próximo aluno: ${statusJson.aluno?.nome} (Ordem #${statusJson.aluno?.ordemAtual}, ETA=${statusJson.aluno?.etaMinutos} min)`
    );
  }

  // Validações estritas dos critérios de aceite
  if (!absenceJson.ok) {
    throw new Error('Falha: applyAbsence não retornou ok=true');
  }
  if (!driverAlertPayload) {
    throw new Error('Falha: Motorista não recebeu evento Realtime rota_alterada');
  }
  if (alertLatencyMs >= 3000) {
    throw new Error(
      `Falha: Latência do alerta (${alertLatencyMs}ms) excedeu o limite de 3000ms`
    );
  }
  if (typeof absenceJson.etaDelta !== 'number') {
    throw new Error('Falha: Resposta não contém etaDelta numérico');
  }

  console.log('\n======================================================================');
  console.log('✅ SIMULAÇÃO CONCLUÍDA COM SUCESSO — TODOS OS CRITÉRIOS ATENDIDOS!');
  console.log('======================================================================');
}

runSimulation().catch((err) => {
  console.error('❌ Erro na simulação:', err);
  process.exit(1);
});
