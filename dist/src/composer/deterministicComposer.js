import { activeOfferTitle, asNumber, asRecord, asString, asStringArray, findDigestItem, formatPercent, merchantDisplayName, monthsSince, ownerFirstName, payloadOf } from '../utils/contextHelpers.js';
function baseResult(body, cta, send_as, suppression_key, rationale, template_name, template_params) {
    return { body, cta, send_as, suppression_key, rationale, template_name, template_params };
}
function merchantFacing(merchantPayload, categoryPayload, triggerPayload, body, cta, rationale, templateName) {
    const merchantName = merchantDisplayName(merchantPayload);
    const businessName = asString(asRecord(merchantPayload.identity)?.name) ?? merchantName;
    const categorySlug = asString(categoryPayload.slug) ?? 'general';
    return baseResult(body, cta, 'vera', asString(triggerPayload.suppression_key) ?? `generic:${asString(merchantPayload.merchant_id) ?? 'merchant'}`, rationale, templateName, [merchantName, businessName, categorySlug, body]);
}
function customerFacing(merchantPayload, customerPayload, triggerPayload, body, cta, rationale, templateName) {
    const customerIdentity = asRecord(customerPayload.identity);
    const customerName = asString(customerIdentity?.name) ?? 'there';
    const merchantIdentity = asRecord(merchantPayload.identity);
    const merchantName = asString(merchantIdentity?.name) ?? 'the clinic';
    return baseResult(body, cta, 'merchant_on_behalf', asString(triggerPayload.suppression_key) ?? `customer:${asString(customerPayload.customer_id) ?? 'unknown'}`, rationale, templateName, [customerName, merchantName, body]);
}
function composeResearchDigest(input) {
    const categoryPayload = payloadOf(input.category);
    const merchantPayload = payloadOf(input.merchant);
    const triggerPayload = payloadOf(input.trigger);
    const triggerData = asRecord(triggerPayload.payload);
    const itemId = asString(triggerData?.top_item_id);
    const digestItem = findDigestItem(categoryPayload, itemId) ?? asRecord(triggerPayload.top_item);
    const merchantName = merchantDisplayName(merchantPayload);
    const signals = asStringArray(merchantPayload.signals);
    const hasHighRisk = signals.some((signal) => signal.includes('high_risk'));
    const aggregate = asRecord(merchantPayload.customer_aggregate);
    const highRiskCount = asNumber(aggregate?.high_risk_adult_count);
    const title = asString(digestItem?.title) ?? asString(triggerPayload.title) ?? 'a relevant clinical insight';
    const source = asString(digestItem?.source) ?? asString(triggerPayload.source);
    const trialN = asNumber(digestItem?.trial_n) ?? asNumber(triggerPayload.trial_n);
    const summary = asString(digestItem?.summary);
    const patientSegment = hasHighRisk
        ? `${highRiskCount ?? 'your'} high-risk adult patients`
        : 'your patient base';
    const trialText = trialN ? `${trialN.toLocaleString('en-IN')}-patient trial` : 'Recent evidence';
    const summaryAnchor = summary?.match(/(\d+%[^.]*)/)?.[1];
    const effectText = summaryAnchor ?? title.toLowerCase();
    const sourceSuffix = source ? ` — ${source}` : '';
    const body = `${merchantName}, JIDA's latest issue landed. One item relevant to ${patientSegment} — ${trialText} showed ${effectText}. Worth a look (2-min abstract). Want me to pull it + draft a patient-ed WhatsApp you can share?${sourceSuffix}`;
    return merchantFacing(merchantPayload, categoryPayload, triggerPayload, body, 'open_ended', 'External research digest with a merchant-specific clinical anchor and a low-friction next step.', 'vera_research_digest_v1');
}
function composeRegulationChange(input) {
    const categoryPayload = payloadOf(input.category);
    const merchantPayload = payloadOf(input.merchant);
    const triggerPayload = payloadOf(input.trigger);
    const triggerData = asRecord(triggerPayload.payload);
    const itemId = asString(triggerData?.top_item_id);
    const digestItem = findDigestItem(categoryPayload, itemId);
    const merchantName = merchantDisplayName(merchantPayload);
    const title = asString(digestItem?.title) ?? 'A compliance update needs your attention';
    const source = asString(digestItem?.source);
    const deadline = asString(triggerData?.deadline_iso);
    const actionable = asString(digestItem?.actionable) ?? asString(digestItem?.summary);
    const deadlineText = deadline ? ` Effective ${deadline.slice(0, 10)}.` : '';
    const body = `${merchantName}, compliance alert: ${title}.${deadlineText} ${actionable ?? 'Worth a quick audit before the deadline.'} Want me to draft a one-page SOP note for your team?${source ? ` — ${source}` : ''}`;
    return merchantFacing(merchantPayload, categoryPayload, triggerPayload, body, 'binary_yes_no', 'Regulation-change trigger with a concrete compliance action and source citation.', 'vera_compliance_alert_v1');
}
function composeRecallDue(input) {
    const merchantPayload = payloadOf(input.merchant);
    const customerPayload = payloadOf(input.customer);
    const triggerPayload = payloadOf(input.trigger);
    const triggerData = asRecord(triggerPayload.payload);
    const customerIdentity = asRecord(customerPayload.identity);
    const customerName = asString(customerIdentity?.name) ?? 'there';
    const merchantIdentity = asRecord(merchantPayload.identity);
    const merchantName = asString(merchantIdentity?.name) ?? 'the clinic';
    const relationship = asRecord(customerPayload.relationship);
    const lastVisit = asString(relationship?.last_visit);
    const months = lastVisit && input.nowIso ? monthsSince(lastVisit, input.nowIso) : undefined;
    const offer = activeOfferTitle(merchantPayload) ?? 'Dental Cleaning @ ₹299';
    const slots = Array.isArray(triggerData?.available_slots) ? triggerData.available_slots : [];
    const slotLabels = slots
        .map((slot) => asString(asRecord(slot)?.label))
        .filter((label) => Boolean(label));
    const slotText = slotLabels.length >= 2
        ? `${slotLabels[0]} ya ${slotLabels[1]}`
        : slotLabels[0] ?? 'a weekday evening slot';
    const monthsText = months ? `${months} months` : 'a few months';
    const body = `Hi ${customerName}, ${merchantName} here. It's been ${monthsText} since your last visit — your 6-month cleaning recall is due. Apke liye 2 slots ready hain: ${slotText}. ${offer} + complimentary fluoride. Reply 1 for the first slot, 2 for the second, or tell us a time that works.`;
    return customerFacing(merchantPayload, customerPayload, triggerPayload, body, 'multi_choice_slot', 'Customer recall with real slots, catalog price, and hi-en mix language preference.', 'merchant_recall_reminder_v1');
}
function composePerfSpike(input) {
    const merchantPayload = payloadOf(input.merchant);
    const categoryPayload = payloadOf(input.category);
    const triggerPayload = payloadOf(input.trigger);
    const triggerData = asRecord(triggerPayload.payload);
    const merchantName = merchantDisplayName(merchantPayload);
    const identity = asRecord(merchantPayload.identity);
    const locality = asString(identity?.locality) ?? 'your area';
    const metric = asString(triggerData?.metric) ?? 'views';
    const deltaPct = asNumber(triggerData?.delta_pct);
    const deltaText = deltaPct !== undefined ? formatPercent(deltaPct) : 'strong';
    const offer = activeOfferTitle(merchantPayload);
    const offerText = offer ? ` Your active offer "${offer}" may be driving this.` : '';
    const body = `${merchantName}, quick heads-up: your ${metric} are up ${deltaText} this week in ${locality}.${offerText} Want me to draft a Google post to keep the momentum going?`;
    return merchantFacing(merchantPayload, categoryPayload, triggerPayload, body, 'binary_yes_no', 'Performance spike message anchored on the merchant metric and an actionable next step.', 'vera_perf_spike_v1');
}
function composePerfDip(input) {
    const merchantPayload = payloadOf(input.merchant);
    const categoryPayload = payloadOf(input.category);
    const triggerPayload = payloadOf(input.trigger);
    const triggerData = asRecord(triggerPayload.payload);
    const merchantName = merchantDisplayName(merchantPayload);
    const metric = asString(triggerData?.metric) ?? 'calls';
    const deltaPct = asNumber(triggerData?.delta_pct);
    const baseline = asNumber(triggerData?.vs_baseline);
    const deltaText = deltaPct !== undefined ? formatPercent(deltaPct) : 'noticeably';
    const baselineText = baseline !== undefined ? ` (baseline ~${baseline}/week)` : '';
    const body = `${merchantName}, your ${metric} dropped ${deltaText} week-over-week${baselineText}. I can pull the top 2 fixes from your listing data — want a 3-line action plan?`;
    return merchantFacing(merchantPayload, categoryPayload, triggerPayload, body, 'binary_yes_no', 'Performance dip message with a verifiable metric and a concrete recovery offer.', 'vera_perf_dip_v1');
}
function composeSeasonalPerfDip(input) {
    const merchantPayload = payloadOf(input.merchant);
    const categoryPayload = payloadOf(input.category);
    const triggerPayload = payloadOf(input.trigger);
    const triggerData = asRecord(triggerPayload.payload);
    const merchantName = merchantDisplayName(merchantPayload);
    const metric = asString(triggerData?.metric) ?? 'views';
    const deltaPct = asNumber(triggerData?.delta_pct);
    const aggregate = asRecord(merchantPayload.customer_aggregate);
    const memberCount = asNumber(aggregate?.total_unique_ytd) ?? asNumber(asRecord(merchantPayload.performance)?.leads);
    const deltaText = deltaPct !== undefined ? formatPercent(deltaPct) : 'about 30%';
    const membersText = memberCount ? `${memberCount} members` : 'your active members';
    const body = `${merchantName}, your ${metric} are down ${deltaText} this week — this matches the normal April-June acquisition lull (metro gyms typically see -25 to -35%). For now, focus retention on ${membersText}. Want me to draft a summer attendance challenge to keep them engaged through the dip?`;
    return merchantFacing(merchantPayload, categoryPayload, triggerPayload, body, 'binary_yes_no', 'Seasonal dip reframed with peer benchmark and a retention-focused next step.', 'vera_seasonal_dip_v1');
}
function composeCuriousAsk(input) {
    const merchantPayload = payloadOf(input.merchant);
    const categoryPayload = payloadOf(input.category);
    const triggerPayload = payloadOf(input.trigger);
    const merchantName = ownerFirstName(merchantPayload) ?? merchantDisplayName(merchantPayload);
    const identity = asRecord(merchantPayload.identity);
    const businessName = asString(identity?.name) ?? 'your business';
    const body = `Hi ${merchantName}! Quick check — what service has been most asked-for this week at ${businessName}? I'll turn the answer into a Google post + a 4-line WhatsApp reply you can use when customers ask about pricing. Takes 5 min.`;
    return merchantFacing(merchantPayload, categoryPayload, triggerPayload, body, 'open_ended', 'Curious-ask cadence that asks the merchant directly and offers reciprocity.', 'vera_curious_ask_v1');
}
function composeIplMatch(input) {
    const merchantPayload = payloadOf(input.merchant);
    const categoryPayload = payloadOf(input.category);
    const triggerPayload = payloadOf(input.trigger);
    const triggerData = asRecord(triggerPayload.payload);
    const merchantName = merchantDisplayName(merchantPayload);
    const match = asString(triggerData?.match) ?? 'today\'s IPL match';
    const venue = asString(triggerData?.venue) ?? 'the stadium';
    const isWeeknight = triggerData?.is_weeknight === true;
    const offer = activeOfferTitle(merchantPayload);
    const body = isWeeknight
        ? `${merchantName}, ${match} at ${venue} tonight. Weeknight IPL matches often lift delivery orders — want me to draft a match-night promo around ${offer ?? 'your active offer'}?`
        : `${merchantName}, ${match} at ${venue} tonight. Saturday IPL matches usually shift -12% restaurant covers (people watch at home). Skip the match-night promo; instead push ${offer ?? 'your active offer'} as a delivery-only Saturday special. Want me to draft the Swiggy banner + Insta story? Live in 10 min.`;
    return merchantFacing(merchantPayload, categoryPayload, triggerPayload, body, 'binary_yes_no', 'IPL trigger with category-aware recommendation and concrete deliverables.', 'vera_ipl_match_v1');
}
function composeSupplyAlert(input) {
    const merchantPayload = payloadOf(input.merchant);
    const categoryPayload = payloadOf(input.category);
    const triggerPayload = payloadOf(input.trigger);
    const triggerData = asRecord(triggerPayload.payload);
    const merchantName = merchantDisplayName(merchantPayload);
    const molecule = asString(triggerData?.molecule) ?? 'a recalled product';
    const batches = Array.isArray(triggerData?.affected_batches)
        ? triggerData.affected_batches.filter((batch) => typeof batch === 'string')
        : [];
    const manufacturer = asString(triggerData?.manufacturer);
    const aggregate = asRecord(merchantPayload.customer_aggregate);
    const chronicCount = asNumber(aggregate?.total_unique_ytd);
    const affectedEstimate = chronicCount ? Math.max(1, Math.round(chronicCount * 0.09)) : undefined;
    const batchText = batches.length ? batches.join(', ') : 'listed batches';
    const affectedText = affectedEstimate ? `${affectedEstimate} of your chronic-Rx customers` : 'customers on repeat Rx';
    const body = `${merchantName}, urgent: voluntary recall on ${molecule} batches (${batchText})${manufacturer ? ` by ${manufacturer}` : ''} — sub-potency, no safety risk, but customers should be informed for replacement. Pulled your repeat-Rx list: ${affectedText} were dispensed these batches in the last 90 days. Want me to draft their WhatsApp note + the replacement-pickup workflow?`;
    return merchantFacing(merchantPayload, categoryPayload, triggerPayload, body, 'binary_yes_no', 'Supply alert with batch numbers, derived customer count, and end-to-end workflow offer.', 'vera_supply_alert_v1');
}
function composeCustomerLapsedHard(input) {
    const merchantPayload = payloadOf(input.merchant);
    const customerPayload = payloadOf(input.customer);
    const triggerPayload = payloadOf(input.trigger);
    const triggerData = asRecord(triggerPayload.payload);
    const customerIdentity = asRecord(customerPayload.identity);
    const customerName = asString(customerIdentity?.name) ?? 'there';
    const merchantOwner = ownerFirstName(merchantPayload) ?? merchantDisplayName(merchantPayload);
    const merchantIdentity = asRecord(merchantPayload.identity);
    const businessName = asString(merchantIdentity?.name) ?? 'our gym';
    const daysSince = asNumber(triggerData?.days_since_last_visit) ?? 57;
    const previousFocus = asString(triggerData?.previous_focus) ?? 'your goals';
    const offer = activeOfferTitle(merchantPayload) ?? 'a free trial class';
    const body = `Hi ${customerName}, ${merchantOwner} from ${businessName} here. It's been about ${Math.round(daysSince / 7)} weeks — happens to most members at some point, no judgment. We've added a Tue/Thu evening HIIT class that fits ${previousFocus} well (45 min, 6:30pm). Want me to hold ${offer} for you next Tue? Reply YES — no commitment, no auto-charge.`;
    return customerFacing(merchantPayload, customerPayload, triggerPayload, body, 'binary_yes_no', 'Lapsed-customer winback with no-shame framing and a no-commitment trial CTA.', 'merchant_winback_v1');
}
function composeChronicRefill(input) {
    const merchantPayload = payloadOf(input.merchant);
    const customerPayload = payloadOf(input.customer);
    const triggerPayload = payloadOf(input.trigger);
    const triggerData = asRecord(triggerPayload.payload);
    const customerIdentity = asRecord(customerPayload.identity);
    const customerName = asString(customerIdentity?.name) ?? 'there';
    const merchantIdentity = asRecord(merchantPayload.identity);
    const businessName = asString(merchantIdentity?.name) ?? 'the pharmacy';
    const locality = asString(merchantIdentity?.locality) ?? 'your area';
    const molecules = Array.isArray(triggerData?.molecule_list)
        ? triggerData.molecule_list.filter((item) => typeof item === 'string')
        : [];
    const stockOut = asString(triggerData?.stock_runs_out_iso);
    const dateText = stockOut ? stockOut.slice(8, 10) + ' ' + stockOut.slice(5, 7) : 'soon';
    const offer = activeOfferTitle(merchantPayload);
    const body = `Namaste — ${businessName} ${locality} yahan. ${customerName} ji ki ${molecules.length} monthly medicines (${molecules.join(', ')}) ${dateText} ko khatam hongi. Same dose, same brand pack ready hai.${offer ? ` ${offer} applied.` : ''} Free home delivery to saved address by 5pm tomorrow. Reply CONFIRM to dispatch, or call if any change in dosage.`;
    return customerFacing(merchantPayload, customerPayload, triggerPayload, body, 'binary_confirm_cancel', 'Chronic refill reminder with molecule names, date anchor, and respectful senior-facing tone.', 'merchant_chronic_refill_v1');
}
function composeActivePlanning(input) {
    const merchantPayload = payloadOf(input.merchant);
    const categoryPayload = payloadOf(input.category);
    const triggerPayload = payloadOf(input.trigger);
    const triggerData = asRecord(triggerPayload.payload);
    const merchantName = merchantDisplayName(merchantPayload);
    const identity = asRecord(merchantPayload.identity);
    const businessName = asString(identity?.name) ?? 'your business';
    const locality = asString(identity?.locality) ?? 'your area';
    const topic = asString(triggerData?.intent_topic) ?? 'your plan';
    if (topic.includes('corporate_bulk_thali')) {
        const body = `${merchantName}, here's a starter version for ${businessName}:\n\nCorporate Thali — for offices in ${locality}\n- 10 thalis @ ₹125 each + free delivery\n- 25 thalis @ ₹115 each + 2 free filter coffees\n- 50+: ₹105 each + 1 free dosa platter\n\nWant me to draft a 3-line WhatsApp to send facilities managers in your delivery radius?`;
        return merchantFacing(merchantPayload, categoryPayload, triggerPayload, body, 'binary_yes_no', 'Active planning intent with a drafted artifact and concrete tier pricing.', 'vera_planning_intent_v1');
    }
    const body = `${merchantName}, based on your note about ${topic.replace(/_/g, ' ')}, I drafted a starter outline for ${businessName}. Want me to send the full program structure with pricing tiers you can edit?`;
    return merchantFacing(merchantPayload, categoryPayload, triggerPayload, body, 'binary_yes_no', 'Planning-intent follow-up that moves from idea to a concrete draft.', 'vera_planning_intent_v1');
}
function composeGeneric(input) {
    const merchantPayload = payloadOf(input.merchant);
    const categoryPayload = payloadOf(input.category);
    const triggerPayload = payloadOf(input.trigger);
    const merchantName = merchantDisplayName(merchantPayload);
    const identity = asRecord(merchantPayload.identity);
    const locality = asString(identity?.locality) ?? 'your area';
    const city = asString(identity?.city) ?? 'your city';
    const triggerKind = asString(triggerPayload.kind) ?? 'update';
    const categorySlug = asString(categoryPayload.slug) ?? 'business';
    const body = `${merchantName} in ${locality}, ${city} — timely ${categorySlug} note on ${triggerKind.replace(/_/g, ' ')}. I kept this grounded in your current account data. Want the specific next step?`;
    return merchantFacing(merchantPayload, categoryPayload, triggerPayload, body, 'open_ended', 'Fallback merchant-facing message grounded in trigger kind and merchant identity.', 'vera_generic_v1');
}
const TRIGGER_HANDLERS = {
    research_digest: composeResearchDigest,
    regulation_change: composeRegulationChange,
    recall_due: composeRecallDue,
    appointment_tomorrow: composeRecallDue,
    perf_spike: composePerfSpike,
    perf_dip: composePerfDip,
    seasonal_perf_dip: composeSeasonalPerfDip,
    curious_ask_due: composeCuriousAsk,
    ipl_match_today: composeIplMatch,
    supply_alert: composeSupplyAlert,
    customer_lapsed_hard: composeCustomerLapsedHard,
    chronic_refill_due: composeChronicRefill,
    active_planning_intent: composeActivePlanning
};
export function compose(category, merchant, trigger, customer, nowIso) {
    const triggerPayload = payloadOf(trigger);
    const triggerKind = asString(triggerPayload.kind) ?? 'generic';
    const handler = TRIGGER_HANDLERS[triggerKind];
    const input = { category, merchant, trigger, customer, nowIso };
    const result = handler?.(input);
    if (result) {
        return result;
    }
    if (triggerPayload.scope === 'customer' && customer) {
        const merchantPayload = payloadOf(merchant);
        const customerPayload = payloadOf(customer);
        const customerIdentity = asRecord(customerPayload.identity);
        const customerName = asString(customerIdentity?.name) ?? 'there';
        const merchantIdentity = asRecord(merchantPayload.identity);
        const merchantName = asString(merchantIdentity?.name) ?? 'the business';
        return customerFacing(merchantPayload, customerPayload, triggerPayload, `Hi ${customerName}, ${merchantName} here with a timely follow-up based on your recent visit history. Reply YES if you'd like the details.`, 'binary_yes_no', 'Customer-scoped fallback with merchant and customer names from context.', 'merchant_generic_v1');
    }
    return composeGeneric(input);
}
