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
export type Track = 'lab' | 'regulatory';

export type SourceTier = 'primary' | 'secondary';
export type SourceRole = 'obligation' | 'fulfillment' | 'context';

export interface Source {
  url: string;
  label: string;
  tier: SourceTier;
  role: SourceRole;
  quote?: string;        // REQUIRED when role === 'obligation' (enforced by invariants, not the type)
  synthesized?: boolean; // true = paraphrased obligation; exempt from quote-drift checking (link health still applies)
}

export interface FulfillmentCheck {
  type: 'url-exists' | 'page-contains' | 'changed-since';
  url: string;
  pattern?: string;
  by: string;            // 'YYYY-MM-DD'
}

export interface Commitment {
  id: string;
  lab: Lab;
  track: Track;                 // 'lab' = a promise the lab made (scored); 'regulatory' = a law/milestone (context, countdown-only)
  title: string;
  description: string;
  category: Category;
  committedOn: string;          // 'YYYY-MM-DD'
  deadlineType: 'calendar' | 'trigger';
  deadline: string | null;      // 'YYYY-MM-DD' for calendar; null for trigger
  triggerText?: string;
  resolution: Resolution;       // null = unresolved
  resolvedOn: string | null;
  sources: Source[];
  deadlineBasis?: 'stated' | 'derived';
  derivationNote?: string;
  triggerFired?: boolean;
  triggerFiredOn?: string | null;
  reviewedBy?: string;
  reviewedOn?: string | null;
  fulfillmentCheck?: FulfillmentCheck;
  contested?: boolean;
  notes?: string;
}
