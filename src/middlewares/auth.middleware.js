import jwt from "jsonwebtoken";
import { getUserById } from "../repositories/authRepository.js";
import db from "../config/db.js";

const JWT_SECRET = process.env.JWT_TOKEN || process.env.JWT_SECRET;
const ACCESS_TOKEN_COOKIE_NAME = "accessToken";
const LOGIN_REDIRECT = "/admin";

const getLoginRedirectPath = (req) => {
  const pathname = req?.originalUrl || "";
  return pathname.startsWith("/admin") ? "/admin" : "/login";
};

if (!JWT_SECRET) {
  throw new Error("Missing JWT_TOKEN or JWT_SECRET in environment configuration.");
}

const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });
};

const redirectToLogin = (req, res) => res.redirect(getLoginRedirectPath(req));

export const loadUserAnnouncements = async (req, res, next) => {
  const userId = req.user?.id ?? req.user?.userId ?? null;
  const roleType = String(req.user?.role || "").trim();

  if (!userId) {
    res.locals.announcements = [];
    return next();
  }

  try {
    const [rows] = await db.execute(
      `SELECT id, title, message, type, is_read, created_at
       FROM notifications
       WHERE receiver_id = ?
         AND is_read = 0
         AND (LOWER(type) = LOWER(?) OR LOWER(type) = LOWER(?))
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId, roleType || "Manager", "Manager"]
    );

    res.locals.announcements = rows || [];
  } catch (error) {
    console.error("Load user announcements error:", error);
    res.locals.announcements = [];
  }

  return next();
};

export const verifyAuth = async (req, res, next) => {
  const accessToken = req.cookies?.[ACCESS_TOKEN_COOKIE_NAME];

  if (!accessToken) {
    return redirectToLogin(req, res);
  }

  try {
    const decoded = jwt.verify(accessToken, JWT_SECRET);

    if (!decoded || typeof decoded !== "object") {
      clearAuthCookies(res);
      return redirectToLogin(req, res);
    }

    // Populate user details from DB when possible so views can show name/role
    const basicUser = {
      userId: decoded.id,
      role: decoded.role,
      email: decoded.email,
    };

    try {
      const userDetails = await getUserById(basicUser.userId);

      req.user = {
        id: userDetails?.id ?? basicUser.userId,
        userId: basicUser.userId,
        name: userDetails?.name ?? null,
        role: userDetails?.role ?? basicUser.role,
        email: basicUser.email,
        status: userDetails?.status ?? "Active",
        profile_image: userDetails?.profile_image ?? null,
      };
    } catch (err) {
      // If DB lookup fails, fall back to token-provided values
      req.user = {
        id: basicUser.userId,
        userId: basicUser.userId,
        name: null,
        role: basicUser.role,
        email: basicUser.email,
        status: "Active",
        profile_image: null,
      };
    }

    return next();
  } catch (error) {
    console.error("verifyAuth error:", error.message);
    clearAuthCookies(res);
    return redirectToLogin(req, res);
  }
};
