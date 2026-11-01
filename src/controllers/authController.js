import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  findAdminByEmail,
  findUserByEmail,
  revokeRefreshTokensByUserId,
  revokeRefreshTokenByToken,
  saveRefreshToken,
  createUser,
  deleteUserById,
} from "../repositories/authRepository.js";

const JWT_SECRET = process.env.JWT_TOKEN || process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7);
const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
const ACCESS_TOKEN_COOKIE_NAME = "accessToken";

if (!JWT_SECRET) {
  throw new Error("Missing JWT_TOKEN or JWT_SECRET in environment configuration.");
}

const createAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
};

const createRefreshToken = () => crypto.randomBytes(64).toString("hex");

export const getDashboardPathForRole = (role = "") => {
  const normalizedRole = String(role || "").trim();

  switch (normalizedRole) {
    case "Admin":
      return "/admin/dashboard";
    case "Manager":
      return "/manager/dashboard";
    case "Sales":
      return "/sales/dashboard";
    case "Employee":
      return "/employee/dashboard";
    default:
      return "/login";
  }
};

const getRefreshTokenExpiry = () => {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  return expiresAt;
};

const getCookiesFromRequest = (req) => {
  const cookieHeader = req.headers?.cookie;

  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (name) {
      cookies[name] = decodeURIComponent(valueParts.join("="));
    }

    return cookies;
  }, {});
};

const getUserIdFromRequest = (req) => {
  const cookies = req.cookies || getCookiesFromRequest(req);
  const accessToken = cookies[ACCESS_TOKEN_COOKIE_NAME];

  if (!accessToken) {
    return null;
  }

  try {
    const decodedToken = jwt.decode(accessToken);

    if (decodedToken && typeof decodedToken === "object" && decodedToken.id) {
      return decodedToken.id;
    }
  } catch (error) {
    console.error("Unable to decode access token for logout:", error);
  }

  return null;
};

export const renderEmployeeLoginPage = (req, res) => {
  res.render("auth/login", {
    pageTitle: "Employee Login",
    authError: null,
    email: "",
  });
};

export const renderAdminLoginPage = (req, res) => {
  res.render("auth/admin-login", {
    pageTitle: "Admin Login",
    authError: null,
    email: "",
  });
};

export const loginEmployee = async (req, res) => {
  const { email = "", password = "" } = req.body;

  if (!email || !password) {
    return res.status(400).render("auth/login", {
      pageTitle: "Employee Login",
      authError: "Email address and password are required.",
      email,
    });
  }

  try {
    const user = await findUserByEmail(email.trim().toLowerCase());
    const normalizedRole = String(user?.role || "").trim();

    if (!user) {
      return res.status(401).render("auth/login", {
        pageTitle: "Employee Login",
        authError: "Invalid email or password.",
        email,
      });
    }

    if (!user.password) {
      return res.status(500).render("auth/login", {
        pageTitle: "Employee Login",
        authError: "Account credentials are not available yet. Please contact your administrator.",
        email,
      });
    }

    if (normalizedRole === "Admin") {
      return res.status(403).render("auth/login", {
        pageTitle: "Employee Login",
        authError: "Please use the admin login page.",
        email,
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password) || password === user.password;

    if (!isPasswordValid) {
      return res.status(401).render("auth/login", {
        pageTitle: "Employee Login",
        authError: "Invalid email or password.",
        email,
      });
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken();
    const expiresAt = getRefreshTokenExpiry();

    await revokeRefreshTokensByUserId(user.id);
    await saveRefreshToken(user.id, refreshToken, expiresAt);

    res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    });

    return res.redirect(303, getDashboardPathForRole(normalizedRole));
  } catch (error) {
    console.error("Employee login error:", error);
    return res.status(500).render("auth/login", {
      pageTitle: "Employee Login",
      authError: "Unable to complete login right now. Please try again later.",
      email,
    });
  }
};

export const loginAdmin = async (req, res) => {
  const { email = "", password = "" } = req.body;

  if (!email || !password) {
    return res.status(400).render("auth/admin-login", {
      pageTitle: "Admin Login",
      authError: "Email address and password are required.",
      email,
    });
  }

  try {
    const admin = await findAdminByEmail(email);

    if (!admin || admin.status !== "Active") {
      return res.status(401).render("auth/admin-login", {
        pageTitle: "Admin Login",
        authError: "Invalid admin email or password.",
        email,
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password) || password === admin.password;

    if (!isPasswordValid) {
      return res.status(401).render("auth/admin-login", {
        pageTitle: "Admin Login",
        authError: "Invalid admin email or password.",
        email,
      });
    }

    const accessToken = createAccessToken(admin);
    const refreshToken = createRefreshToken();
    const expiresAt = getRefreshTokenExpiry();

    await revokeRefreshTokensByUserId(admin.id);
    await saveRefreshToken(admin.id, refreshToken, expiresAt);

    res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    });

    return res.redirect(303, "/admin/dashboard");
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).render("auth/admin-login", {
      pageTitle: "Admin Login",
      authError: "Unable to complete login right now. Please try again later.",
      email,
    });
  }
};

export const logoutUser = async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

  if (refreshToken) {
    try {
      await revokeRefreshTokenByToken(refreshToken);
    } catch (error) {
      console.error("Unable to revoke refresh token on logout:", error);
    }
  }

  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });

  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });

  return res.redirect(303, "/login");
};

export const logoutAdmin = async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

  if (refreshToken) {
    try {
      await revokeRefreshTokenByToken(refreshToken);
    } catch (error) {
      console.error("Unable to revoke admin refresh token on logout:", error);
    }
  }

  res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });

  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });

  return res.redirect(303, "/admin");
};

export const createEmployeeAccount = async (req, res) => {
  const { name = "", email = "", password = "", role = "Sales", status = "Active" } = req.body;
  const normalizedRole = String(role).trim();
  const normalizedStatus = String(status).trim() === "Inactive" ? "Inactive" : "Active";
  const allowedRoles = ["Manager", "Sales", "Employee"];

  if (!name.trim() || !email.trim() || !password.trim()) {
    return res.status(400).redirect("/admin/dashboard");
  }

  if (!allowedRoles.includes(normalizedRole)) {
    return res.status(400).redirect("/admin/dashboard");
  }

  try {
    const existingUser = await findUserByEmail(email.trim().toLowerCase());

    if (existingUser) {
      return res.status(409).redirect("/admin/dashboard");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await createUser(
      name.trim(),
      email.trim().toLowerCase(),
      hashedPassword,
      normalizedRole,
      normalizedStatus
    );

    return res.redirect(303, "/admin/dashboard?success=1");
  } catch (error) {
    console.error("Create employee account error:", error);
    return res.status(500).redirect("/admin/dashboard");
  }
};


