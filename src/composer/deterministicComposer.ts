import { ContextRecord } from '../types/index.js';

export interface ComposeResult {
  body: string;
  cta: string;
  send_as: 'vera' | 'merchant_on_behalf';
  suppression_key: string;
  rationale: string;
}

export function compose(category: ContextRecord | undefined, merchant: ContextRecord | undefined, trigger: ContextRecord | undefined, customer?: ContextRecord): ComposeResult {
  const merchantPayload = merchant?.payload as Record<string, unknown> | undefined;
  const merchantId = typeof merchantPayload?.merchant_id === 'string' ? merchantPayload.merchant_id : 'merchant';
  const merchantName = typeof (merchantPayload as any)?.identity?.name === 'string' ? (merchantPayload as any).identity.name : merchantId;
  const locality = typeof (merchantPayload as any)?.identity?.locality === 'string' ? (merchantPayload as any).identity.locality : 'your area';
  const city = typeof (merchantPayload as any)?.identity?.city === 'string' ? (merchantPayload as any).identity.city : 'your city';
  const categorySlug = typeof (category?.payload as any)?.slug === 'string' ? (category?.payload as any).slug : 'general';
  const categoryName = categorySlug === 'dentists' ? 'dentistry' : categorySlug === 'salons' ? 'salon services' : categorySlug === 'restaurants' ? 'restaurant growth' : categorySlug === 'gyms' ? 'gym growth' : categorySlug === 'pharmacies' ? 'pharmacy outreach' : categorySlug;
  const triggerPayload = trigger?.payload as Record<string, unknown> | undefined;
  const triggerKind = typeof triggerPayload?.kind === 'string' ? triggerPayload.kind : 'generic';
  const customerPayload = customer?.payload as Record<string, unknown> | undefined;
  const customerName = typeof (customerPayload as any)?.identity?.name === 'string' ? (customerPayload as any).identity.name : 'there';

  const suppressionKey = typeof triggerPayload?.suppression_key === 'string'
    ? triggerPayload.suppression_key
    : `${triggerKind}:${merchantId}`;

  if (triggerKind === 'research_digest') {
    return {
      body: `${merchantName} in ${locality}, ${city}, this is a timely ${categoryName} note. JIDA's latest research digest is relevant for your ${categorySlug} practice, and one item is worth a quick look for your next patient outreach.`,
      cta: 'open_ended',
      send_as: 'vera',
      suppression_key: suppressionKey,
      rationale: 'Merchant-facing research digest with a concrete, category-relevant hook.'
    };
  }

  if (triggerKind === 'perf_spike') {
    return {
      body: `${merchantName} in ${locality}, ${city}, your recent performance looks strong. Views and traffic appear to be rising, and it may be a good time to reinforce the offer that is already resonating with your customers.`,
      cta: 'open_ended',
      send_as: 'vera',
      suppression_key: suppressionKey,
      rationale: 'Merchant-facing performance spike message that turns momentum into a practical next step.'
    };
  }

  if (triggerKind === 'recall_due' || triggerKind === 'appointment_tomorrow') {
    return {
      body: `${customerName}, this is a friendly recall reminder from ${merchantName} in ${locality}, ${city}. We can help you book a visit with a concrete next step.`,
      cta: 'binary_yes_no',
      send_as: 'merchant_on_behalf',
      suppression_key: suppressionKey,
      rationale: 'Customer-scoped reminder with a concrete next step and a low-friction CTA.'
    };
  }

  const merchantFacing = `${merchantName} in ${locality}, ${city}, this is a timely ${categoryName} note based on the latest context. The key point is to act on the current trigger without over-claiming and keep the follow-up simple and specific.`;

  return {
    body: merchantFacing,
    cta: 'open_ended',
    send_as: 'vera',
    suppression_key: suppressionKey,
    rationale: 'Merchant-facing message grounded in the current trigger and merchant context.'
  };
}
