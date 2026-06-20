import type { Commitment } from '../lib/types';

// All dates and outcomes were verified against primary sources or established
// reporting as of 2026-06-18. Tone is factual: each row states the deadline and
// what was published by it. Genuinely disputable rulings carry `contested: true`.
//
// Sources model: every row carries `sources[]`. An `obligation` source is the
// document that CREATES the promise and carries the verbatim `quote`; a
// `fulfillment` source proves it was / was not delivered. `// TODO verify quote`
// marks a quote not yet confirmed verbatim against the (often JS/PDF) source —
// the daily drift check surfaces these as `inconclusive` for human confirmation.
export const COMMITMENTS: Commitment[] = [
  // ---- resolved: partial (updated policy published ~3 months after the self-imposed deadline) ----
  { id: 'xai-updated-policy-2025', lab: 'xAI', track: 'lab',
    title: 'Publish an updated policy within three months',
    description: 'In a draft framework (~2025-02-20), xAI stated it would release an updated version of the policy within three months (a ~2025-05-10 deadline).',
    category: 'safety-framework', committedOn: '2025-02-20',
    deadlineType: 'calendar', deadline: '2025-05-10',
    deadlineBasis: 'derived',
    derivationNote: '"within three months" of the ~2025-02-20 draft, encoded as a ~2025-05-10 checkpoint.',
    resolution: 'partial', resolvedOn: '2025-08-20', contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://x.ai/documents/2025.02.20-RMF-Draft.pdf', label: 'xAI', tier: 'primary', role: 'obligation',
        quote: 'release an updated version of the policy within three months' }, // TODO verify quote
      { url: 'https://techcrunch.com/2025/05/13/xais-promised-safety-report-is-mia/', label: 'TechCrunch', tier: 'secondary', role: 'fulfillment' },
    ],
    notes: 'No updated policy was published by the ~2025-05-10 deadline; xAI published an updated Risk Management Framework on 2025-08-20, about three months late.' },

  // ---- resolved: met ----
  { id: 'meta-frontier-framework-seoul', lab: 'Meta', track: 'lab',
    title: 'Publish a frontier safety framework by the Paris AI Action Summit',
    description: 'Per the Seoul Frontier AI Safety Commitments, Meta published its Frontier AI Framework on 2025-02-03, ahead of the Paris AI Action Summit (2025-02-10/11).',
    category: 'safety-framework', committedOn: '2024-05-21',
    deadlineType: 'calendar', deadline: '2025-02-10',
    resolution: 'met', resolvedOn: '2025-02-03',
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    fulfillmentCheck: { type: 'url-exists', url: 'https://about.fb.com/news/2025/02/meta-approach-frontier-ai/', by: '2025-02-10' },
    sources: [
      { url: 'https://www.gov.uk/government/publications/frontier-ai-safety-commitments-ai-seoul-summit-2024/frontier-ai-safety-commitments-ai-seoul-summit-2024', label: 'GOV.UK', tier: 'primary', role: 'obligation',
        quote: 'a safety framework focused on severe risks' },
      { url: 'https://about.fb.com/news/2025/02/meta-approach-frontier-ai/', label: 'Meta', tier: 'primary', role: 'fulfillment' },
    ] },

  // ---- resolved: missed (compute pledge; trigger window with a known outcome) ----
  { id: 'openai-superalignment-compute', lab: 'OpenAI', track: 'lab',
    title: 'Dedicate 20% of compute to superalignment over four years',
    description: 'OpenAI committed (2023-07-05) to dedicate 20% of the compute secured to date over four years to the Superalignment effort; the team was dissolved in May 2024.',
    category: 'compute-pledge', committedOn: '2023-07-05',
    deadlineType: 'trigger', deadline: null, triggerText: 'over four years from 2023-07',
    triggerFired: true, triggerFiredOn: '2024-05-17',
    resolution: 'missed', resolvedOn: '2024-05-17', contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://openai.com/index/introducing-superalignment/', label: 'OpenAI', tier: 'primary', role: 'obligation',
        quote: 'dedicating 20% of the compute we’ve secured to date over the next four years' }, // TODO verify quote
      { url: 'https://fortune.com/2024/05/21/openai-superalignment-20-compute-commitment-never-fulfilled-sutskever-leike-altman-brockman-murati/', label: 'Fortune', tier: 'secondary', role: 'fulfillment' },
    ],
    notes: 'Reporting (six sources) says the compute was not fully delivered; OpenAI did not respond to the report and disputes the broader safety criticism. Team disbanded before the four years elapsed.' },

  // ---- fired trigger, unresolved → OVERDUE (gap #7 fix; ASL-3 activated 2025-05-22) ----
  { id: 'anthropic-asl4-before-asl3', lab: 'Anthropic', track: 'lab',
    title: 'Define ASL-4 safeguards before reaching ASL-3',
    description: 'Anthropic’s Responsible Scaling Policy v1.0 stated its commitment was to write the ASL-4 measures before any model reaches ASL-3 capabilities.',
    category: 'safety-framework', committedOn: '2023-09-19',
    deadlineType: 'trigger', deadline: null, triggerText: 'before any model reaches ASL-3',
    triggerFired: true, triggerFiredOn: '2025-05-22',
    resolution: null, resolvedOn: null, contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www-cdn.anthropic.com/1adf000c8f675958c2ee23805d91aaade1cd4613/responsible-scaling-policy.pdf', label: 'Anthropic (RSP v1.0)', tier: 'primary', role: 'obligation',
        quote: 'define ASL-4 evaluations before we first train ASL-3 models' },
      { url: 'https://www.anthropic.com/news/anthropics-responsible-scaling-policy', label: 'Anthropic', tier: 'primary', role: 'context' },
    ],
    notes: 'The original v1.0 trigger is documented. The trigger has since elapsed — Anthropic activated ASL-3 with Claude Opus 4 on 2025-05-22 — and v3.0 (Feb 2026) restructured away from the ASL-4 framing; whether the loosely-specified ASL-4 commitment was satisfied is genuinely disputed.' },

  // ================= appendix-sourced rows =================

  // #3 Anthropic RSP v1.0 published (met)
  { id: 'anthropic-rsp-v1', lab: 'Anthropic', track: 'lab',
    title: 'Publish a Responsible Scaling Policy (v1.0)',
    description: 'Anthropic published Responsible Scaling Policy version 1.0, effective 2023-09-19.',
    category: 'safety-framework', committedOn: '2023-09-19',
    deadlineType: 'calendar', deadline: '2023-09-19',
    resolution: 'met', resolvedOn: '2023-09-19',
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.anthropic.com/news/anthropics-responsible-scaling-policy', label: 'Anthropic', tier: 'primary', role: 'obligation',
        quote: 'Responsible Scaling Policy' }, // TODO verify quote
    ] },

  // #4 Anthropic capability-assessment cadence relaxed (partial/contested)
  { id: 'anthropic-eval-cadence', lab: 'Anthropic', track: 'lab',
    title: 'Capability re-assessment cadence in the Responsible Scaling Policy',
    description: 'The RSP set a regular re-assessment cadence; a 2026-04-02 update extended a three-month evaluation interval to six months, citing rushed elicitation.',
    category: 'evaluations', committedOn: '2023-09-19',
    deadlineType: 'trigger', deadline: null, triggerText: 'regular re-assessment cadence per the RSP',
    resolution: 'partial', resolvedOn: '2026-04-02', contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.anthropic.com/rsp-updates', label: 'Anthropic', tier: 'primary', role: 'obligation',
        quote: 'regular re-assessment of model capabilities', synthesized: true }, // summary of a cadence that changed across RSP versions; no single verbatim clause
    ],
    notes: 'The interval was extended from three to six months; current policy frames Risk Reports as every 3–6 months. Whether this is a relaxation is debated.' },

  // #5 Anthropic Long-Term Benefit Trust board majority (met)
  { id: 'anthropic-ltbt-majority', lab: 'Anthropic', track: 'lab',
    title: 'Long-Term Benefit Trust to elect a majority of the board',
    description: 'Anthropic committed that its Long-Term Benefit Trust would elect a majority of the board within four years of its 2023 Series C; Trust-appointed directors reached a board majority on 2026-04-14.',
    category: 'governance', committedOn: '2023-09-19',
    deadlineType: 'calendar', deadline: '2027-09-19',
    resolution: 'met', resolvedOn: '2026-04-14',
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.anthropic.com/news/the-long-term-benefit-trust', label: 'Anthropic', tier: 'primary', role: 'obligation',
        quote: 'a majority of our Board' },
      { url: 'https://www.anthropic.com/news/narasimhan-board', label: 'Anthropic', tier: 'primary', role: 'fulfillment' },
    ],
    notes: 'Commitment: a Trust-appointed majority within ~4 years of the mid-2023 Series C. Majority reached with the Narasimhan appointment, within the window.' },

  // #6 / #21 OpenAI Preparedness Framework annual review (LIVE: overdue + unresolved)
  { id: 'openai-preparedness-annual-review', lab: 'OpenAI', track: 'lab',
    title: 'Review the Preparedness Framework at least once a year',
    description: 'OpenAI’s Preparedness Framework v2 (2025-04-15) commits to reviewing and potentially updating the framework at least once a year; the next annual review fell due around 2026-04-15.',
    category: 'governance', committedOn: '2025-04-15',
    deadlineType: 'calendar', deadline: '2026-04-15',
    deadlineBasis: 'derived',
    derivationNote: 'Date derived from the v2 "at least once a year" cadence, not an OpenAI-stated deadline.',
    resolution: null, resolvedOn: null, contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    fulfillmentCheck: { type: 'changed-since', url: 'https://openai.com/index/updating-our-preparedness-framework/', by: '2026-04-15' },
    sources: [
      { url: 'https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf', label: 'OpenAI (Preparedness Framework v2)', tier: 'primary', role: 'obligation',
        quote: 'review and potentially update the Preparedness Framework for continued sufficiency at least once a year' },
      { url: 'https://openai.com/index/updating-our-preparedness-framework/', label: 'OpenAI', tier: 'primary', role: 'context' },
    ],
    notes: 'The 2026-04-15 deadline is derived from the v2 "at least once a year" annual-review cadence (Preparedness Framework v2, 2025-04-15), not an OpenAI-stated date. No 2026 Preparedness Framework review had been published as of 2026-06-18. The May 2026 Frontier Governance Framework is a separate document and does not update the Preparedness Framework.' },

  // #7 OpenAI Safety and Security Committee 90-day recommendations (met)
  { id: 'openai-ssc-90-days', lab: 'OpenAI', track: 'lab',
    title: 'Deliver Safety and Security Committee recommendations within 90 days',
    description: 'The OpenAI board formed a Safety and Security Committee on 2024-05-28 with 90 days to make recommendations; the recommendations were published on 2024-09-16.',
    category: 'governance', committedOn: '2024-05-28',
    deadlineType: 'calendar', deadline: '2024-08-26',
    deadlineBasis: 'derived',
    derivationNote: '"90 days" from the 2024-05-28 committee formation, encoded as a 2024-08-26 checkpoint.',
    resolution: 'met', resolvedOn: '2024-09-16',
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://openai.com/index/update-on-safety-and-security-practices/', label: 'OpenAI', tier: 'primary', role: 'obligation',
        quote: 'a 90-day review' },
    ],
    notes: 'Recommendations were adopted and published; published a few weeks after the 90-day mark.' },

  // #8 Google DeepMind FSF "implemented by early 2025" (met)
  { id: 'deepmind-fsf-early-2025', lab: 'Google DeepMind', track: 'lab',
    title: 'Implement the Frontier Safety Framework by early 2025',
    description: 'DeepMind’s Frontier Safety Framework v1.0 (May 2024) aimed to have the framework implemented by early 2025; FSF v2.0 was published on 2025-02-04.',
    category: 'safety-framework', committedOn: '2024-05-17',
    deadlineType: 'calendar', deadline: '2025-03-01',
    deadlineBasis: 'derived',
    derivationNote: '"early 2025" encoded as a 2025-03-01 checkpoint.',
    resolution: 'met', resolvedOn: '2025-02-04', contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/introducing-the-frontier-safety-framework/fsf-technical-report.pdf', label: 'Google DeepMind (FSF v1.0)', tier: 'primary', role: 'obligation',
        quote: 'implemented by early 2025' },
      { url: 'https://deepmind.google/blog/updating-the-frontier-safety-framework/', label: 'Google DeepMind', tier: 'primary', role: 'context' },
    ],
    notes: 'FSF v1.0 stated an aim to have the framework "fully implemented by early 2025"; v2.0 (2025-02-04) specified the promised protocols and capability levels. Whether publishing v2.0 fulfills a commitment to "implement" is debatable; "early 2025" encoded as a 2025-03-01 checkpoint.' },

  // #9 DeepMind FSF evaluation cadence (pending trigger)
  { id: 'deepmind-fsf-eval-cadence', lab: 'Google DeepMind', track: 'lab',
    title: 'Evaluate models at a compute / fine-tuning cadence',
    description: 'DeepMind’s FSF v1.0 stated an aim to evaluate models for every 6x increase in effective compute and every three months of fine-tuning progress.',
    category: 'evaluations', committedOn: '2024-05-17',
    deadlineType: 'trigger', deadline: null, triggerText: 'every 6x effective compute / 3 months fine-tuning (FSF v1.0)',
    resolution: null, resolvedOn: null,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/introducing-the-frontier-safety-framework/fsf-technical-report.pdf', label: 'Google DeepMind', tier: 'primary', role: 'obligation',
        quote: 'every 6x increase in effective compute and every three months of fine-tuning' }, // TODO verify quote
    ],
    notes: 'This 6x / 3-month wording is v1.0 language; FSF v2.0 (2025) replaced the specific numbers with more flexible criteria.' },

  // #10 White House July 2023 voluntary commitments (met, broadly)
  { id: 'wh-voluntary-redteam-2023', lab: 'Multi-lab', track: 'lab',
    title: 'Internal and external security testing before model release (2023 voluntary commitments)',
    description: 'Under the White House voluntary AI commitments (2023-07-21), participating companies committed to internal and external red-team security testing before releasing models.',
    category: 'security', committedOn: '2023-07-21',
    deadlineType: 'trigger', deadline: null, triggerText: 'before each model release',
    resolution: 'met', resolvedOn: '2023-07-21',
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://bidenwhitehouse.archives.gov/wp-content/uploads/2023/09/Voluntary-AI-Commitments-September-2023.pdf', label: 'The White House (archive)', tier: 'primary', role: 'obligation',
        quote: 'internal and external red-teaming of models' }, // TODO verify quote
    ],
    notes: 'Pre-release red-teaming became broadly standard practice among signatories; recorded as broadly met.' },

  // #11 US AISI / NIST MOUs with OpenAI & Anthropic (met)
  { id: 'nist-aisi-mou-2024', lab: 'Multi-lab', track: 'lab',
    title: 'Sign US AI Safety Institute access agreements with OpenAI and Anthropic',
    description: 'On 2024-08-29 the US AI Safety Institute (NIST) announced agreements with OpenAI and Anthropic for collaboration on AI safety research, testing and evaluation, including model access.',
    category: 'access', committedOn: '2024-08-29',
    deadlineType: 'calendar', deadline: '2024-08-29',
    resolution: 'met', resolvedOn: '2024-08-29',
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.nist.gov/news-events/news/2024/08/us-ai-safety-institute-signs-agreements-regarding-ai-safety-research', label: 'NIST', tier: 'primary', role: 'obligation',
        quote: 'formal collaboration on AI safety research, testing and evaluation' },
    ],
    notes: 'A bilateral access agreement the labs entered with NIST / the US AI Safety Institute (government-announced), counted here as a commitment the labs signed onto.' },

  // #12 UK AISI pre-deployment access (partial/contested)
  { id: 'uk-aisi-predeployment', lab: 'Multi-lab', track: 'lab',
    title: 'Provide the UK AI Safety Institute pre-deployment model access',
    description: 'Following the Bletchley commitments, reporting as of late April 2024 found that most labs had not provided the UK AI Safety Institute with pre-deployment model access.',
    category: 'access', committedOn: '2023-11-02',
    deadlineType: 'trigger', deadline: null, triggerText: 'pre-deployment access for state safety institutes',
    resolution: 'partial', resolvedOn: '2024-04-30', contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.gov.uk/government/publications/ai-safety-summit-2023-the-bletchley-declaration', label: 'GOV.UK', tier: 'primary', role: 'obligation',
        quote: 'pre-deployment access for state safety institutes', synthesized: true }, // paraphrase of the aspirational Bletchley Declaration; no verbatim clause
      { url: 'https://newsletter.safe.ai/p/ai-safety-newsletter-34-new-military', label: 'Center for AI Safety', tier: 'secondary', role: 'fulfillment' },
    ],
    notes: 'As of late April 2024, only Google DeepMind had provided the UK AISI pre-deployment access; OpenAI, Anthropic and Meta had not. Access expanded later in 2024 (e.g. a joint US/UK evaluation). The underlying Bletchley commitment was a voluntary aspiration to deepen access, not a firm dated deadline — hence partial and contested.' },

  // #13 EU GPAI Code of Practice finalized (regulatory instrument — countdown-only context)
  { id: 'eu-gpai-cop-finalized', lab: 'Multi-lab', track: 'regulatory',
    title: 'EU General-Purpose AI Code of Practice published',
    description: 'The European Commission published the final General-Purpose AI Code of Practice on 2025-07-10. It is a voluntary instrument under the EU AI Act, not a promise a lab made.',
    category: 'governance', committedOn: '2024-08-01',
    deadlineType: 'calendar', deadline: '2025-07-10',
    resolution: null, resolvedOn: null,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai', label: 'European Commission', tier: 'primary', role: 'context',
        quote: 'General-Purpose AI Code of Practice' }, // TODO verify quote
    ],
    notes: 'Regulatory instrument under the EU AI Act; shown as context, not scored.' },

  // #14 EU GPAI obligations apply (regulatory — statutory date, countdown-only)
  { id: 'eu-aia-gpai-apply-2025', lab: 'Multi-lab', track: 'regulatory',
    title: 'EU AI Act general-purpose AI obligations begin to apply',
    description: 'Under EU AI Act Article 113, the general-purpose AI model obligations (Chapter V) began to apply on 2025-08-02, 12 months after the Act entered into force.',
    category: 'governance', committedOn: '2024-08-01',
    deadlineType: 'calendar', deadline: '2025-08-02',
    resolution: null, resolvedOn: null,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://artificialintelligenceact.eu/article/113/', label: 'EU AI Act', tier: 'primary', role: 'context',
        quote: 'Chapter V (general-purpose AI models) shall apply from 2 August 2025' }, // TODO verify quote
    ],
    notes: 'Statutory in-force date under the EU AI Act; shown as context, not scored.' },

  // #16 Microsoft Frontier Governance Framework v1 (met)
  { id: 'microsoft-frontier-governance-v1', lab: 'Microsoft', track: 'lab',
    title: 'Publish a Frontier Governance Framework (v1)',
    description: 'Microsoft published version 1 of its Frontier Governance Framework, dated 2025-02-08.',
    category: 'safety-framework', committedOn: '2024-05-21',
    deadlineType: 'calendar', deadline: '2025-02-10',
    resolution: 'met', resolvedOn: '2025-02-08',
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.gov.uk/government/publications/frontier-ai-safety-commitments-ai-seoul-summit-2024/frontier-ai-safety-commitments-ai-seoul-summit-2024', label: 'GOV.UK', tier: 'primary', role: 'obligation',
        quote: 'a safety framework focused on severe risks' },
      { url: 'https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Microsoft-Frontier-Governance-Framework.pdf', label: 'Microsoft', tier: 'primary', role: 'fulfillment' },
    ],
    notes: 'Document change log records 2025-02-08 as the first version, ahead of the Paris AI Action Summit.' },

  // #17 Anthropic RSP v3.0 (met)
  { id: 'anthropic-rsp-v3', lab: 'Anthropic', track: 'lab',
    title: 'Publish Responsible Scaling Policy v3.0',
    description: 'Anthropic published Responsible Scaling Policy version 3.0, effective 2026-02-24.',
    category: 'safety-framework', committedOn: '2026-02-24',
    deadlineType: 'calendar', deadline: '2026-02-24',
    resolution: 'met', resolvedOn: '2026-02-24',
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.anthropic.com/rsp-updates', label: 'Anthropic', tier: 'primary', role: 'obligation',
        quote: 'Responsible Scaling Policy' }, // TODO verify quote
    ] },

  // #18 Anthropic sabotage risk reports for future frontier models (met)
  { id: 'anthropic-sabotage-reports', lab: 'Anthropic', track: 'lab',
    title: 'Publish sabotage risk reports for future frontier models',
    description: 'Anthropic committed at the Claude Opus 4.5 launch to publish sabotage risk reports for future frontier models; the first such report (covering Opus 4.6) was published on 2026-02-10.',
    category: 'transparency', committedOn: '2025-11-24',
    deadlineType: 'trigger', deadline: null, triggerText: 'for each future frontier model clearly exceeding Opus 4.5',
    resolution: 'met', resolvedOn: '2026-02-10',
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.anthropic.com/rsp-updates', label: 'Anthropic', tier: 'primary', role: 'obligation',
        quote: 'publish sabotage risk reports for future frontier models' }, // TODO verify quote
    ],
    notes: 'Commitment made at the Opus 4.5 launch; first report fulfilling it covered Opus 4.6 (2026-02-10).' },

  // ---- NEW (M1): Anthropic activated ASL-3 safeguards with Claude Opus 4 (met) ----
  { id: 'anthropic-asl3-opus4', lab: 'Anthropic', track: 'lab',
    title: 'Apply ASL-3 safeguards when a model may reach the ASL-3 threshold',
    description: 'Anthropic’s Responsible Scaling Policy commits to applying ASL-3 Security and Deployment Standards before deploying a model that may have crossed the corresponding capability threshold. On 2025-05-22 Anthropic activated ASL-3 protections with the launch of Claude Opus 4.',
    category: 'security', committedOn: '2023-09-19',
    deadlineType: 'trigger', deadline: null, triggerText: 'when a model may reach the ASL-3 capability threshold',
    resolution: 'met', resolvedOn: '2025-05-22',
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.anthropic.com/news/activating-asl3-protections', label: 'Anthropic', tier: 'primary', role: 'obligation',
        quote: 'apply ASL-3 Security and Deployment Standards' }, // TODO verify quote
    ],
    notes: 'Claude Opus 4 was the first Anthropic model deployed under ASL-3; Anthropic applied the standard as a precautionary measure without definitively determining the threshold had been crossed.' },

  // ---- NEW (M1): Anthropic interpretability goal "by 2027" (LIVE: upcoming, contested) ----
  { id: 'anthropic-interpretability-2027', lab: 'Anthropic', track: 'lab',
    title: 'Interpretability that can "reliably detect most model problems" by 2027',
    description: 'In an April 2025 essay, Anthropic CEO Dario Amodei stated: "Anthropic is doubling down on interpretability, and we have a goal of getting to \'interpretability can reliably detect most model problems\' by 2027."',
    category: 'evaluations', committedOn: '2025-04-24',
    deadlineType: 'calendar', deadline: '2027-12-31',
    deadlineBasis: 'derived',
    derivationNote: '"by 2027" encoded as a 2027-12-31 checkpoint.',
    resolution: null, resolvedOn: null, contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.darioamodei.com/post/the-urgency-of-interpretability', label: 'Dario Amodei (Anthropic)', tier: 'primary', role: 'obligation',
        quote: 'we have a goal of getting to "interpretability can reliably detect most model problems" by 2027' },
    ],
    notes: 'A CEO-stated organizational goal rather than a precise, falsifiable deliverable; "by 2027" encoded as a 2027-12-31 checkpoint. Whether "most model problems" is measurable is debatable.' },

  // ---- NEW (M1): Multi-lab Seoul commitment to publish a frontier safety framework before Paris (met, uneven) ----
  { id: 'seoul-frameworks-by-paris', lab: 'Multi-lab', track: 'lab',
    title: 'Publish a frontier safety framework before the Paris AI Action Summit',
    description: 'At the AI Seoul Summit (2024-05-21), 16 companies — including OpenAI, Anthropic, Google, Microsoft, Meta, Amazon and xAI — signed the Frontier AI Safety Commitments, agreeing to publish a safety framework focused on severe risks by the next AI Summit, held in Paris on 2025-02-10/11.',
    category: 'safety-framework', committedOn: '2024-05-21',
    deadlineType: 'calendar', deadline: '2025-02-10',
    resolution: 'partial', resolvedOn: '2025-02-10', contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.gov.uk/government/publications/frontier-ai-safety-commitments-ai-seoul-summit-2024/frontier-ai-safety-commitments-ai-seoul-summit-2024', label: 'GOV.UK', tier: 'primary', role: 'obligation',
        quote: 'a safety framework focused on severe risks' },
    ],
    notes: 'Most signatories published a framework by the Paris Summit (Meta, Google DeepMind, Microsoft, OpenAI, Amazon, G42 and others); coverage was uneven across the 16+ signatories and some frameworks arrived close to or just after the summit, so the collective ruling is debatable.' },

  // ---- NEW (M1): White House voluntary commitment — watermarking / provenance for AI-generated content (partial, contested) ----
  { id: 'wh-voluntary-watermarking-2023', lab: 'Multi-lab', track: 'lab',
    title: 'Develop provenance or watermarking for AI-generated content (2023 voluntary commitments)',
    description: 'Under the White House voluntary AI commitments (2023-07-21), participating companies committed to develop robust mechanisms — including provenance and/or watermarking — so users can tell when audio or visual content is AI-generated.',
    category: 'transparency', committedOn: '2023-07-21',
    deadlineType: 'trigger', deadline: null, triggerText: 'develop provenance/watermarking for in-scope AI-generated audio-visual content',
    resolution: 'partial', resolvedOn: '2024-07-21', contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://bidenwhitehouse.archives.gov/wp-content/uploads/2023/09/Voluntary-AI-Commitments-September-2023.pdf', label: 'The White House (archive)', tier: 'primary', role: 'obligation',
        quote: 'develop robust mechanisms, including provenance and/or watermarking' }, // TODO verify quote
    ],
    notes: 'Some signatories shipped provenance tooling (e.g. Google SynthID, C2PA Content Credentials), but a 2025 academic review found deployment across publicly available products was uneven a year on; recorded as partial.' },

  // LIVE (cadence-derived): Anthropic Risk Report next due (upcoming)
  { id: 'anthropic-risk-report-next', lab: 'Anthropic', track: 'lab',
    title: 'Publish a Risk Report every three to six months',
    description: 'RSP v3.0 commits Anthropic to publishing a Risk Report (with minimal redactions) every three to six months; the first general Risk Report was published 2026-02-24, placing the next due by about 2026-08-24.',
    category: 'transparency', committedOn: '2026-02-24',
    deadlineType: 'calendar', deadline: '2026-08-24',
    deadlineBasis: 'derived',
    derivationNote: 'Six-month outer bound of the RSP v3.0 "every 3–6 months" clause from the 2026-02-24 report → ~2026-08-24 (derived, not lab-stated).',
    resolution: null, resolvedOn: null, contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://cdn.sanity.io/files/4zrzovbb/website/c11e84981d0a7281a1b229f3fa6af0da66eaf43f.pdf', label: 'Anthropic (RSP v3.3)', tier: 'primary', role: 'obligation',
        quote: 'publish a Risk Report every 3-6 months' },
      { url: 'https://www.anthropic.com/rsp-updates', label: 'Anthropic', tier: 'primary', role: 'context' },
    ],
    notes: 'Cadence derived from the RSP v3.0 clause "Risk Reports will be published online (with some redactions) every 3–6 months." Six-month outer bound from the 2026-02-24 report gives ~2026-08-24 (a derived next-date, not a lab-stated one).' },

  // LIVE (cadence-derived): Anthropic annual third-party procedural review (upcoming)
  { id: 'anthropic-annual-procedural-review', lab: 'Anthropic', track: 'lab',
    title: 'Annual third-party review of Responsible Scaling Policy compliance',
    description: 'RSP v3.0 commits Anthropic to an annual third-party review of compliance with its main procedural commitments; anchored to the 2026-02-24 v3.0 effective date, the next review falls due around 2027-02-24.',
    category: 'governance', committedOn: '2026-02-24',
    deadlineType: 'calendar', deadline: '2027-02-24',
    deadlineBasis: 'derived',
    derivationNote: 'One year from the v3.0 effective date (2026-02-24) → ~2027-02-24 (derived, not lab-stated).',
    resolution: null, resolvedOn: null, contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://cdn.sanity.io/files/4zrzovbb/website/c11e84981d0a7281a1b229f3fa6af0da66eaf43f.pdf', label: 'Anthropic (RSP v3.3)', tier: 'primary', role: 'obligation',
        quote: 'commission a third-party review that assesses whether we adhered to this policy' },
      { url: 'https://www.anthropic.com/rsp-updates', label: 'Anthropic', tier: 'primary', role: 'context' },
    ],
    notes: 'Cadence derived from the RSP v3.0 commitment to an annual third-party procedural-compliance review; next-due ~2027-02-24 (one year from the v3.0 effective date, a derived date rather than a lab-stated one).' },

  // #20 REGULATORY: EU AI Act high-risk (Annex III) — deferred by the Digital Omnibus (countdown-only)
  { id: 'eu-aia-highrisk-annex3', lab: 'Multi-lab', track: 'regulatory',
    title: 'EU AI Act high-risk (Annex III) obligations apply',
    description: 'The EU AI Act originally applied Annex III (standalone, use-based) high-risk obligations from 2026-08-02. The Digital Omnibus deal (provisional political agreement, May 2026) defers them to 2027-12-02.',
    category: 'governance', committedOn: '2024-08-01',
    deadlineType: 'calendar', deadline: '2027-12-02',
    resolution: null, resolvedOn: null,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.hoganlovells.com/en/publications/eu-legislators-agree-to-delay-for-highrisk-ai-rules', label: 'Hogan Lovells', tier: 'secondary', role: 'context',
        quote: 'delay for high-risk AI rules' }, // TODO verify quote
    ],
    notes: 'New date (2027-12-02) is the Digital Omnibus deferral, provisionally agreed and pending formal adoption / EU Official Journal publication; the prior statutory date was 2026-08-02. Shown as a countdown, not scored.' },

  // REGULATORY: EU AI Act Annex I high-risk — deferred by the Digital Omnibus (countdown-only)
  { id: 'eu-aia-highrisk-annex1', lab: 'Multi-lab', track: 'regulatory',
    title: 'EU AI Act high-risk (Annex I) obligations apply',
    description: 'The Article 6(1) obligations for high-risk systems that are safety components of products covered by EU product law (Annex I) originally applied from 2027-08-02. The Digital Omnibus deal (provisional agreement, May 2026) defers them to 2028-08-02.',
    category: 'governance', committedOn: '2024-08-01',
    deadlineType: 'calendar', deadline: '2028-08-02',
    resolution: null, resolvedOn: null,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://www.hoganlovells.com/en/publications/eu-legislators-agree-to-delay-for-highrisk-ai-rules', label: 'Hogan Lovells', tier: 'secondary', role: 'context',
        quote: 'delay for high-risk AI rules' }, // TODO verify quote
    ],
    notes: 'New date (2028-08-02) is the Digital Omnibus deferral, provisionally agreed and pending formal adoption / EU Official Journal publication; the prior date was 2027-08-02. Shown as a countdown, not scored.' },

  // #19 REGULATORY: EU AI Act obligations for legacy GPAI models (countdown-only)
  { id: 'eu-aia-gpai-legacy-2027', lab: 'Multi-lab', track: 'regulatory',
    title: 'EU AI Act obligations apply to GPAI models already on the market',
    description: 'Under EU AI Act Article 111, providers of general-purpose AI models placed on the market before 2025-08-02 must comply with the GPAI obligations by 2027-08-02.',
    category: 'governance', committedOn: '2024-08-01',
    deadlineType: 'calendar', deadline: '2027-08-02',
    resolution: null, resolvedOn: null,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://artificialintelligenceact.eu/article/111/', label: 'EU AI Act', tier: 'primary', role: 'context',
        quote: 'shall comply with the obligations laid down in this Regulation by 2 August 2027' }, // TODO verify quote
    ],
    notes: 'Statutory transition deadline for pre-existing GPAI models; shown as a countdown, not scored.' },

  // REGULATORY: EU AI Act first Commission evaluation due 2028-08-02 (countdown-only)
  { id: 'eu-aia-commission-eval-2028', lab: 'Multi-lab', track: 'regulatory',
    title: 'EU AI Act first Commission evaluation and review',
    description: 'Under EU AI Act Article 112, the Commission must evaluate the need to amend the high-risk list and related provisions by 2028-08-02, then every four years.',
    category: 'governance', committedOn: '2024-08-01',
    deadlineType: 'calendar', deadline: '2028-08-02',
    resolution: null, resolvedOn: null,
    reviewedBy: 'sa', reviewedOn: '2026-06-18',
    sources: [
      { url: 'https://artificialintelligenceact.eu/article/112/', label: 'EU AI Act', tier: 'primary', role: 'context',
        quote: 'by 2 August 2028 and every four years thereafter' }, // TODO verify quote
    ],
    notes: 'Statutory review cycle (first due 2028-08-02, then every four years); shown as a countdown, not scored.' },

  // ================= M7 (coverage): Amazon/Mistral/xAI Seoul + more White House commitments =================

  // Amazon — Seoul framework by Paris (met) — fills Amazon coverage
  { id: 'amazon-frontier-framework-seoul', lab: 'Amazon', track: 'lab',
    title: 'Publish a frontier safety framework by the Paris AI Action Summit',
    description: 'As a signatory of the Seoul Frontier AI Safety Commitments (2024-05-21), Amazon published its Frontier Model Safety Framework on 2025-02-09, ahead of the Paris AI Action Summit (2025-02-10/11).',
    category: 'safety-framework', committedOn: '2024-05-21',
    deadlineType: 'calendar', deadline: '2025-02-10',
    resolution: 'met', resolvedOn: '2025-02-09',
    reviewedBy: 'sa', reviewedOn: '2026-06-19',
    sources: [
      { url: 'https://www.gov.uk/government/publications/frontier-ai-safety-commitments-ai-seoul-summit-2024/frontier-ai-safety-commitments-ai-seoul-summit-2024', label: 'GOV.UK', tier: 'primary', role: 'obligation',
        quote: 'a safety framework focused on severe risks' },
      { url: 'https://www.amazon.science/publications/amazons-frontier-model-safety-framework', label: 'Amazon Science', tier: 'primary', role: 'fulfillment' },
    ],
    notes: 'Amazon is a named Seoul signatory; its Frontier Model Safety Framework (dated 2025-02-09) cites Amazon’s endorsement of the Korea Frontier AI Safety Commitments and was published the day before the Paris summit opened.' },

  // xAI — Seoul framework by Paris (missed, contested) — the FIRST, externally-pledged deadline (distinct from the 3-month one)
  { id: 'xai-frontier-framework-seoul', lab: 'xAI', track: 'lab',
    title: 'Publish a frontier safety framework by the Paris AI Action Summit',
    description: 'As a Seoul Frontier AI Safety Commitments signatory (2024-05-21), xAI was due to publish a severe-risk safety framework by the Paris AI Action Summit (2025-02-10). By the deadline it had only a watermarked DRAFT Risk Management Framework, document-dated 2025-02-20.',
    category: 'safety-framework', committedOn: '2024-05-21',
    deadlineType: 'calendar', deadline: '2025-02-10',
    resolution: 'missed', resolvedOn: '2025-02-20', contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-19',
    sources: [
      { url: 'https://www.gov.uk/government/publications/frontier-ai-safety-commitments-ai-seoul-summit-2024/frontier-ai-safety-commitments-ai-seoul-summit-2024', label: 'GOV.UK', tier: 'primary', role: 'obligation',
        quote: 'a safety framework focused on severe risks' },
      { url: 'https://www.themidasproject.com/article-list/xai-misses-a-second-self-imposed-deadline-to-implement-a-frontier-safety-policy', label: 'The Midas Project', tier: 'secondary', role: 'fulfillment' },
    ],
    notes: 'No finalized framework existed by the 2025-02-10 deadline; xAI’s draft RMF is document-dated 2025-02-20 (~10 days late), watermarked DRAFT, and per The Midas Project applied only to systems not yet in development (excluding Grok 3). A lenient reading would call this partial (a draft was published); scored missed because the committed deliverable did not exist by the deadline — hence contested.' },

  // Mistral — Seoul framework by Paris (missed, contested) — fills Mistral coverage
  { id: 'mistral-frontier-framework-seoul', lab: 'Mistral', track: 'lab',
    title: 'Publish a frontier safety framework by the Paris AI Action Summit',
    description: 'As a Seoul Frontier AI Safety Commitments signatory (2024-05-21), Mistral AI was due to publish a severe-risk safety framework by the Paris AI Action Summit (2025-02-10). As of mid-2026, no such framework appears on independent indexes of published frontier safety policies.',
    category: 'safety-framework', committedOn: '2024-05-21',
    deadlineType: 'calendar', deadline: '2025-02-10',
    resolution: 'missed', resolvedOn: '2025-02-10', contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-19',
    sources: [
      { url: 'https://www.gov.uk/government/publications/frontier-ai-safety-commitments-ai-seoul-summit-2024/frontier-ai-safety-commitments-ai-seoul-summit-2024', label: 'GOV.UK', tier: 'primary', role: 'obligation',
        quote: 'a safety framework focused on severe risks' },
      { url: 'https://metr.org/common-elements', label: 'METR', tier: 'secondary', role: 'fulfillment' },
    ],
    notes: 'Mistral is a named Seoul signatory but does not appear on METR’s index of companies that have published frontier safety policies, and SaferAI rates it as having no published framework with capability thresholds. The missed ruling rests on absence from these published-framework indexes rather than a positive non-publication statement — hence contested.' },

  // White House 2023 — model-weight security (missed)
  { id: 'wh-voluntary-weight-security-2023', lab: 'Multi-lab', track: 'lab',
    title: 'Protect unreleased model weights (2023 voluntary commitments)',
    description: 'Under the White House voluntary AI commitments (2023-07-21), signatories pledged to safeguard unreleased model weights — limiting access, running insider-threat detection, and securing storage. A 2025 study of 16 signatories found this the worst-performed of the eight commitments.',
    category: 'security', committedOn: '2023-07-21',
    deadlineType: 'trigger', deadline: null, triggerText: 'safeguard unreleased frontier model weights (cybersecurity + insider threat)',
    resolution: 'missed', resolvedOn: '2025-08-11',
    reviewedBy: 'sa', reviewedOn: '2026-06-19',
    sources: [
      { url: 'https://bidenwhitehouse.archives.gov/wp-content/uploads/2023/09/Voluntary-AI-Commitments-September-2023.pdf', label: 'The White House (archive)', tier: 'primary', role: 'obligation',
        quote: 'safeguarding unreleased model weights' }, // TODO verify quote
      { url: 'https://arxiv.org/abs/2508.08345', label: 'Wang, Huang, Klyman & Bommasani (AIES 2025)', tier: 'secondary', role: 'fulfillment' },
    ],
    notes: 'Assessed against public disclosures through 2024-12-31 in the Stanford-affiliated study “Do AI Companies Make Good on Voluntary Commitments to the White House?” — the lowest-scoring commitment, with 11 of 16 companies scoring 0%. Corroborated by RAND’s “Securing AI Model Weights” (2024). Scored as broadly missed across signatories. (The commitment was first signed by 7 companies on 2023-07-21; later cohorts — Sept 2023 and 2024 — brought the study’s assessed set to 16.)' },

  // White House 2023 — third-party vulnerability reporting (partial)
  { id: 'wh-voluntary-vuln-reporting-2023', lab: 'Multi-lab', track: 'lab',
    title: 'Incentivize third-party vulnerability reporting (2023 voluntary commitments)',
    description: 'Under the White House voluntary AI commitments (2023-07-21), signatories pledged bounty systems or contests to incentivize responsible third-party discovery and reporting of model weaknesses.',
    category: 'security', committedOn: '2023-07-21',
    deadlineType: 'trigger', deadline: null, triggerText: 'run/expand bounty mechanisms covering in-scope AI systems',
    resolution: 'partial', resolvedOn: '2025-08-11',
    reviewedBy: 'sa', reviewedOn: '2026-06-19',
    sources: [
      { url: 'https://bidenwhitehouse.archives.gov/wp-content/uploads/2023/09/Voluntary-AI-Commitments-September-2023.pdf', label: 'The White House (archive)', tier: 'primary', role: 'obligation',
        quote: 'incentivize third-party discovery and reporting of issues and vulnerabilities' }, // TODO verify quote
      { url: 'https://arxiv.org/abs/2508.08345', label: 'Wang, Huang, Klyman & Bommasani (AIES 2025)', tier: 'secondary', role: 'fulfillment' },
    ],
    notes: 'The 2025 study (disclosures through 2024-12-31) scored this second-lowest, with 8 of 16 companies at 0%. Frontier labs do run AI bug bounties (OpenAI, Anthropic, Microsoft, Google), but coverage is uneven across signatories — recorded as partial.' },

  // White House 2023 — public capability/limitations reporting (partial, contested)
  { id: 'wh-voluntary-capability-reporting-2023', lab: 'Multi-lab', track: 'lab',
    title: 'Publicly report model capabilities and limitations (2023 voluntary commitments)',
    description: 'Under the White House voluntary AI commitments (2023-07-21), signatories pledged to publish reports for significant model releases covering capabilities, limitations, and domains of appropriate and inappropriate use.',
    category: 'transparency', committedOn: '2023-07-21',
    deadlineType: 'trigger', deadline: null, triggerText: 'publish a capabilities/limitations report with each significant model release',
    resolution: 'partial', resolvedOn: '2025-08-11', contested: true,
    reviewedBy: 'sa', reviewedOn: '2026-06-19',
    sources: [
      { url: 'https://bidenwhitehouse.archives.gov/wp-content/uploads/2023/09/Voluntary-AI-Commitments-September-2023.pdf', label: 'The White House (archive)', tier: 'primary', role: 'obligation',
        quote: 'publicly report model or system capabilities, limitations, and domains of appropriate and inappropriate use' }, // TODO verify quote
      { url: 'https://arxiv.org/abs/2508.08345', label: 'Wang, Huang, Klyman & Bommasani (AIES 2025)', tier: 'secondary', role: 'fulfillment' },
    ],
    notes: 'Shallow disclosure is near-universal — frontier labs publish system/model cards for major releases — but the 2025 study found deeper indicators (limitations, societal-risk discussion, adversarial-test results) met inconsistently. Recorded as partial; contested because the basic reporting bar is broadly met while the substantive bar is not.' },
];
