import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export interface SearchSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  emptyMessage?: string;
  className?: string;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  disabled = false,
  label,
  emptyMessage = 'No matching options found',
  className = '',
}: SearchSelectProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal search term with current external value when not focused/open
  useEffect(() => {
    if (!isOpen) {
      const selectedOption = options.find((opt) => opt.value === value);
      setSearchTerm(selectedOption ? selectedOption.label : value || '');
    }
  }, [value, options, isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        const selectedOption = options.find((opt) => opt.value === value);
        setSearchTerm(selectedOption ? selectedOption.label : value || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options]);

  // Filter options: Prioritize starts-with matches first, then includes matches
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.trim().toLowerCase();

    // If search term matches currently selected value and dropdown was just toggled, return all options
    const selectedOption = options.find((opt) => opt.value === value);
    if (selectedOption && selectedOption.label.toLowerCase() === q && !isOpen) {
      return options;
    }

    const startsWith = options.filter((opt) =>
      opt.label.toLowerCase().startsWith(q)
    );
    if (startsWith.length > 0) {
      return startsWith;
    }

    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, searchTerm, value, isOpen]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    const selected = options.find((opt) => opt.value === optValue);
    setSearchTerm(selected ? selected.label : optValue);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(true);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if ((e.key === 'Enter' || e.key === 'Tab') && isOpen && filteredOptions.length > 0) {
      e.preventDefault();
      handleSelect(filteredOptions[0].value);
    } else if (e.key === 'ArrowDown' && !isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <div className={`space-y-1.5 relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-xs font-bold text-primary uppercase tracking-wider block">
          {label}
        </label>
      )}

      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
          <Search className="h-4 w-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            // Select text on focus for easy replacement
            if (inputRef.current) {
              inputRef.current.select();
            }
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-slate-950 border border-border/80 rounded-xl pl-10 pr-16 py-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchTerm && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-muted-foreground hover:text-white hover:bg-secondary/40 transition-colors"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 rounded-md text-muted-foreground hover:text-white transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Dropdown List */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-slate-900 border border-border/80 rounded-xl shadow-2xl backdrop-blur-md scrollbar-thin divide-y divide-border/30 animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Header count indicator */}
          <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-slate-950/60 sticky top-0 backdrop-blur-sm z-10 flex justify-between items-center border-b border-border/40">
            <span>
              {searchTerm.trim()
                ? `${filteredOptions.length} matching result${filteredOptions.length !== 1 ? 's' : ''}`
                : `${options.length} available option${options.length !== 1 ? 's' : ''}`}
            </span>
            {searchTerm.trim() && (
              <span className="text-primary font-mono text-[9px] bg-primary/10 px-1.5 py-0.5 rounded">
                Filtered by &quot;{searchTerm.trim()}&quot;
              </span>
            )}
          </div>

          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = opt.value.toUpperCase() === value.toUpperCase();
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`px-4 py-2.5 hover:bg-primary/20 cursor-pointer text-sm font-semibold transition-colors flex items-center justify-between group ${
                    isSelected
                      ? 'bg-primary/15 text-primary font-bold'
                      : 'text-white/90 hover:text-white'
                  }`}
                >
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[11px] font-normal text-muted-foreground group-hover:text-white/70">
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                </div>
              );
            })
          ) : (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground font-medium">
              {emptyMessage} for &quot;{searchTerm}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
