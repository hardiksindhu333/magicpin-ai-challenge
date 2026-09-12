import { ContextRecord } from '../types/index.js';

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function payloadOf(record: ContextRecord | undefined): Record<string, unknown> {
  return asRecord(record?.payload) ?? {};
}

export function findDigestItem(
  categoryPayload: Record<string, unknown>,
  itemId: string | undefined
): Record<string, unknown> | undefined {
  if (!itemId) {
    return undefined;
  }

  const digest = Array.isArray(categoryPayload.digest) ? categoryPayload.digest : [];
  for (const item of digest) {
    const record = asRecord(item);
    if (record && asString(record.id) === itemId) {
      return record;
    }
  }

  return undefined;
}

export function activeOfferTitle(merchantPayload: Record<string, unknown>): string | undefined {
  const offers = Array.isArray(merchantPayload.offers) ? merchantPayload.offers : [];
  for (const offer of offers) {
    const record = asRecord(offer);
    if (record && asString(record.status) === 'active') {
      return asString(record.title);
    }
  }

  return undefined;
}

export function ownerFirstName(merchantPayload: Record<string, unknown>): string | undefined {
  const identity = asRecord(merchantPayload.identity);
  return asString(identity?.owner_first_name) ?? asString(identity?.name)?.split(' ').pop();
}

export function merchantDisplayName(merchantPayload: Record<string, unknown>, fallback = 'there'): string {
  const identity = asRecord(merchantPayload.identity);
  const owner = asString(identity?.owner_first_name);
  if (owner) {
    return owner;
  }

  const name = asString(identity?.name);
  if (!name) {
    return fallback;
  }

  if (name.startsWith('Dr.')) {
    return name.replace(/^Dr\.\s*/, '').split(' ')[0] ?? name;
  }

  return name.split(' ')[0] ?? name;
}

export function formatPercent(value: number): string {
  const pct = Math.abs(value * 100);
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

export function monthsSince(isoDate: string, nowIso: string): number | undefined {
  const last = Date.parse(isoDate);
  const now = Date.parse(nowIso);
  if (Number.isNaN(last) || Number.isNaN(now)) {
    return undefined;
  }

  const diffMs = now - last;
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30)));
}

export function isExpired(expiresAt: string | undefined, nowIso: string): boolean {
  if (!expiresAt) {
    return false;
  }

  const expiry = Date.parse(expiresAt);
  const now = Date.parse(nowIso);
  if (Number.isNaN(expiry) || Number.isNaN(now)) {
    return false;
  }

  return now > expiry;
}
