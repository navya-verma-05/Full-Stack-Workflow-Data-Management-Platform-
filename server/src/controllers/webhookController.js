import { ingestWebhook, replayEvent } from '../services/webhookService.js';

export async function receive(req, res, next) {
  try {
    const result = await ingestWebhook({
      sourceId: req.params.sourceId,
      headers: req.headers,
      rawBody: req.rawBody,
      body: req.body,
    });

    if (result.duplicate) {
      return res.status(200).json({
        duplicate: true,
        eventId: result.event._id,
        status: result.event.status,
        message: 'Duplicate event acknowledged idempotently',
      });
    }

    if (result.invalid) {
      return res.status(422).json({
        error: {
          code: 'INVALID_WEBHOOK_PAYLOAD',
          message: 'Webhook payload failed schema validation',
          details: result.event.errors,
        },
        eventId: result.event._id,
        status: result.event.status,
      });
    }

    return res.status(202).json({
      duplicate: false,
      eventId: result.event._id,
      status: result.event.status,
    });
  } catch (err) {
    return next(err);
  }
}

export async function replay(req, res, next) {
  try {
    const event = await replayEvent(req.params.id, {
      actor: req.user,
      req,
    });
    return res.status(202).json({ event });
  } catch (err) {
    return next(err);
  }
}
