import {
  issueRefreshToken,
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
  signAccessToken,
} from "../services/authService.js";
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  setRefreshCookie,
} from "../utils/cookies.js";

export async function register(req, res, next) {
  try {
    const user = await registerUser(req.body, {
      actor: req.user || null,
      isBootstrap: Boolean(req.isBootstrapRegistration),
      req,
    });

    if (req.isBootstrapRegistration) {
      const accessToken = signAccessToken(user);
      const refreshToken = await issueRefreshToken(user);
      setRefreshCookie(res, refreshToken);
      return res.status(201).json({ user: user.toJSON(), accessToken });
    }

    return res.status(201).json({ user: user.toJSON() });
  } catch (err) {
    return next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await loginUser(req.body, {
      req,
    });
    setRefreshCookie(res, refreshToken);
    return res.status(200).json({ user, accessToken });
  } catch (err) {
    return next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    const { user, accessToken, refreshToken } = await refreshSession(token);
    setRefreshCookie(res, refreshToken);
    return res.status(200).json({ user, accessToken });
  } catch (err) {
    clearRefreshCookie(res);
    return next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    await logoutSession(token, { actor: req.user || null, req });
    clearRefreshCookie(res);
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function me(req, res) {
  return res.status(200).json({ user: req.user.toJSON() });
}
