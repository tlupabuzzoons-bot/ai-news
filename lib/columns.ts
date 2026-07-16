import type { Category } from './types';

export interface ColumnDef {
  key: Category;
  label: string;
  accent: string;
  dark: string;
}

export const COLUMNS: ColumnDef[] = [
  { key: 'models', label: 'Model Releases', accent: '#a78bfa', dark: '#4c1d95' },
  { key: 'research', label: 'Research', accent: '#34d399', dark: '#064e3b' },
  { key: 'industry', label: 'Industry', accent: '#60a5fa', dark: '#1e3a8a' },
  { key: 'tools', label: 'Tools & Launches', accent: '#fbbf24', dark: '#78350f' },
  { key: 'social', label: 'X / Social', accent: '#94a3b8', dark: '#1e293b' },
];
