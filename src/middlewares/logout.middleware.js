import { revokeRefreshTokenByToken } from "../repositories/authRepository.js";

const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

export const revokeRefreshToken = async (req, res, next) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

  if (!refreshToken) {
    return next();
  }

  try {
    await revokeRefreshTokenByToken(refreshToken);
  } catch (error) {
    console.error("Logout middleware error:", error.message);
  }

  return next();
};
