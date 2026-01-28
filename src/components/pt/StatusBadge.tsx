import { cn } from '@/lib/utils';

export type PTStatus = 'pendente' | 'solicitada' | 'chegada' | 'liberada' | 'impedida';
export type ResponsavelAtraso = 'etm' | 'petrobras' | 'sem_atraso' | 'impedimento';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'badge-pendente' },
  solicitada: { label: 'Solicitada', className: 'badge-solicitada' },
  chegada: { label: 'Chegada', className: 'badge-chegada' },
  liberada: { label: 'Liberada', className: 'badge-liberada' },
  impedida: { label: 'Impedida', className: 'badge-impedida' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pendente;
  
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}

interface DelayBadgeProps {
  responsavel: string | null;
  className?: string;
}

const delayConfig: Record<string, { label: string; className: string }> = {
  etm: { label: 'Atraso ETM', className: 'badge-atraso-etm' },
  petrobras: { label: 'Atraso Petrobras', className: 'badge-atraso-petrobras' },
  sem_atraso: { label: 'No prazo', className: 'badge-sem-atraso' },
  impedimento: { label: 'Impedida', className: 'bg-muted text-muted-foreground' },
};

export function DelayBadge({ responsavel, className }: DelayBadgeProps) {
  if (!responsavel) return null;
  
  const config = delayConfig[responsavel] || delayConfig.sem_atraso;
  
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}
