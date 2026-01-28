import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Plus, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/', icon: Home, label: 'Início' },
  { href: '/pts', icon: ClipboardList, label: 'PTs' },
  { href: '/nova-pt', icon: Plus, label: 'Nova PT', highlight: true },
  { href: '/relatorios', icon: BarChart3, label: 'Relatórios' },
  { href: '/admin', icon: Settings, label: 'Admin', adminOnly: true },
];

export function MobileNav() {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const filteredItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <nav className="bottom-nav z-50">
      <div className="flex items-center justify-around px-2 py-2">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center min-w-[60px] min-h-[56px] rounded-xl transition-all',
                item.highlight && !isActive && 'bg-primary text-primary-foreground',
                item.highlight && isActive && 'bg-primary/90 text-primary-foreground',
                !item.highlight && isActive && 'text-primary bg-accent',
                !item.highlight && !isActive && 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', item.highlight && 'h-6 w-6')} />
              <span className="text-2xs mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
