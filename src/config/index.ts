import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  teamName: process.env.TEAM_NAME ?? 'Team Alpha',
  teamMembers: (process.env.TEAM_MEMBERS ?? 'Alice,Bob').split(',').map((member) => member.trim()),
  model: process.env.MODEL_NAME ?? 'deterministic-composer-v1',
  approach:
    process.env.APPROACH ??
    'deterministic trigger-dispatch composer grounded in category, merchant, trigger, and customer context',
  contactEmail: process.env.CONTACT_EMAIL ?? 'team@example.com',
  version: process.env.APP_VERSION ?? '1.2.0',
  submittedAt: process.env.SUBMITTED_AT ?? '2026-04-26T08:00:00Z',
  openAiApiKey: process.env.OPENAI_API_KEY ?? '',
  useLlm: process.env.USE_LLM === 'true'
};
