import {
  getEventDetail,
  listAuditLogs,
  listEvents,
  listRecords,
} from '../services/dashboardService.js';

export async function getEvents(req, res, next) {
  try {
    const result = await listEvents(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getEvent(req, res, next) {
  try {
    const event = await getEventDetail(req.params.id);
    return res.status(200).json({ event });
  } catch (err) {
    return next(err);
  }
}

export async function getRecords(req, res, next) {
  try {
    const result = await listRecords(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const result = await listAuditLogs(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

