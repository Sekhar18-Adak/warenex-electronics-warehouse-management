import db from "../config/db.js";
import { listEmployeesForAdmin, updateEmployeeRoleAndStatusById, deleteUserById } from "../repositories/authRepository.js";

export const buildEmployeeStatusSummary = (employees = []) => {
  const employeeList = Array.isArray(employees) ? employees : [];
  const totalEmployees = employeeList.length;
  const activeEmployees = employeeList.filter((employee) => employee?.status === "Active").length;
  const inactiveEmployees = totalEmployees - activeEmployees;

  return {
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
  };
};

export const normalizeEmployeeRole = (role = "") => {
  const normalizedRole = String(role).trim().toLowerCase();
  const roleMap = {
    manager: "Manager",
    sales: "Sales",
    employee: "Employee",
  };

  return roleMap[normalizedRole] ?? null;
};

export const normalizeEmployeeStatus = (status = "") => {
  const normalizedStatus = String(status).trim().toLowerCase();
  return normalizedStatus === "inactive" ? "Inactive" : "Active";
};

export const normalizeAnnouncementTarget = (role = "") => {
  const normalizedRole = String(role).trim().toLowerCase();
  const roleMap = {
    manager: "Manager",
    sales: "Sales",
    employee: "Employee",
  };

  return roleMap[normalizedRole] ?? null;
};

export const deduplicateReceiverIds = (receiverRows = []) => {
  const uniqueIds = new Set();

  (Array.isArray(receiverRows) ? receiverRows : []).forEach((row) => {
    const id = Number(row?.id ?? 0);
    if (Number.isInteger(id) && id > 0) {
      uniqueIds.add(id);
    }
  });

  return [...uniqueIds];
};

export const renderAdminDashboard = async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT current_stock, minimum_stock FROM products"
    );

    const inventorySummary = (rows || []).reduce(
      (summary, product) => {
        const currentStock = Number(product?.current_stock ?? 0);
        const minimumStock = Number(product?.minimum_stock ?? 0);

        summary.totalProducts += 1;

        if (currentStock <= 0) {
          summary.outOfStockProducts += 1;
        } else if (currentStock <= minimumStock) {
          summary.lowStockProducts += 1;
        } else {
          summary.fullStockProducts += 1;
        }

        return summary;
      },
      {
        totalProducts: 0,
        outOfStockProducts: 0,
        lowStockProducts: 0,
        fullStockProducts: 0,
      }
    );

    return res.render("dashboard/admin-dashboard", {
      pageTitle: "Admin Dashboard",
      successMessage: req.query.success === "1" ? "Employee account created successfully." : null,
      inventorySummary,
    });
  } catch (error) {
    console.error("Render admin dashboard error:", error);

    return res.render("dashboard/admin-dashboard", {
      pageTitle: "Admin Dashboard",
      successMessage: req.query.success === "1" ? "Employee account created successfully." : null,
      inventorySummary: {
        totalProducts: 0,
        outOfStockProducts: 0,
        lowStockProducts: 0,
        fullStockProducts: 0,
      },
    });
  }
};

const getReportAttachmentLabel = (attachmentPath = "") => {
  const extension = String(attachmentPath).split(".").pop()?.toLowerCase();

  if (extension === "pdf") return "View PDF";
  if (["jpg", "jpeg", "png"].includes(extension)) return "View Image";
  return "View Attachment";
};

export const filterReportRows = (reports = [], filters = {}) => {
  const safeReports = Array.isArray(reports) ? reports : [];
  const selectedRole = String(filters.role || "").trim();
  const selectedPriority = String(filters.priority || "").trim();
  const validRoles = ["Sales", "Manager"];
  const validPriorities = ["Low", "Medium", "High", "Urgent"];

  return safeReports.filter((report) => {
    const matchesRole = !selectedRole || !validRoles.includes(selectedRole) || report.submitted_by_role === selectedRole;
    const matchesPriority = !selectedPriority || !validPriorities.includes(selectedPriority) || report.priority === selectedPriority;

    return matchesRole && matchesPriority;
  });
};

export const filterSupplierRows = (suppliers = [], filters = {}) => {
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const selectedStatus = String(filters.status || "").trim();
  const validStatuses = ["Active", "Inactive"];

  return safeSuppliers.filter((supplier) => {
    const supplierStatus = String(supplier?.status || "").trim();
    const matchesStatus = !selectedStatus || !validStatuses.includes(selectedStatus) || supplierStatus === selectedStatus;

    return matchesStatus;
  });
};

export const renderAdminReports = async (req, res) => {
  try {
    const requestedRole = String(req.query.role || "").trim();
    const requestedPriority = String(req.query.priority || "").trim();
    const selectedRole = ["Sales", "Manager"].includes(requestedRole) ? requestedRole : "";
    const selectedPriority = ["Low", "Medium", "High", "Urgent"].includes(requestedPriority) ? requestedPriority : "";

    const [rows] = await db.execute(
      `SELECT r.id, r.report_code, r.title, r.report_type, r.priority, r.status, r.description, r.attachment_path, r.created_at,
              u.name AS submitted_by_name, u.role AS submitted_by_role
       FROM reports r
       INNER JOIN users u ON u.id = r.submitted_by
       WHERE u.role IN ('Manager', 'Sales')
       ORDER BY r.created_at DESC`
    );

    const reports = (rows || []).map((report) => ({
      ...report,
      createdAt: report.created_at,
      attachmentLabel: getReportAttachmentLabel(report.attachment_path),
      attachmentExtension: String(report.attachment_path || "").split(".").pop()?.toLowerCase() || "",
    }));

    const filteredReports = filterReportRows(reports, {
      role: selectedRole,
      priority: selectedPriority,
    });

    const totalReports = filteredReports.length;
    const salesReports = filteredReports.filter((report) => report.submitted_by_role === "Sales").length;
    const managerReports = filteredReports.filter((report) => report.submitted_by_role === "Manager").length;
    const highPriorityReports = filteredReports.filter((report) => ["High", "Urgent"].includes(report.priority)).length;

    return res.render("dashboard/admin-reports", {
      pageTitle: "Admin Reports",
      user: req.user,
      reports: filteredReports,
      selectedRole,
      selectedPriority,
      stats: {
        totalReports,
        salesReports,
        managerReports,
        highPriorityReports,
      },
    });
  } catch (error) {
    console.error("Render admin reports error:", error);
    return res.render("dashboard/admin-reports", {
      pageTitle: "Admin Reports",
      user: req.user,
      reports: [],
      selectedRole: "",
      selectedPriority: "",
      stats: {
        totalReports: 0,
        salesReports: 0,
        managerReports: 0,
        highPriorityReports: 0,
      },
    });
  }
};

export const renderAdminReportDetails = async (req, res) => {
  const reportId = Number(req.params.id);

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.redirect(303, "/admin/reports");
  }

  try {
    const [rows] = await db.execute(
      `SELECT r.id, r.report_code, r.title, r.report_type, r.priority, r.status, r.description, r.attachment_path, r.created_at,
              u.name AS submitted_by_name, u.role AS submitted_by_role
       FROM reports r
       INNER JOIN users u ON u.id = r.submitted_by
       WHERE r.id = ?
         AND u.role IN ('Manager', 'Sales')
       LIMIT 1`,
      [reportId]
    );

    const report = rows?.[0];
    if (!report) {
      return res.redirect(303, "/admin/reports");
    }

    return res.render("dashboard/admin-report-details", {
      pageTitle: `Report ${report.report_code}`,
      user: req.user,
      report: {
        ...report,
        createdAt: report.created_at,
        attachmentLabel: getReportAttachmentLabel(report.attachment_path),
        attachmentExtension: String(report.attachment_path || "").split(".").pop()?.toLowerCase() || "",
      },
    });
  } catch (error) {
    console.error("Render admin report details error:", error);
    return res.redirect(303, "/admin/reports");
  }
};

export const renderAdminSuppliers = async (req, res) => {
  const successMessage = req.query.success === "created"
    ? "Supplier added successfully."
    : req.query.success === "updated"
      ? "Supplier updated successfully."
      : null;

  try {
    const requestedStatus = String(req.query.status || "").trim();
    const selectedStatus = ["Active", "Inactive"].includes(requestedStatus) ? requestedStatus : "";

    const [rows] = await db.execute(
      `SELECT id, supplier_code, supplier_name, contact_person, phone, email, gst_number, address, city, state, postal_code, status, created_at
       FROM suppliers
       ORDER BY supplier_name ASC`
    );

    const suppliers = (rows || []).map((supplier) => ({
      ...supplier,
      status: supplier.status || "Active",
      statusClass: supplier.status === "Active" ? "bg-success-subtle text-success" : "bg-secondary-subtle text-secondary",
    }));

    const filteredSuppliers = filterSupplierRows(suppliers, { status: selectedStatus });

    const summary = filteredSuppliers.reduce(
      (acc, supplier) => {
        acc.total += 1;
        if (supplier.status === "Active") acc.active += 1;
        if (supplier.status === "Inactive") acc.inactive += 1;
        return acc;
      },
      { total: 0, active: 0, inactive: 0 }
    );

    return res.render("dashboard/admin-suppliers", {
      pageTitle: "Admin Suppliers",
      user: req.user,
      suppliers: filteredSuppliers,
      summary,
      selectedStatus,
      successMessage,
    });
  } catch (error) {
    console.error("Render admin suppliers error:", error);
    return res.render("dashboard/admin-suppliers", {
      pageTitle: "Admin Suppliers",
      user: req.user,
      suppliers: [],
      summary: { total: 0, active: 0, inactive: 0 },
      selectedStatus: "",
      successMessage: null,
    });
  }
};

export const renderAdminSupplierDetails = async (req, res) => {
  const supplierId = Number(req.params.id);

  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    return res.redirect(303, "/admin/suppliers");
  }

  try {
    const [rows] = await db.execute(
      `SELECT * FROM suppliers WHERE id = ? LIMIT 1`,
      [supplierId]
    );

    const supplier = rows?.[0];
    if (!supplier) {
      return res.redirect(303, "/admin/suppliers");
    }

    return res.render("dashboard/admin-supplier-details", {
      pageTitle: `Supplier ${supplier.supplier_code}`,
      user: req.user,
      supplier: {
        ...supplier,
        status: supplier.status || "Active",
        statusClass: supplier.status === "Active" ? "bg-success-subtle text-success" : "bg-secondary-subtle text-secondary",
      },
    });
  } catch (error) {
    console.error("Render admin supplier details error:", error);
    return res.redirect(303, "/admin/suppliers");
  }
};

export const renderEmployeeManagementPage = async (req, res) => {
  try {
    const employees = await listEmployeesForAdmin();
    const summary = buildEmployeeStatusSummary(employees);

    const successMessage = req.query.success === "deleted"
      ? "Employee deleted successfully."
      : req.query.success === "1"
        ? "Employee updated successfully."
        : null;

    const errorMessage = req.query.error === "deleted"
      ? "Unable to delete employee details."
      : req.query.error === "update"
        ? "Unable to update employee details."
        : req.query.error === "1"
          ? "Unable to update employee details."
          : null;

    res.render("dashboard/employee-management", {
      pageTitle: "Employee Management",
      employees,
      summary,
      successMessage,
      errorMessage,
    });
  } catch (error) {
    console.error("Render employee management page error:", error);

    res.status(500).render("dashboard/employee-management", {
      pageTitle: "Employee Management",
      employees: [],
      summary: buildEmployeeStatusSummary([]),
      successMessage: null,
      errorMessage: "Unable to load employee data right now.",
    });
  }
};

export const updateEmployeeStatus = async (req, res) => {
  const employeeId = Number(req.params.id);
  const requestedRole = normalizeEmployeeRole(req.body.role);
  const normalizedStatus = normalizeEmployeeStatus(req.body.status);

  if (!Number.isInteger(employeeId) || employeeId <= 0 || !requestedRole || !["Active", "Inactive"].includes(normalizedStatus)) {
    return res.redirect(303, "/admin/employee?error=1");
  }

  try {
    const result = await updateEmployeeRoleAndStatusById(employeeId, requestedRole, normalizedStatus);

    if (result.affectedRows === 0) {
      return res.redirect(303, "/admin/employee?error=update");
    }

    return res.redirect(303, "/admin/employee?success=1");
  } catch (error) {
    console.error("Update employee details error:", error);
    return res.redirect(303, "/admin/employee?error=update");
  }
};

export const deleteEmployee = async (req, res) => {
  const employeeId = Number(req.params.id);

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.redirect(303, "/admin/employee?error=1");
  }

  try {
    const result = await deleteUserById(employeeId);

    if (result.affectedRows === 0) {
      return res.redirect(303, "/admin/employee?error=deleted");
    }

    return res.redirect(303, "/admin/employee?success=deleted");
  } catch (error) {
    console.error("Delete employee error:", error);
    return res.redirect(303, "/admin/employee?error=deleted");
  }
};

export const renderAdminTasks = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT t.id, t.task_code, t.title, t.description, t.priority, t.status,
              t.start_date, t.due_date, t.additional_notes, t.completed_at, t.created_at,
              assigned_by_user.name AS assigned_by_name,
              assigned_to_user.name AS assigned_to_name
       FROM tasks t
       LEFT JOIN users assigned_by_user ON assigned_by_user.id = t.assigned_by
       LEFT JOIN users assigned_to_user ON assigned_to_user.id = t.assigned_to
       ORDER BY t.due_date ASC, t.created_at DESC`
    );

    const tasks = (rows || []).map((task) => ({
      ...task,
      startDate: task.start_date,
      dueDate: task.due_date,
      createdAt: task.created_at,
      completedAt: task.completed_at,
    }));

    const summary = tasks.reduce(
      (acc, task) => {
        acc.total += 1;

        if (task.status === "Pending") acc.pending += 1;
        if (task.status === "In Progress") acc.inProgress += 1;
        if (task.status === "Completed") acc.completed += 1;
        if (task.status === "Cancelled") acc.cancelled += 1;

        return acc;
      },
      { total: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0 }
    );

    return res.render("dashboard/admin-tasks", {
      pageTitle: "Admin Tasks",
      user: req.user,
      tasks,
      summary,
    });
  } catch (error) {
    console.error("Render admin tasks error:", error);
    return res.render("dashboard/admin-tasks", {
      pageTitle: "Admin Tasks",
      user: req.user,
      tasks: [],
      summary: { total: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0 },
    });
  }
};

export const renderAdminAnnouncements = async (req, res) => {
  const senderId = req.user?.id ?? req.user?.userId ?? null;

  try {
    const [rows] = await db.execute(
      `SELECT id, receiver_id, title, message, type, is_read, created_at
       FROM notifications
       WHERE sender_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [senderId]
    );

    const [recipients] = await db.execute(
      `SELECT id, name, role, status
       FROM users
       WHERE role IN ('Manager', 'Sales', 'Employee')
       ORDER BY role, name`
    );

    const tasks = rows.map((row) => ({
      ...row,
      createdAt: row.created_at,
    }));

    const successMessage = req.query.success === "deleted"
      ? "Task deleted successfully."
      : req.query.success === "1"
        ? "Task assignment sent successfully."
        : null;

    return res.render("dashboard/admin-announcements", {
      pageTitle: "Admin Announcements",
      user: req.user,
      tasks,
      recipients: recipients || [],
      successMessage,
      errorMessage: req.query.error === "1" ? "Please provide a valid title, message, and receiver." : null,
    });
  } catch (error) {
    console.error("Render admin announcements error:", error);
    return res.render("dashboard/admin-announcements", {
      pageTitle: "Admin Announcements",
      user: req.user,
      tasks: [],
      recipients: [],
      successMessage: null,
      errorMessage: "Unable to load task assignments right now.",
    });
  }
};

export const assignTaskAnnouncement = async (req, res) => {
  const senderId = req.user?.id ?? req.user?.userId ?? null;
  const receiverId = Number(req.body.receiver_id);
  const title = String(req.body.title || "").trim();
  const message = String(req.body.message || "").trim();

  if (!senderId || !Number.isInteger(receiverId) || receiverId <= 0 || !title || !message) {
    return res.redirect(303, "/admin/announcements?error=1");
  }

  try {
    const [receiverRows] = await db.execute(
      `SELECT id, role, status
       FROM users
       WHERE id = ?
         AND role IN ('Manager', 'Sales', 'Employee')
       LIMIT 1`,
      [receiverId]
    );

    const receiver = receiverRows?.[0];
    if (!receiver || receiver.status !== "Active") {
      return res.redirect(303, "/admin/announcements?error=1");
    }

    const [existingRows] = await db.execute(
      `SELECT id
       FROM notifications
       WHERE sender_id = ?
         AND receiver_id = ?
         AND title = ?
         AND message = ?
         AND type = ?
       LIMIT 1`,
      [senderId, receiver.id, title, message, receiver.role]
    );

    if (!existingRows.length) {
      await db.execute(
        `INSERT INTO notifications (sender_id, receiver_id, title, message, type)
         VALUES (?, ?, ?, ?, ?)`,
        [senderId, receiver.id, title, message, receiver.role]
      );
    }

    return res.redirect(303, "/admin/announcements?success=1");
  } catch (error) {
    console.error("Assign task announcement error:", error);
    return res.redirect(303, "/admin/announcements?error=1");
  }
};

export const deleteTaskAnnouncement = async (req, res) => {
  const senderId = req.user?.id ?? req.user?.userId ?? null;
  const taskId = Number(req.params.id);

  if (!senderId || !Number.isInteger(taskId) || taskId <= 0) {
    return res.redirect(303, "/admin/announcements?error=1");
  }

  try {
    const [result] = await db.execute(
      `DELETE FROM notifications WHERE id = ? AND sender_id = ?`,
      [taskId, senderId]
    );

    if (result.affectedRows === 0) {
      return res.redirect(303, "/admin/announcements?error=1");
    }

    return res.redirect(303, "/admin/announcements?success=deleted");
  } catch (error) {
    console.error("Delete task announcement error:", error);
    return res.redirect(303, "/admin/announcements?error=1");
  }
};
