import { env } from "../config/env.js";

export const REFRESH_COOKIE_NAME = "refreshToken";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: "/api/auth",
    maxAge: SEVEN_DAYS_MS,
  };
}

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
}

export function clearRefreshCookie(res) {
  const opts = getRefreshCookieOptions();
  delete opts.maxAge;
  res.clearCookie(REFRESH_COOKIE_NAME, opts);
}
