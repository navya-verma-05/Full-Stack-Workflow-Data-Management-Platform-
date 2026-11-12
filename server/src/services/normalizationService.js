import { PAYLOAD_SCHEMAS_BY_TYPE } from '../validators/webhookValidators.js';

export function validateWebhookPayload(schemaType, payload) {
  const schema = PAYLOAD_SCHEMAS_BY_TYPE[schemaType] || PAYLOAD_SCHEMAS_BY_TYPE.generic;
  const parsed = schema.safeParse(payload);
  if (parsed.success) {
    return { valid: true, data: parsed.data, errors: [] };
  }

  const errors = parsed.error.issues.slice(0, 25).map((issue) => ({
    field: issue.path.join('.').slice(0, 120) || 'payload',
    message: String(issue.message).slice(0, 500),
    code: String(issue.code || 'VALIDATION_ERROR').slice(0, 64),
  }));

  return { valid: false, data: null, errors };
}

export function normalizePayloadToRecord(schemaType, payload, sourceId, eventId) {
  switch (schemaType) {
    case 'web_form':
      return {
        sourceId,
        eventId,
        externalId: payload.submissionId,
        clientName: payload.fullName,
        clientEmail: payload.email,
        company: payload.company || '',
        phone: payload.phone || '',
        category: payload.topic || 'web_inquiry',
        amount: 0,
        currency: 'USD',
        metadata: {
          notes: payload.notes || '',
          tags: payload.tags || [],
        },
        normalizedAt: new Date(),
      };

    case 'crm':
      return {
        sourceId,
        eventId,
        externalId: payload.contactId,
        clientName: payload.name,
        clientEmail: payload.email,
        company: payload.accountName || '',
        phone: '',
        category: payload.stage || 'crm_deal',
        amount: payload.dealValue ?? 0,
        currency: payload.currency || 'USD',
        metadata: {
          stage: payload.stage,
          tags: payload.tags || [],
        },
        normalizedAt: new Date(),
      };

    case 'partner': {
      const totalAmount = (payload.items || []).reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      return {
        sourceId,
        eventId,
        externalId: payload.partnerRef,
        clientName: payload.customer.name,
        clientEmail: payload.customer.email,
        company: payload.customer.organization || '',
        phone: '',
        category: 'partner_order',
        amount: Math.round(totalAmount * 100) / 100,
        currency: payload.currency || 'USD',
        metadata: {
          itemCount: payload.items?.length || 0,
          items: payload.items || [],
        },
        normalizedAt: new Date(),
      };
    }

    case 'generic':
    default:
      return {
        sourceId,
        eventId,
        externalId: payload.externalId || '',
        clientName: payload.clientName,
        clientEmail: payload.clientEmail || '',
        company: payload.company || '',
        phone: payload.phone || '',
        category: payload.category || 'general',
        amount: payload.amount ?? 0,
        currency: payload.currency || 'USD',
        metadata: {
          ...(payload.metadata || {}),
          ...(payload.tags ? { tags: payload.tags } : {}),
        },
        normalizedAt: new Date(),
      };
  }
}
