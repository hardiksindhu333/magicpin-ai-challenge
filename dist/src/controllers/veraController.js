import { z } from 'zod';
const contextRequestSchema = z.object({
    scope: z.enum(['category', 'merchant', 'customer', 'trigger']),
    context_id: z.string().min(1),
    version: z.number().int().nonnegative(),
    payload: z.unknown(),
    delivered_at: z.string().optional()
});
const tickRequestSchema = z.object({
    now: z.string().optional(),
    available_triggers: z.array(z.string()).optional()
});
const replyRequestSchema = z.object({
    conversation_id: z.string().min(1),
    merchant_id: z.string().min(1),
    customer_id: z.string().nullable().optional(),
    from_role: z.string().min(1),
    message: z.string().min(1),
    received_at: z.string().optional(),
    turn_number: z.number().int().optional()
});
export function createVeraController(store, decisionService) {
    const startedAt = Date.now();
    return {
        health: (_req, res) => {
            res.json({
                status: 'ok',
                uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
                contexts_loaded: store.getCounts()
            });
        },
        metadata: (_req, res) => {
            res.json({
                team_name: 'Team Alpha',
                team_members: ['Alice', 'Bob'],
                model: 'claude-opus-4-7',
                approach: 'single-prompt composer with retrieval over digest items + dispatch by trigger.kind',
                contact_email: 'team@example.com',
                version: '1.2.0',
                submitted_at: '2026-04-26T08:00:00Z'
            });
        },
        context: (req, res) => {
            const parsed = contextRequestSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ accepted: false, reason: 'invalid_scope', details: parsed.error.message });
            }
            const { scope, context_id, version, payload } = parsed.data;
            const result = store.upsert(scope, context_id, version, payload, parsed.data.delivered_at ?? new Date().toISOString());
            if (!result.accepted) {
                return res.status(200).json({ accepted: false, reason: 'stale_version', current_version: result.current_version });
            }
            return res.status(200).json({ accepted: true, ack_id: `ack_${context_id}_v${version}`, stored_at: new Date().toISOString() });
        },
        tick: async (req, res) => {
            const parsed = tickRequestSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: 'invalid_tick' });
            }
            const response = await decisionService.handleTick(parsed.data.now ?? new Date().toISOString(), parsed.data.available_triggers ?? []);
            res.json(response);
        },
        reply: async (req, res) => {
            const parsed = replyRequestSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: 'invalid_reply' });
            }
            const response = await decisionService.handleReply(parsed.data.conversation_id, parsed.data.merchant_id, parsed.data.customer_id ?? null, parsed.data.from_role, parsed.data.message);
            res.json(response);
        }
    };
}
