import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ResultCardProps {
  icon: LucideIcon;
  label: string;
  color: string;
  children: ReactNode;
}

export function ResultCard({ icon: Icon, label, color, children }: ResultCardProps) {
  return (
    <div
      className="rounded-2xl p-5 mt-4"
      style={{ backgroundColor: '#FFFFFF', boxShadow: `0 2px 10px ${color}10` }}
    >
      <div className="flex items-center mb-3">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: color + '15' }}
        >
          <Icon size={10} color={color} />
        </div>
        <span
          className="text-xs font-bold ml-2 uppercase tracking-wider"
          style={{ color: '#A8A29E' }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}
