export type Lab =
  | 'OpenAI' | 'Anthropic' | 'Google DeepMind' | 'xAI' | 'Meta'
  | 'Microsoft' | 'Mistral' | 'Amazon' | 'Multi-lab';

export const LABS: readonly Lab[] = [
  'OpenAI', 'Anthropic', 'Google DeepMind', 'xAI', 'Meta',
  'Microsoft', 'Mistral', 'Amazon', 'Multi-lab',
] as const;

export type Category =
  | 'safety-framework' | 'evaluations' | 'governance'
  | 'transparency' | 'security' | 'access' | 'compute-pledge';

export const CATEGORIES: readonly Category[] = [
  'safety-framework', 'evaluations', 'governance',
  'transparency', 'security', 'access', 'compute-pledge',
] as const;

export type Resolution = 'met' | 'missed' | 'partial' | null;
export type Status = 'met' | 'missed' | 'partial' | 'overdue' | 'upcoming' | 'pending';

export interface Commitment {
  id: string;
  lab: Lab;
  title: string;
  description: string;
  category: Category;
  committedOn: string;          // 'YYYY-MM-DD'
  deadlineType: 'calendar' | 'trigger';
  deadline: string | null;      // 'YYYY-MM-DD' for calendar; null for trigger
  triggerText?: string;
  resolution: Resolution;       // null = unresolved
  resolvedOn: string | null;
  evidenceUrl: string;
  sourceLabel: string;
  contested?: boolean;
  notes?: string;
}
