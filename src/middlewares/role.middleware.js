const LOGIN_REDIRECT = "/admin";

const getLoginRedirectPath = (req) => {
  const pathname = req?.originalUrl || "";
  return pathname.startsWith("/admin") ? "/admin" : "/login";
};

export const allowRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = String(req.user?.role || "").trim();
    const normalizedAllowed = allowedRoles.map((role) => String(role).trim().toLowerCase());

    if (!userRole || !normalizedAllowed.includes(userRole.toLowerCase())) {
      return res.redirect(getLoginRedirectPath(req));
    }

    return next();
  };
};
