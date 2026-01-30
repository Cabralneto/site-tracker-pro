import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

type PTStatus = 'pendente' | 'solicitada' | 'chegada' | 'liberada' | 'impedida';

interface EventPayload {
  observacao?: string;
  impedimento_id?: string;
  detalhe_impedimento?: string;
  lat?: number | null;
  lon?: number | null;
  accuracy?: number | null;
  user_agent?: string;
}

interface TransitionResult {
  success: boolean;
  pt_id: string;
  new_status: string;
  evento_id: string;
  atraso_etm: number;
  atraso_petrobras: number;
}

/**
 * Transição segura de status da PT via RPC.
 * Valida workflow e roles no banco de dados.
 */
export async function transitionPTStatus(
  ptId: string,
  newStatus: PTStatus,
  payload: EventPayload = {}
): Promise<TransitionResult> {
  // Convert payload to JSON-compatible object
  const jsonPayload: Record<string, Json> = {};
  if (payload.observacao) jsonPayload.observacao = payload.observacao;
  if (payload.impedimento_id) jsonPayload.impedimento_id = payload.impedimento_id;
  if (payload.detalhe_impedimento) jsonPayload.detalhe_impedimento = payload.detalhe_impedimento;
  if (payload.lat != null) jsonPayload.lat = payload.lat;
  if (payload.lon != null) jsonPayload.lon = payload.lon;
  if (payload.accuracy != null) jsonPayload.accuracy = payload.accuracy;
  if (payload.user_agent) jsonPayload.user_agent = payload.user_agent;

  const { data, error } = await supabase.rpc('transition_pt_status', {
    _pt_id: ptId,
    _new_status: newStatus,
    _event_payload: jsonPayload,
  });

  if (error) {
    // Extract message from Postgres error
    const message = error.message?.replace(/^.*EXCEPTION:\s*/, '') || 'Erro ao atualizar status';
    throw new Error(message);
  }

  return data as unknown as TransitionResult;
}

/**
 * Helper para mapear tipo de evento para novo status
 */
export function eventTypeToStatus(eventType: 'solicitacao' | 'chegada' | 'liberacao' | 'impedimento'): PTStatus {
  const mapping: Record<string, PTStatus> = {
    solicitacao: 'solicitada',
    chegada: 'chegada',
    liberacao: 'liberada',
    impedimento: 'impedida',
  };
  return mapping[eventType];
}
