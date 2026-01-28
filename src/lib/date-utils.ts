import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Converte uma string de data no formato YYYY-MM-DD para um objeto Date
 * sem problemas de timezone (adiciona T12:00:00 para evitar mudança de dia)
 */
export function parseDateString(dateString: string): Date {
  // Adiciona horário de meio-dia para evitar problemas de timezone
  return new Date(dateString + 'T12:00:00');
}

/**
 * Formata uma data (string YYYY-MM-DD ou Date) para exibição brasileira
 */
export function formatDateBR(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
  if (typeof date === 'string') {
    // Se é string sem hora (YYYY-MM-DD), adiciona horário fixo
    if (date.length === 10) {
      return format(parseDateString(date), formatStr, { locale: ptBR });
    }
    // Se é ISO com timezone, faz parse normal
    return format(parseISO(date), formatStr, { locale: ptBR });
  }
  return format(date, formatStr, { locale: ptBR });
}

/**
 * Retorna a data de hoje no formato YYYY-MM-DD (para filtros e inputs)
 */
export function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
