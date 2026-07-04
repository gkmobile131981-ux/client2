import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 light text-foreground">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-transparent transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Dialog Content */}
      <div
        className={cn(
          'relative w-[92%] sm:w-full max-w-lg rounded-xl border border-border bg-card/95 p-5 sm:p-6 shadow-xl transition-all duration-300 transform scale-100 opacity-100 z-10 max-h-[88vh] overflow-y-auto scrollbar-thin',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground leading-none tracking-tight">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};
