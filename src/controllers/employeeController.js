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

export const buildEmployeeTaskSummary = (tasks = []) => {
  const normalizedTasks = Array.isArray(tasks) ? tasks : [];

  const totalTasks = normalizedTasks.length;
  const completedTasks = normalizedTasks.filter((task) => task?.status === "Completed").length;
  const inProgressTasks = normalizedTasks.filter((task) => task?.status === "In Progress").length;
  const remainingTasks = totalTasks - completedTasks;
  const highPriorityTasks = normalizedTasks.filter((task) => ["High", "Urgent"].includes(task?.priority)).length;
  const mediumPriorityTasks = normalizedTasks.filter((task) => task?.priority === "Medium").length;
  const lowPriorityTasks = normalizedTasks.filter((task) => task?.priority === "Low").length;

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    remainingTasks,
    highPriorityTasks,
    mediumPriorityTasks,
    lowPriorityTasks,
  };
};

export const renderEmployeeDashboard = async (req, res) => {
  const employeeId = req.user?.id ?? req.user?.userId ?? null;

  try {
    const [rows] = employeeId
      ? await db.execute(
          `SELECT priority, status
           FROM tasks
           WHERE assigned_to = ?`,
          [employeeId]
        )
      : [[], []];

    return res.render("dashboard/employee-dashboard", {
      pageTitle: "Employee Dashboard",
      user: req.user,
      summary: buildEmployeeTaskSummary(rows || []),
    });
  } catch (error) {
    console.error("Render employee dashboard error:", error);
    return res.render("dashboard/employee-dashboard", {
      pageTitle: "Employee Dashboard",
      user: req.user,
      summary: buildEmployeeTaskSummary([]),
    });
  }
};

export const renderEmployeeTasks = async (req, res) => {
  const employeeId = req.user?.id ?? req.user?.userId ?? null;

  try {
    const [rows] = employeeId
      ? await db.execute(
          `SELECT t.id, t.task_code, t.title, t.description, t.priority, t.status,
                  t.start_date, t.due_date, t.additional_notes, t.created_at,
                  assigned_by_user.name AS assigned_by_name,
                  assigned_to_user.name AS assigned_to_name
           FROM tasks t
           LEFT JOIN users assigned_by_user ON assigned_by_user.id = t.assigned_by
           LEFT JOIN users assigned_to_user ON assigned_to_user.id = t.assigned_to
           WHERE t.assigned_to = ?
           ORDER BY t.due_date ASC, t.created_at DESC`,
          [employeeId]
        )
      : [[], []];

    return res.render("dashboard/employee-tasks", {
      pageTitle: "Assigned Tasks",
      user: req.user,
      tasks: rows || [],
      successMessage: req.query.success === "1" ? "Task status updated successfully." : null,
      errorMessage: req.query.error === "1" ? "Unable to update the task status." : null,
    });
  } catch (error) {
    console.error("Render employee tasks error:", error);
    return res.render("dashboard/employee-tasks", {
      pageTitle: "Assigned Tasks",
      user: req.user,
      tasks: [],
      successMessage: null,
      errorMessage: null,
    });
  }
};

export const updateEmployeeTaskStatus = async (req, res) => {
  const employeeId = req.user?.id ?? req.user?.userId ?? null;
  const taskId = Number(req.params.id);
  const status = String(req.body.status || "").trim();
  const validStatuses = ["Pending", "In Progress", "Completed", "Cancelled"];

  if (!employeeId || !taskId || !validStatuses.includes(status)) {
    return res.redirect("/employee/tasks?error=1");
  }

  try {
    const [result] = await db.execute(
      `UPDATE tasks
       SET status = ?
       WHERE id = ? AND assigned_to = ?`,
      [status, taskId, employeeId]
    );

    if (!result || result.affectedRows === 0) {
      return res.redirect("/employee/tasks?error=1");
    }

    return res.redirect("/employee/tasks?success=1");
  } catch (error) {
    console.error("Update employee task status error:", error);
    return res.redirect("/employee/tasks?error=1");
  }
};

export const renderEmployeeInventory = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, product_code, name, category, brand, model, current_stock, minimum_stock,
              purchase_price, selling_price, status, created_at
       FROM products
       ORDER BY name ASC`
    );

    const products = (rows || []).map((product) => ({
      ...product,
      currentStock: Number(product.current_stock) || 0,
      minimumStock: Number(product.minimum_stock) || 0,
      purchasePrice: Number(product.purchase_price) || 0,
      sellingPrice: Number(product.selling_price) || 0,
      status: product.status || "Active",
    }));

    const pageSize = 5;
    const currentPage = Number.parseInt(req.query.page, 10) || 1;
    const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const offset = (safePage - 1) * pageSize;
    const paginatedProducts = products.slice(offset, offset + pageSize);

    return res.render("inventory/employee-inventory", {
      pageTitle: "Employee Inventory",
      user: req.user,
      products: paginatedProducts,
      currentPage: safePage,
      totalPages,
      summary: {
        totalItems: products.length,
        lowStockItems: products.filter((product) => product.currentStock <= product.minimumStock).length,
        outOfStockItems: products.filter((product) => product.currentStock <= 0).length,
      },
    });
  } catch (error) {
    console.error("Render employee inventory error:", error);
    return res.render("inventory/employee-inventory", {
      pageTitle: "Employee Inventory",
      user: req.user,
      products: [],
      currentPage: 1,
      totalPages: 1,
      summary: { totalItems: 0, lowStockItems: 0, outOfStockItems: 0 },
    });
  }
};

export const renderEmployeeProfile = async (req, res) => {
  const announcements = Array.isArray(res.locals.announcements) ? res.locals.announcements : [];

  return res.render("dashboard/employee-profile", {
    pageTitle: "Employee Profile",
    user: req.user,
    announcements,
    announcementCount: announcements.length,
    successMessage: req.query.success === "1" ? "Profile image updated successfully." : null,
    errorMessage: req.query.error === "1" ? "Please upload a valid JPG, JPEG, or PNG image before saving." : null,
  });
};

export const updateEmployeeProfileImage = async (req, res) => {
  const userId = req.user?.id ?? req.user?.userId ?? null;
  const imageFile = req.file;

  if (!userId) {
    return res.redirect("/employee/profile");
  }

  if (!imageFile) {
    return res.redirect("/employee/profile?error=1");
  }

  try {
    const imagePath = normalizeProfileImagePath(imageFile);
    await updateUserProfileImageById(userId, imagePath);
    req.user = {
      ...req.user,
      profile_image: imagePath,
    };

    return res.redirect("/employee/profile?success=1");
  } catch (error) {
    console.error("Update employee profile image error:", error);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_cleanupError) {
        // ignore cleanup issues
      }
    }
    return res.redirect("/employee/profile?error=1");
  }
};