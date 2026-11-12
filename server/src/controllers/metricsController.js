import { getMetricsSummary, getMetricsTimeSeries } from '../services/metricsService.js';

export async function summary(req, res, next) {
  try {
    const data = await getMetricsSummary(req.query);
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
}

export async function timeSeries(req, res, next) {
  try {
    const data = await getMetricsTimeSeries(req.query);
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
}
