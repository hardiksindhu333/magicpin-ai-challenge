import { ContextRecord } from '../types/index.js';

export interface ComposeResult {
  body: string;
  cta: string;
  send_as: 'vera' | 'merchant_on_behalf';
  suppression_key: string;
  rationale: string;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function getCategoryLabel(categorySlug: string): string {
  switch (categorySlug) {
    case 'dentists':
      return 'dentistry';
    case 'salons':
      return 'salon services';
    case 'restaurants':
      return 'restaurant growth';
    case 'gyms':
      return 'gym growth';
    case 'pharmacies':
      return 'pharmacy outreach';
    default:
      return categorySlug;
  }
}

export function compose(category: ContextRecord | undefined, merchant: ContextRecord | undefined, trigger: ContextRecord | undefined, customer?: ContextRecord): ComposeResult {
  const merchantPayload = getRecord(merchant?.payload);
  const merchantId = getString(merchantPayload?.merchant_id) ?? 'merchant';
  const merchantIdentity = getRecord(merchantPayload?.identity);
  const merchantName = getString(merchantIdentity?.name) ?? merchantId;
  const locality = getString(merchantIdentity?.locality) ?? 'your area';
  const city = getString(merchantIdentity?.city) ?? 'your city';
  const categoryPayload = getRecord(category?.payload);
  const categorySlug = getString(categoryPayload?.slug) ?? 'general';
  const categoryName = getCategoryLabel(categorySlug);
  const triggerPayload = getRecord(trigger?.payload);
  const triggerKind = getString(triggerPayload?.kind) ?? 'generic';
  const customerPayload = getRecord(customer?.payload);
  const customerIdentity = getRecord(customerPayload?.identity);
  const customerName = getString(customerIdentity?.name) ?? 'there';
  const merchantSignals = Array.isArray(merchantPayload?.signals)
    ? merchantPayload.signals.filter((signal): signal is string => typeof signal === 'string')
    : [];
  const hasHighRiskSignal = merchantSignals.some((signal) => signal.toLowerCase().includes('high_risk') || signal.toLowerCase().includes('adult'));

  const suppressionKey = getString(triggerPayload?.suppression_key) ?? `${triggerKind}:${merchantId}`;

  if (triggerKind === 'research_digest') {
    const topItem = getRecord(triggerPayload?.top_item);
    const title = getString(topItem?.title) ?? getString(triggerPayload?.title) ?? 'a relevant clinical insight';
    const source = getString(topItem?.source) ?? getString(triggerPayload?.source) ?? undefined;
    const trialN = typeof topItem?.trial_n === 'number' ? topItem.trial_n : typeof triggerPayload?.trial_n === 'number' ? triggerPayload.trial_n : undefined;
    const patientSegment = getString(topItem?.patient_segment) ?? getString(triggerPayload?.patient_segment) ?? (hasHighRiskSignal ? 'high-risk adults' : 'your patient base');
    const trialText = trialN ? `${trialN.toLocaleString('en-IN')}-patient trial` : 'a recent study';
    const patientText = patientSegment.replace(/_/g, '-');
    const sourceSuffix = source ? ` — ${source}` : '';

    return {
      body: `${merchantName}, ${title}. One item relevant to ${patientText} — ${trialText} showed ${title.toLowerCase()}. Worth a look (2-min abstract). Want me to pull it + draft a patient-ed WhatsApp you can share?${sourceSuffix}`,
      cta: 'open_ended',
      send_as: 'vera',
      suppression_key: suppressionKey,
      rationale: 'Merchant-facing research digest with a concrete clinical hook and a low-friction next step.'
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
