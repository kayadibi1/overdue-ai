import type { Commitment } from '../lib/types';

// All dates and outcomes were verified against primary sources or established
// reporting as of 2026-06-18. Tone is factual: each row states the deadline and
// what was published by it. Genuinely disputable rulings carry `contested: true`.
export const COMMITMENTS: Commitment[] = [
  // ---- resolved: partial (updated policy published ~3 months after the self-imposed deadline) ----
  { id: 'xai-updated-policy-2025', lab: 'xAI', track: 'lab',
    title: 'Publish an updated policy within three months',
    description: 'In a draft framework (~2025-02-20), xAI stated it would release an updated version of the policy within three months (a ~2025-05-10 deadline).',
    category: 'safety-framework', committedOn: '2025-02-20',
    deadlineType: 'calendar', deadline: '2025-05-10',
    resolution: 'partial', resolvedOn: '2025-08-20', contested: true,
    evidenceUrl: 'https://techcrunch.com/2025/05/13/xais-promised-safety-report-is-mia/',
    sourceLabel: 'TechCrunch',
    notes: 'No updated policy was published by the ~2025-05-10 deadline; xAI published an updated Risk Management Framework on 2025-08-20, about three months late.' },

  // ---- resolved: met ----
  { id: 'meta-frontier-framework-seoul', lab: 'Meta', track: 'lab',
    title: 'Publish a frontier safety framework by the Paris AI Action Summit',
    description: 'Per the Seoul Frontier AI Safety Commitments, Meta published its Frontier AI Framework on 2025-02-03, ahead of the Paris AI Action Summit (2025-02-10/11).',
    category: 'safety-framework', committedOn: '2024-05-21',
    deadlineType: 'calendar', deadline: '2025-02-10',
    resolution: 'met', resolvedOn: '2025-02-03',
    evidenceUrl: 'https://about.fb.com/news/2025/02/meta-approach-frontier-ai/',
    sourceLabel: 'Meta' },

  // ---- resolved: missed (compute pledge; trigger window with a known outcome) ----
  { id: 'openai-superalignment-compute', lab: 'OpenAI', track: 'lab',
    title: 'Dedicate 20% of compute to superalignment over four years',
    description: 'OpenAI committed (2023-07-05) to dedicate 20% of the compute secured to date over four years to the Superalignment effort; the team was dissolved in May 2024.',
    category: 'compute-pledge', committedOn: '2023-07-05',
    deadlineType: 'trigger', deadline: null, triggerText: 'over four years from 2023-07',
    resolution: 'missed', resolvedOn: '2024-05-17',
    evidenceUrl: 'https://fortune.com/2024/05/21/openai-superalignment-20-compute-commitment-never-fulfilled-sutskever-leike-altman-brockman-murati/',
    sourceLabel: 'Fortune', contested: true,
    notes: 'Reporting (six sources) says the compute was not fully delivered; OpenAI did not respond to the report and disputes the broader safety criticism. Team disbanded before the four years elapsed.' },

  // ---- pending trigger (no date, unresolved) ----
  { id: 'anthropic-asl4-before-asl3', lab: 'Anthropic', track: 'lab',
    title: 'Define ASL-4 safeguards before reaching ASL-3',
    description: 'Anthropic’s Responsible Scaling Policy v1.0 stated its commitment was to write the ASL-4 measures before any model reaches ASL-3 capabilities.',
    category: 'safety-framework', committedOn: '2023-09-19',
    deadlineType: 'trigger', deadline: null, triggerText: 'before any model reaches ASL-3',
    resolution: null, resolvedOn: null,
    evidenceUrl: 'https://www.anthropic.com/news/anthropics-responsible-scaling-policy',
    sourceLabel: 'Anthropic', contested: true,
    notes: 'The original v1.0 trigger is documented; whether later RSP revisions altered this is contested. Shown as an open trigger.' },

  // ================= appendix-sourced rows =================

  // #3 Anthropic RSP v1.0 published (met)
  { id: 'anthropic-rsp-v1', lab: 'Anthropic', track: 'lab',
    title: 'Publish a Responsible Scaling Policy (v1.0)',
    description: 'Anthropic published Responsible Scaling Policy version 1.0, effective 2023-09-19.',
    category: 'safety-framework', committedOn: '2023-09-19',
    deadlineType: 'calendar', deadline: '2023-09-19',
    resolution: 'met', resolvedOn: '2023-09-19',
    evidenceUrl: 'https://www.anthropic.com/news/anthropics-responsible-scaling-policy',
    sourceLabel: 'Anthropic' },

  // #4 Anthropic capability-assessment cadence relaxed (partial/contested)
  { id: 'anthropic-eval-cadence', lab: 'Anthropic', track: 'lab',
    title: 'Capability re-assessment cadence in the Responsible Scaling Policy',
    description: 'The RSP set a regular re-assessment cadence; a 2026-04-02 update extended a three-month evaluation interval to six months, citing rushed elicitation.',
    category: 'evaluations', committedOn: '2023-09-19',
    deadlineType: 'trigger', deadline: null, triggerText: 'regular re-assessment cadence per the RSP',
    resolution: 'partial', resolvedOn: '2026-04-02',
    evidenceUrl: 'https://www.anthropic.com/rsp-updates',
    sourceLabel: 'Anthropic', contested: true,
    notes: 'The interval was extended from three to six months; current policy frames Risk Reports as every 3–6 months. Whether this is a relaxation is debated.' },

  // #5 Anthropic Long-Term Benefit Trust board majority (met)
  { id: 'anthropic-ltbt-majority', lab: 'Anthropic', track: 'lab',
    title: 'Long-Term Benefit Trust to elect a majority of the board',
    description: 'Anthropic committed that its Long-Term Benefit Trust would elect a majority of the board within four years of its 2023 Series C; Trust-appointed directors reached a board majority on 2026-04-14.',
    category: 'governance', committedOn: '2023-09-19',
    deadlineType: 'calendar', deadline: '2027-09-19',
    resolution: 'met', resolvedOn: '2026-04-14',
    evidenceUrl: 'https://www.anthropic.com/news/narasimhan-board',
    sourceLabel: 'Anthropic',
    notes: 'Commitment: a Trust-appointed majority within ~4 years of the mid-2023 Series C. Majority reached with the Narasimhan appointment, within the window.' },

  // #6 / #21 OpenAI Preparedness Framework annual review (LIVE: overdue + unresolved)
  { id: 'openai-preparedness-annual-review', lab: 'OpenAI', track: 'lab',
    title: 'Review the Preparedness Framework at least once a year',
    description: 'OpenAI’s Preparedness Framework v2 (2025-04-15) commits to reviewing and potentially updating the framework at least once a year; the next annual review fell due around 2026-04-15.',
    category: 'governance', committedOn: '2025-04-15',
    deadlineType: 'calendar', deadline: '2026-04-15',
    resolution: null, resolvedOn: null, contested: true,
    evidenceUrl: 'https://openai.com/index/updating-our-preparedness-framework/',
    sourceLabel: 'OpenAI',
    notes: 'The 2026-04-15 deadline is derived from the v2 "at least once a year" annual-review cadence (Preparedness Framework v2, 2025-04-15), not an OpenAI-stated date. No 2026 Preparedness Framework review had been published as of 2026-06-18. The May 2026 Frontier Governance Framework is a separate document and does not update the Preparedness Framework.' },

  // #7 OpenAI Safety and Security Committee 90-day recommendations (met)
  { id: 'openai-ssc-90-days', lab: 'OpenAI', track: 'lab',
    title: 'Deliver Safety and Security Committee recommendations within 90 days',
    description: 'The OpenAI board formed a Safety and Security Committee on 2024-05-28 with 90 days to make recommendations; the recommendations were published on 2024-09-16.',
    category: 'governance', committedOn: '2024-05-28',
    deadlineType: 'calendar', deadline: '2024-08-26',
    resolution: 'met', resolvedOn: '2024-09-16',
    evidenceUrl: 'https://openai.com/index/update-on-safety-and-security-practices/',
    sourceLabel: 'OpenAI',
    notes: 'Recommendations were adopted and published; published a few weeks after the 90-day mark.' },

  // #8 Google DeepMind FSF "implemented by early 2025" (met)
  { id: 'deepmind-fsf-early-2025', lab: 'Google DeepMind', track: 'lab',
    title: 'Implement the Frontier Safety Framework by early 2025',
    description: 'DeepMind’s Frontier Safety Framework v1.0 (May 2024) aimed to have the framework implemented by early 2025; FSF v2.0 was published on 2025-02-04.',
    category: 'safety-framework', committedOn: '2024-05-17',
    deadlineType: 'calendar', deadline: '2025-03-01',
    resolution: 'met', resolvedOn: '2025-02-04',
    evidenceUrl: 'https://deepmind.google/blog/updating-the-frontier-safety-framework/',
    sourceLabel: 'Google DeepMind',
    notes: 'FSF v2.0 (2025-02-04) specified the detection protocols and critical capability levels promised in v1.0. "Early 2025" encoded as a 2025-03-01 checkpoint.' },

  // #9 DeepMind FSF evaluation cadence (pending trigger)
  { id: 'deepmind-fsf-eval-cadence', lab: 'Google DeepMind', track: 'lab',
    title: 'Evaluate models at a compute / fine-tuning cadence',
    description: 'DeepMind’s FSF v1.0 stated an aim to evaluate models for every 6x increase in effective compute and every three months of fine-tuning progress.',
    category: 'evaluations', committedOn: '2024-05-17',
    deadlineType: 'trigger', deadline: null, triggerText: 'every 6x effective compute / 3 months fine-tuning (FSF v1.0)',
    resolution: null, resolvedOn: null,
    evidenceUrl: 'https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/introducing-the-frontier-safety-framework/fsf-technical-report.pdf',
    sourceLabel: 'Google DeepMind',
    notes: 'This 6x / 3-month wording is v1.0 language; FSF v2.0 (2025) replaced the specific numbers with more flexible criteria.' },

  // #10 White House July 2023 voluntary commitments (met, broadly)
  { id: 'wh-voluntary-redteam-2023', lab: 'Multi-lab', track: 'lab',
    title: 'Internal and external security testing before model release (2023 voluntary commitments)',
    description: 'Under the White House voluntary AI commitments (2023-07-21), participating companies committed to internal and external red-team security testing before releasing models.',
    category: 'security', committedOn: '2023-07-21',
    deadlineType: 'trigger', deadline: null, triggerText: 'before each model release',
    resolution: 'met', resolvedOn: '2023-07-21',
    evidenceUrl: 'https://bidenwhitehouse.archives.gov/wp-content/uploads/2023/09/Voluntary-AI-Commitments-September-2023.pdf',
    sourceLabel: 'The White House (archive)',
    notes: 'Pre-release red-teaming became broadly standard practice among signatories; recorded as broadly met.' },

  // #11 US AISI / NIST MOUs with OpenAI & Anthropic (met)
  { id: 'nist-aisi-mou-2024', lab: 'Multi-lab', track: 'lab',
    title: 'Sign US AI Safety Institute access agreements with OpenAI and Anthropic',
    description: 'On 2024-08-29 the US AI Safety Institute (NIST) announced agreements with OpenAI and Anthropic for collaboration on AI safety research, testing and evaluation, including model access.',
    category: 'access', committedOn: '2024-08-29',
    deadlineType: 'calendar', deadline: '2024-08-29',
    resolution: 'met', resolvedOn: '2024-08-29',
    evidenceUrl: 'https://www.nist.gov/news-events/news/2024/08/us-ai-safety-institute-signs-agreements-regarding-ai-safety-research',
    sourceLabel: 'NIST' },

  // #12 UK AISI pre-deployment access (missed/contested)
  { id: 'uk-aisi-predeployment', lab: 'Multi-lab', track: 'lab',
    title: 'Provide the UK AI Safety Institute pre-deployment model access',
    description: 'Following the Bletchley commitments, reporting in April 2024 found that several labs had not provided the UK AI Safety Institute with pre-deployment model access.',
    category: 'access', committedOn: '2023-11-02',
    deadlineType: 'trigger', deadline: null, triggerText: 'pre-deployment access for state safety institutes',
    resolution: 'missed', resolvedOn: '2024-04-30',
    evidenceUrl: 'https://subscriber.politicopro.com/article/2024/04/rishi-sunak-struggles-to-implement-his-landmark-ai-testing-deal-00153105',
    sourceLabel: 'POLITICO', contested: true,
    notes: 'In April 2024, several labs had not given pre-deployment access; the situation was partly remedied later in 2024 (e.g. a joint US/UK Claude 3.5 Sonnet evaluation). Labs cited the absence of agreed common evaluation procedures.' },

  // #13 EU GPAI Code of Practice finalized (regulatory instrument — countdown-only context)
  { id: 'eu-gpai-cop-finalized', lab: 'Multi-lab', track: 'regulatory',
    title: 'EU General-Purpose AI Code of Practice published',
    description: 'The European Commission published the final General-Purpose AI Code of Practice on 2025-07-10. It is a voluntary instrument under the EU AI Act, not a promise a lab made.',
    category: 'governance', committedOn: '2024-08-01',
    deadlineType: 'calendar', deadline: '2025-07-10',
    resolution: null, resolvedOn: null,
    evidenceUrl: 'https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai',
    sourceLabel: 'European Commission',
    notes: 'Regulatory instrument under the EU AI Act; shown as context, not scored.' },

  // #14 EU GPAI obligations apply (regulatory — statutory date, countdown-only)
  { id: 'eu-aia-gpai-apply-2025', lab: 'Multi-lab', track: 'regulatory',
    title: 'EU AI Act general-purpose AI obligations begin to apply',
    description: 'Under EU AI Act Article 113, the general-purpose AI model obligations (Chapter V) began to apply on 2025-08-02, 12 months after the Act entered into force.',
    category: 'governance', committedOn: '2024-08-01',
    deadlineType: 'calendar', deadline: '2025-08-02',
    resolution: null, resolvedOn: null,
    evidenceUrl: 'https://artificialintelligenceact.eu/article/113/',
    sourceLabel: 'EU AI Act',
    notes: 'Statutory in-force date under the EU AI Act; shown as context, not scored.' },

  // #16 Microsoft Frontier Governance Framework v1 (met)
  { id: 'microsoft-frontier-governance-v1', lab: 'Microsoft', track: 'lab',
    title: 'Publish a Frontier Governance Framework (v1)',
    description: 'Microsoft published version 1 of its Frontier Governance Framework, dated 2025-02-08.',
    category: 'safety-framework', committedOn: '2024-05-21',
    deadlineType: 'calendar', deadline: '2025-02-10',
    resolution: 'met', resolvedOn: '2025-02-08',
    evidenceUrl: 'https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Microsoft-Frontier-Governance-Framework.pdf',
    sourceLabel: 'Microsoft',
    notes: 'Document change log records 2025-02-08 as the first version, ahead of the Paris AI Action Summit.' },

  // #17 Anthropic RSP v3.0 (met)
  { id: 'anthropic-rsp-v3', lab: 'Anthropic', track: 'lab',
    title: 'Publish Responsible Scaling Policy v3.0',
    description: 'Anthropic published Responsible Scaling Policy version 3.0, effective 2026-02-24.',
    category: 'safety-framework', committedOn: '2026-02-24',
    deadlineType: 'calendar', deadline: '2026-02-24',
    resolution: 'met', resolvedOn: '2026-02-24',
    evidenceUrl: 'https://www.anthropic.com/rsp-updates',
    sourceLabel: 'Anthropic' },

  // #18 Anthropic sabotage risk reports for future frontier models (met)
  { id: 'anthropic-sabotage-reports', lab: 'Anthropic', track: 'lab',
    title: 'Publish sabotage risk reports for future frontier models',
    description: 'Anthropic committed at the Claude Opus 4.5 launch to publish sabotage risk reports for future frontier models; the first such report (covering Opus 4.6) was published on 2026-02-10.',
    category: 'transparency', committedOn: '2025-11-24',
    deadlineType: 'trigger', deadline: null, triggerText: 'for each future frontier model clearly exceeding Opus 4.5',
    resolution: 'met', resolvedOn: '2026-02-10',
    evidenceUrl: 'https://www.anthropic.com/rsp-updates',
    sourceLabel: 'Anthropic',
    notes: 'Commitment made at the Opus 4.5 launch; first report fulfilling it covered Opus 4.6 (2026-02-10).' },

  // ---- NEW (M1): Anthropic activated ASL-3 safeguards with Claude Opus 4 (met) ----
  { id: 'anthropic-asl3-opus4', lab: 'Anthropic', track: 'lab',
    title: 'Apply ASL-3 safeguards when a model may reach the ASL-3 threshold',
    description: 'Anthropic’s Responsible Scaling Policy commits to applying ASL-3 Security and Deployment Standards before deploying a model that may have crossed the corresponding capability threshold. On 2025-05-22 Anthropic activated ASL-3 protections with the launch of Claude Opus 4.',
    category: 'security', committedOn: '2023-09-19',
    deadlineType: 'trigger', deadline: null, triggerText: 'when a model may reach the ASL-3 capability threshold',
    resolution: 'met', resolvedOn: '2025-05-22',
    evidenceUrl: 'https://www.anthropic.com/news/activating-asl3-protections',
    sourceLabel: 'Anthropic',
    notes: 'Claude Opus 4 was the first Anthropic model deployed under ASL-3; Anthropic applied the standard as a precautionary measure without definitively determining the threshold had been crossed.' },

  // ---- NEW (M1): Anthropic interpretability goal "by 2027" (LIVE: upcoming, contested) ----
  { id: 'anthropic-interpretability-2027', lab: 'Anthropic', track: 'lab',
    title: 'Interpretability that can "reliably detect most model problems" by 2027',
    description: 'In an April 2025 essay, Anthropic CEO Dario Amodei stated: "Anthropic is doubling down on interpretability, and we have a goal of getting to \'interpretability can reliably detect most model problems\' by 2027."',
    category: 'evaluations', committedOn: '2025-04-24',
    deadlineType: 'calendar', deadline: '2027-12-31',
    resolution: null, resolvedOn: null, contested: true,
    evidenceUrl: 'https://www.darioamodei.com/post/the-urgency-of-interpretability',
    sourceLabel: 'Dario Amodei (Anthropic)',
    notes: 'A CEO-stated organizational goal rather than a precise, falsifiable deliverable; "by 2027" encoded as a 2027-12-31 checkpoint. Whether "most model problems" is measurable is debatable.' },

  // ---- NEW (M1): Multi-lab Seoul commitment to publish a frontier safety framework before Paris (met, uneven) ----
  { id: 'seoul-frameworks-by-paris', lab: 'Multi-lab', track: 'lab',
    title: 'Publish a frontier safety framework before the Paris AI Action Summit',
    description: 'At the AI Seoul Summit (2024-05-21), 16 companies — including OpenAI, Anthropic, Google, Microsoft, Meta, Amazon and xAI — signed the Frontier AI Safety Commitments, agreeing to publish a safety framework focused on severe risks by the next AI Summit, held in Paris on 2025-02-10/11.',
    category: 'safety-framework', committedOn: '2024-05-21',
    deadlineType: 'calendar', deadline: '2025-02-10',
    resolution: 'met', resolvedOn: '2025-02-10',
    evidenceUrl: 'https://www.gov.uk/government/publications/frontier-ai-safety-commitments-ai-seoul-summit-2024/frontier-ai-safety-commitments-ai-seoul-summit-2024',
    sourceLabel: 'GOV.UK', contested: true,
    notes: 'Most signatories published a framework by the Paris Summit (Meta, Google DeepMind, Microsoft, OpenAI, Amazon, G42 and others); coverage was uneven across the 16+ signatories and some frameworks arrived close to or just after the summit, so the collective ruling is debatable.' },

  // ---- NEW (M1): OpenAI Safety and Security Committee becomes an independent board committee (met) ----
  { id: 'openai-ssc-independent', lab: 'OpenAI', track: 'lab',
    title: 'Establish the Safety and Security Committee as an independent board committee',
    description: 'On 2024-09-16, following the Safety and Security Committee’s 90-day review (the committee was formed 2024-05-28), OpenAI announced the committee would become an independent board oversight committee, chaired by Zico Kolter, with authority to delay model releases over safety concerns.',
    category: 'governance', committedOn: '2024-05-28',
    deadlineType: 'calendar', deadline: '2024-09-16',
    resolution: 'met', resolvedOn: '2024-09-16',
    evidenceUrl: 'https://openai.com/index/update-on-safety-and-security-practices/',
    sourceLabel: 'OpenAI',
    notes: 'Distinct from the 90-day recommendations deliverable: this is the conversion of the committee into an independent board oversight committee, confirmed by OpenAI and reported by CNBC on 2024-09-16.' },

  // ---- NEW (M1): White House voluntary commitment — watermarking / provenance for AI-generated content (partial, contested) ----
  { id: 'wh-voluntary-watermarking-2023', lab: 'Multi-lab', track: 'lab',
    title: 'Develop provenance or watermarking for AI-generated content (2023 voluntary commitments)',
    description: 'Under the White House voluntary AI commitments (2023-07-21), participating companies committed to develop robust mechanisms — including provenance and/or watermarking — so users can tell when audio or visual content is AI-generated.',
    category: 'transparency', committedOn: '2023-07-21',
    deadlineType: 'trigger', deadline: null, triggerText: 'develop provenance/watermarking for in-scope AI-generated audio-visual content',
    resolution: 'partial', resolvedOn: '2024-07-21',
    evidenceUrl: 'https://bidenwhitehouse.archives.gov/wp-content/uploads/2023/09/Voluntary-AI-Commitments-September-2023.pdf',
    sourceLabel: 'The White House (archive)', contested: true,
    notes: 'Some signatories shipped provenance tooling (e.g. Google SynthID, C2PA Content Credentials), but a 2025 academic review found deployment across publicly available products was uneven a year on; recorded as partial.' },

  // LIVE (cadence-derived): Anthropic Risk Report next due (upcoming)
  { id: 'anthropic-risk-report-next', lab: 'Anthropic', track: 'lab',
    title: 'Publish a Risk Report every three to six months',
    description: 'RSP v3.0 commits Anthropic to publishing a (redacted) Risk Report every three to six months; the first general Risk Report was published 2026-02-24, placing the next due by about 2026-08-24.',
    category: 'transparency', committedOn: '2026-02-24',
    deadlineType: 'calendar', deadline: '2026-08-24',
    resolution: null, resolvedOn: null, contested: true,
    evidenceUrl: 'https://www.anthropic.com/rsp-updates',
    sourceLabel: 'Anthropic',
    notes: 'Cadence derived from the RSP v3.0 clause "Risk Reports will be published online (with some redactions) every 3–6 months." Six-month outer bound from the 2026-02-24 report gives ~2026-08-24 (a derived next-date, not a lab-stated one).' },

  // LIVE (cadence-derived): Anthropic annual third-party procedural review (upcoming)
  { id: 'anthropic-annual-procedural-review', lab: 'Anthropic', track: 'lab',
    title: 'Annual third-party review of Responsible Scaling Policy compliance',
    description: 'RSP v3.0 commits Anthropic to an annual third-party review of compliance with its main procedural commitments; anchored to the 2026-02-24 v3.0 effective date, the next review falls due around 2027-02-24.',
    category: 'governance', committedOn: '2026-02-24',
    deadlineType: 'calendar', deadline: '2027-02-24',
    resolution: null, resolvedOn: null, contested: true,
    evidenceUrl: 'https://www.anthropic.com/rsp-updates',
    sourceLabel: 'Anthropic',
    notes: 'Cadence derived from the RSP v3.0 commitment to an annual third-party procedural-compliance review; next-due ~2027-02-24 (one year from the v3.0 effective date, a derived date rather than a lab-stated one).' },

  // #20 REGULATORY: EU AI Act high-risk (Annex III) obligations apply 2026-08-02 (countdown-only)
  { id: 'eu-aia-highrisk-annex3-2026', lab: 'Multi-lab', track: 'regulatory',
    title: 'EU AI Act high-risk (Annex III) obligations apply',
    description: 'Under EU AI Act Article 113, the Act applies generally from 2026-08-02, including the high-risk obligations for systems listed in Annex III.',
    category: 'governance', committedOn: '2024-08-01',
    deadlineType: 'calendar', deadline: '2026-08-02',
    resolution: null, resolvedOn: null,
    evidenceUrl: 'https://artificialintelligenceact.eu/article/113/',
    sourceLabel: 'EU AI Act',
    notes: 'Statutory deadline (24 months after entry into force); shown as a countdown, not scored.' },

  // REGULATORY: EU AI Act Annex I high-risk obligations apply 2027-08-02 (countdown-only)
  { id: 'eu-aia-highrisk-annex1-2027', lab: 'Multi-lab', track: 'regulatory',
    title: 'EU AI Act high-risk (Annex I) obligations apply',
    description: 'Under EU AI Act Article 113, the Article 6(1) obligations for high-risk systems that are safety components of products covered by EU product law (Annex I) apply from 2027-08-02.',
    category: 'governance', committedOn: '2024-08-01',
    deadlineType: 'calendar', deadline: '2027-08-02',
    resolution: null, resolvedOn: null,
    evidenceUrl: 'https://artificialintelligenceact.eu/article/113/',
    sourceLabel: 'EU AI Act',
    notes: 'Statutory deadline (36 months after entry into force) for Annex I high-risk systems — distinct from the Article 111 legacy-GPAI deadline on the same date.' },

  // #19 REGULATORY: EU AI Act obligations for legacy GPAI models (countdown-only)
  { id: 'eu-aia-gpai-legacy-2027', lab: 'Multi-lab', track: 'regulatory',
    title: 'EU AI Act obligations apply to GPAI models already on the market',
    description: 'Under EU AI Act Article 111, providers of general-purpose AI models placed on the market before 2025-08-02 must comply with the GPAI obligations by 2027-08-02.',
    category: 'governance', committedOn: '2024-08-01',
    deadlineType: 'calendar', deadline: '2027-08-02',
    resolution: null, resolvedOn: null,
    evidenceUrl: 'https://artificialintelligenceact.eu/article/111/',
    sourceLabel: 'EU AI Act',
    notes: 'Statutory transition deadline for pre-existing GPAI models; shown as a countdown, not scored.' },

  // REGULATORY: EU AI Act first Commission evaluation due 2028-08-02 (countdown-only)
  { id: 'eu-aia-commission-eval-2028', lab: 'Multi-lab', track: 'regulatory',
    title: 'EU AI Act first Commission evaluation and review',
    description: 'Under EU AI Act Article 112, the Commission must evaluate the need to amend the high-risk list and related provisions by 2028-08-02, then every four years.',
    category: 'governance', committedOn: '2024-08-01',
    deadlineType: 'calendar', deadline: '2028-08-02',
    resolution: null, resolvedOn: null,
    evidenceUrl: 'https://artificialintelligenceact.eu/article/112/',
    sourceLabel: 'EU AI Act',
    notes: 'Statutory review cycle (first due 2028-08-02, then every four years); shown as a countdown, not scored.' },
];
