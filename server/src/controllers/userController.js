import { getUserById, listUsers, updateUser } from '../services/userService.js';

export async function list(req, res, next) {
  try {
    const result = await listUsers(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const user = await getUserById(req.params.id);
    return res.status(200).json({ user: user.toJSON() });
  } catch (err) {
    return next(err);
  }
}

export async function update(req, res, next) {
  try {
    const user = await updateUser(req.params.id, req.body, {
      actor: req.user,
      req,
    });
    return res.status(200).json({ user: user.toJSON() });
  } catch (err) {
    return next(err);
  }
}

