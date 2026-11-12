import {
  createSource,
  getSourceById,
  listSources,
  rotateSourceSecret,
  updateSource,
} from '../services/sourceService.js';

export async function list(req, res, next) {
  try {
    const result = await listSources(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const source = await getSourceById(req.params.id);
    return res.status(200).json({ source: source.toJSON() });
  } catch (err) {
    return next(err);
  }
}

export async function create(req, res, next) {
  try {
    const result = await createSource(req.body, { actor: req.user, req });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function update(req, res, next) {
  try {
    const source = await updateSource(req.params.id, req.body, {
      actor: req.user,
      req,
    });
    return res.status(200).json({ source });
  } catch (err) {
    return next(err);
  }
}

export async function rotateSecret(req, res, next) {
  try {
    const result = await rotateSourceSecret(req.params.id, {
      actor: req.user,
      req,
    });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

