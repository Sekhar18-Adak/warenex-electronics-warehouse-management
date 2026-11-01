import fs from "fs";
import path from "path";
import multer from "multer";
import db from "../config/db.js";
import { updateUserProfileImageById } from "../repositories/authRepository.js";

const PROFILE_UPLOAD_DIRECTORY = path.join(process.cwd(), "uploads", "profiles");
fs.mkdirSync(PROFILE_UPLOAD_DIRECTORY, { recursive: true });

const profileImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROFILE_UPLOAD_DIRECTORY),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeName}`);
  },
});

const profileImageFilter = (_req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
  const allowedExtensions = [".jpg", ".jpeg", ".png"];
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(extension)) {
    return cb(null, true);
  }

  return cb(new Error("Only JPG, JPEG, and PNG profile images are allowed."));
};

export const uploadProfileImage = multer({
  storage: profileImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: profileImageFilter,
});

const normalizeProfileImagePath = (file) => {
  if (!file) return null;
  const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, "/");
  return `/${relativePath}`;
};

const validTaskPriorities = new Set(["Low", "Medium", "High", "Urgent"]);

export const generateTaskCode = () => {
  const today = new Date();
  const dateStamp = today.toISOString().slice(0, 10).replace(/-/g, "");
  const sequence = String(Math.floor(Math.random() * 9000) + 1000);
  return `TASK-${dateStamp}-${sequence}`;
};

export const normalizeTaskPriority = (priority) => {
  const normalized = String(priority || "").trim();
  if (!normalized) return "Medium";

  const exact = validTaskPriorities.has(normalized)
    ? normalized
    : [...validTaskPriorities].find((option) => option.toLowerCase() === normalized.toLowerCase());

  return exact || "Medium";
};

export const reactivateEmployeeStatus = (status = "") => {
  const normalizedStatus = String(status || "").trim();

  if (normalizedStatus === "Inactive") {
    return "Active";
  }

  return normalizedStatus || "Active";
};

export const validateTaskAssignmentInput = ({ assignedTo, title, description, priority, dueDate }) => {
  const errors = [];
  const parsedEmployeeId = Number.parseInt(assignedTo, 10);
  const sanitizedTitle = String(title || "").trim();
  const sanitizedDescription = String(description || "").trim();
  const sanitizedDueDate = String(dueDate || "").trim();
  const normalizedPriority = normalizeTaskPriority(priority);

  if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId <= 0) {
    errors.push("Employee ID is required.");
  }

  if (!sanitizedTitle) {
    errors.push("Task title is required.");
  }

  if (!sanitizedDescription) {
    errors.push("Task description is required.");
  }

  if (!sanitizedDueDate) {
    errors.push("Due date is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      assignedTo: parsedEmployeeId,
      title: sanitizedTitle,
      description: sanitizedDescription,
      priority: normalizedPriority,
      dueDate: sanitizedDueDate,
    },
  };
};

const ensureUniqueTaskCode = async (connection) => {
  let taskCode = generateTaskCode();
  let attempt = 0;

  while (attempt < 10) {
    const [rows] = await connection.execute("SELECT id FROM tasks WHERE task_code = ? LIMIT 1", [taskCode]);
    if (!rows.length) {
      return taskCode;
    }

    taskCode = generateTaskCode();
    attempt += 1;
  }

  return `TASK-${Date.now().toString().slice(-8)}`;
};

export const renderManagerTaskAssignments = async (req, res) => {
  const successMessage = req.query.success === "1" ? "Task assigned successfully." : null;
  const errorMessage = req.query.error === "1" ? "Unable to assign the task. Please verify the employee and form details." : null;

  try {
    const [rows] = await db.execute(
      `SELECT id, name, role, status
       FROM users
       WHERE role = 'Employee' AND status = 'Inactive'
       ORDER BY name ASC`
    );

    return res.render("dashboard/manager-tasks", {
      pageTitle: "Assign Tasks",
      user: req.user,
      inactiveEmployees: rows || [],
      inactiveEmployeeCount: (rows || []).length,
      successMessage,
      errorMessage,
    });
  } catch (error) {
    console.error("Render manager task assignments error:", error);
    return res.render("dashboard/manager-tasks", {
      pageTitle: "Assign Tasks",
      user: req.user,
      inactiveEmployees: [],
      inactiveEmployeeCount: 0,
      successMessage: null,
      errorMessage: "Unable to load inactive employees right now.",
    });
  }
};

export const assignEmployeeTask = async (req, res) => {
  const managerId = req.user?.id ?? req.user?.userId ?? null;
  const appointment = {
    assignedTo: req.body.assigned_to,
    title: req.body.title,
    description: req.body.description,
    priority: req.body.priority,
    dueDate: req.body.due_date,
  };

  const validation = validateTaskAssignmentInput(appointment);

  if (!managerId || !validation.valid) {
    return res.redirect(303, "/manager/tasks?error=1");
  }

  try {
    const [employeeRows] = await db.execute(
      `SELECT id, role, status
       FROM users
       WHERE id = ? AND role = 'Employee' AND status = 'Inactive'
       LIMIT 1`,
      [validation.sanitized.assignedTo]
    );

    if (!employeeRows.length) {
      return res.redirect(303, "/manager/tasks?error=1");
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const reactivatedStatus = reactivateEmployeeStatus(employeeRows[0].status);
      await connection.execute(
        `UPDATE users
         SET status = ?
         WHERE id = ? AND role = 'Employee' AND status = 'Inactive'`,
        [reactivatedStatus, validation.sanitized.assignedTo]
      );

      const taskCode = await ensureUniqueTaskCode(connection);
      const startDate = new Date().toISOString().slice(0, 10);
      const additionalNotes = String(req.body.additional_notes || "").trim();

      await connection.execute(
        `INSERT INTO tasks (task_code, title, description, assigned_by, assigned_to, priority, status, start_date, due_date, additional_notes)
         VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)`,
        [
          taskCode,
          validation.sanitized.title,
          validation.sanitized.description,
          managerId,
          validation.sanitized.assignedTo,
          validation.sanitized.priority,
          startDate,
          validation.sanitized.dueDate,
          additionalNotes || null,
        ]
      );

      await connection.commit();
      return res.redirect(303, "/manager/tasks?success=1");
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Assign employee task error:", error);
    return res.redirect(303, "/manager/tasks?error=1");
  }
};

export const renderManagerProfile = async (req, res) => {
  const announcements = Array.isArray(res.locals.announcements) ? res.locals.announcements : [];

  return res.render("dashboard/manager-profile", {
    pageTitle: "Manager Profile",
    user: req.user,
    announcements,
    announcementCount: announcements.length,
    successMessage: req.query.success === "1" ? "Profile image updated successfully." : null,
    errorMessage: req.query.error === "1" ? "Please upload a valid JPG, JPEG, or PNG image before saving." : null,
  });
};

export const updateManagerProfileImage = async (req, res) => {
  const userId = req.user?.id ?? req.user?.userId ?? null;
  const imageFile = req.file;

  if (!userId) {
    return res.redirect("/manager/profile");
  }

  if (!imageFile) {
    return res.redirect("/manager/profile?error=1");
  }

  try {
    const imagePath = normalizeProfileImagePath(imageFile);
    await updateUserProfileImageById(userId, imagePath);
    req.user = {
      ...req.user,
      profile_image: imagePath,
    };

    return res.redirect("/manager/profile?success=1");
  } catch (error) {
    console.error("Update manager profile image error:", error);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_cleanupError) {
        // ignore cleanup issues
      }
    }
    return res.redirect("/manager/profile?error=1");
  }
};

export const markManagerAnnouncementAsRead = async (req, res) => {
  const userId = req.user?.id ?? req.user?.userId ?? null;
  const announcementId = Number(req.params?.id);

  if (!userId || !announcementId) {
    return res.redirect("/manager/announcements");
  }

  try {
    await db.execute(
      `UPDATE notifications
       SET is_read = 1
       WHERE id = ? AND receiver_id = ?`,
      [announcementId, userId]
    );

    return res.redirect("/manager/announcements");
  } catch (error) {
    console.error("Mark manager announcement as read error:", error);
    return res.redirect("/manager/announcements");
  }
};

export const renderManagerAnnouncements = async (req, res) => {
  const userId = req.user?.id ?? req.user?.userId ?? null;

  try {
    const [rows] = await db.execute(
      `SELECT id, title, message, type, is_read, created_at
       FROM notifications
       WHERE receiver_id = ?
         AND is_read = 0
         AND (LOWER(type) = LOWER(?) OR LOWER(type) = LOWER(?))
       ORDER BY created_at DESC`,
      [userId, "Manager", "Manager"]
    );

    return res.render("dashboard/manager-announcements", {
      pageTitle: "Manager Announcements",
      user: req.user,
      announcements: rows || [],
    });
  } catch (error) {
    console.error("Render manager announcements error:", error);
    return res.render("dashboard/manager-announcements", {
      pageTitle: "Manager Announcements",
      user: req.user,
      announcements: [],
    });
  }
};

export const renderManagerAnnouncementDetails = async (req, res) => {
  const announcementId = Number(req.params?.id);
  const userId = req.user?.id ?? req.user?.userId ?? null;

  if (!announcementId || !userId) {
    return res.redirect("/manager/announcements");
  }

  try {
    const [rows] = await db.execute(
      `SELECT id, title, message, type, is_read, created_at
       FROM notifications
       WHERE id = ? AND receiver_id = ?
       LIMIT 1`,
      [announcementId, userId]
    );

    if (!rows.length) {
      return res.redirect("/manager/announcements");
    }

    return res.render("dashboard/manager-announcement-details", {
      pageTitle: "Announcement Details",
      user: req.user,
      announcement: rows[0],
    });
  } catch (error) {
    console.error("Render manager announcement details error:", error);
    return res.redirect("/manager/announcements");
  }
};

const getInventoryStatus = (currentStock = 0, minimumStock = 0) => {
  if (Number(currentStock) <= 0) {
    return "Out of Stock";
  }
  if (Number(currentStock) <= Number(minimumStock)) {
    return "Low Stock";
  }
  return "Available";
};

const getStatusClasses = (status) => {
  if (status === "Out of Stock") return "bg-danger-subtle text-danger";
  if (status === "Low Stock") return "bg-warning-subtle text-warning";
  return "bg-success-subtle text-success";
};

const buildDashboardSummary = (items = []) => {
  return items.reduce(
    (summary, item) => {
      summary.totalItems += 1;
      if (item.status === "Out of Stock") summary.outOfStockItems += 1;
      if (item.status === "Low Stock") summary.lowStockItems += 1;
      return summary;
    },
    { totalItems: 0, outOfStockItems: 0, lowStockItems: 0 }
  );
};

export const renderManagerDashboard = async (req, res) => {
  if (req.query && req.query.view === "all") {
    return res.redirect(303, "/manager/tasks");
  }

  const view = String(req.query.view || "all").toLowerCase();
  const activeView = ["all", "outofstock", "lowstock"].includes(view) ? view : "all";
  let inventoryItems = [];
  let summary = { totalItems: 0, outOfStockItems: 0, lowStockItems: 0 };
  const filterLabel =
    activeView === "outofstock"
      ? "Out of Stock Items"
      : activeView === "lowstock"
      ? "Low Stock Items"
      : "All Products";

  let inactiveEmployeeCount = 0;

  try {
    const [rows] = await db.execute(
      "SELECT id, name, current_stock, minimum_stock FROM products WHERE status = 'Active' ORDER BY name"
    );

    const mappedItems = rows.map((product) => {
      const status = getInventoryStatus(product.current_stock, product.minimum_stock);
      return {
        id: product.id,
        name: product.name,
        currentStock: Number(product.current_stock),
        minimumStock: Number(product.minimum_stock),
        status,
        statusClass: getStatusClasses(status),
      };
    });

    summary = buildDashboardSummary(mappedItems);

    inventoryItems = mappedItems.filter((item) => {
      if (activeView === "outofstock") return item.status === "Out of Stock";
      if (activeView === "lowstock") return item.status === "Low Stock";
      return true;
    });

    const [inactiveEmployees] = await db.execute(
      "SELECT COUNT(*) AS inactiveEmployeeCount FROM users WHERE role = 'Employee' AND status = 'Inactive'"
    );
    inactiveEmployeeCount = Number(inactiveEmployees?.[0]?.inactiveEmployeeCount || 0);
  } catch (error) {
    console.error("Manager dashboard error:", error);
  }

  res.render("dashboard/manager-dashboard", {
    pageTitle: "Manager Dashboard",
    user: req.user,
    activeView,
    filterLabel,
    summary,
    inventoryItems,
    inactiveEmployeeCount,
  });
};

export const renderManagerProducts = async (req, res) => {
  const view = String(req.query.view || "all").toLowerCase();
  const activeView = ["all", "lowstock", "outofstock"].includes(view) ? view : "all";
  const page = Number.parseInt(req.query.page, 10) || 1;
  const pageSize = 5;
  let products = [];
  let pageProducts = [];
  let summary = { totalItems: 0, lowStockItems: 0, outOfStockItems: 0 };
  let filterLabel = "All Products";
  let totalPages = 1;
  let currentPage = 1;

  try {
    const [rows] = await db.execute(
      "SELECT id, product_code, name, purchase_price, selling_price, current_stock, minimum_stock, status FROM products ORDER BY name"
    );

    const mapped = rows.map((p) => {
      const status = getInventoryStatus(p.current_stock, p.minimum_stock);
      return {
        id: p.id,
        code: p.product_code,
        name: p.name,
        purchasePrice: Number(p.purchase_price) || 0,
        sellingPrice: Number(p.selling_price) || 0,
        status,
        statusClass: getStatusClasses(status),
      };
    });

    summary = mapped.reduce(
      (acc, item) => {
        acc.totalItems += 1;
        if (item.status === "Low Stock") acc.lowStockItems += 1;
        if (item.status === "Out of Stock") acc.outOfStockItems += 1;
        return acc;
      },
      { totalItems: 0, lowStockItems: 0, outOfStockItems: 0 }
    );

    products = mapped.filter((item) => {
      if (activeView === "lowstock") return item.status === "Low Stock";
      if (activeView === "outofstock") return item.status === "Out of Stock";
      return true;
    });

    totalPages = Math.max(1, Math.ceil(products.length / pageSize));
    currentPage = Math.min(Math.max(1, page), totalPages);
    const offset = (currentPage - 1) * pageSize;
    pageProducts = products.slice(offset, offset + pageSize);

    filterLabel =
      activeView === "lowstock"
        ? "Low Stock Products"
        : activeView === "outofstock"
        ? "Out of Stock Products"
        : "All Products";
  } catch (error) {
    console.error("Render manager products error:", error);
  }

  res.render("products/manager-products", {
    pageTitle: "Products",
    user: req.user,
    products: pageProducts,
    summary,
    activeView,
    filterLabel,
    currentPage,
    totalPages,
    view: activeView,
  });
};
