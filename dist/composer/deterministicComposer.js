export function compose(category, merchant, trigger, customer) {
    const merchantPayload = merchant?.payload;
    const merchantId = typeof merchantPayload?.merchant_id === 'string' ? merchantPayload.merchant_id : 'merchant';
    const merchantName = typeof merchantPayload?.identity?.name === 'string' ? merchantPayload.identity.name : merchantId;
    const categorySlug = typeof category?.payload?.slug === 'string' ? (category?.payload).slug : 'general';
    const triggerPayload = trigger?.payload;
    const triggerKind = typeof triggerPayload?.kind === 'string' ? triggerPayload.kind : 'generic';
    const customerPayload = customer?.payload;
    const customerName = typeof customerPayload?.identity?.name === 'string' ? customerPayload.identity.name : 'there';
    const merchantFacing = `Dr. ${merchantName.split(' ').slice(-1)[0] || 'there'}, this is a timely ${categorySlug} note based on the latest context. The key point is to act on the current trigger without over-claiming. Keep the follow-up simple and specific.`;
    const customerFacing = `${customerName}, this is a friendly recall reminder from ${merchantName}. We can help you book a visit with a concrete next step.`;
    if (triggerKind === 'recall_due' || triggerKind === 'appointment_tomorrow') {
        return {
            body: customerFacing,
            cta: 'binary_yes_no',
            send_as: 'merchant_on_behalf',
            suppression_key: trigger?.payload && typeof trigger.payload.suppression_key === 'string' ? trigger.payload.suppression_key : `${triggerKind}:${merchantId}`,
            rationale: 'Customer-scoped reminder with a concrete next step and a low-friction CTA.'
        };
    }
    return {
        body: merchantFacing,
        cta: 'open_ended',
        send_as: 'vera',
        suppression_key: trigger?.payload && typeof trigger.payload.suppression_key === 'string' ? trigger.payload.suppression_key : `${triggerKind}:${merchantId}`,
        rationale: 'Merchant-facing message grounded in the current trigger and merchant context.'
    };
}
