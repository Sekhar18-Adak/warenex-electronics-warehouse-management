import fs from "fs";
import path from "path";
import multer from "multer";
import db from "../config/db.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const REPORT_TYPE_OPTIONS = [
  "General Report",
  "Inventory Issue",
  "Sales Report",
  "Purchase Report",
  "Customer Issue",
  "Product Damage",
  "Employee Issue",
  "Other",
];

const REPORT_PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];
const REPORT_STATUS_DEFAULT = "Submitted";
const UPLOAD_DIRECTORY = path.join(process.cwd(), "uploads", "reports");

fs.mkdirSync(UPLOAD_DIRECTORY, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIRECTORY),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeName}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
  ];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(extension)) {
    return cb(null, true);
  }

  return cb(new Error("Only JPG, JPEG, PNG, and PDF files are allowed."));
};

export const uploadReportAttachment = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

const getNextReportCode = async () => {
  const [rows] = await db.execute("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM reports");
  const nextId = Number(rows?.[0]?.next_id || 1);
  return `REP${String(nextId).padStart(4, "0")}`;
};

const buildReportFormData = (req) => ({
  title: String(req.body?.title || "").trim(),
  reportType: String(req.body?.reportType || "").trim(),
  priority: String(req.body?.priority || "Medium").trim() || "Medium",
  description: String(req.body?.description || "").trim(),
});

const normalizeAttachmentPath = (file) => {
  if (!file) return null;
  const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, "/");
  return `/${relativePath}`;
};

const renderReportForm = (req, res, viewName, pageTitle) => {
  const errorMessage = req.query?.error === "1" ? "Please check the form and try again." : null;
  const reportCode = String(req.query?.report_code || "").trim();
  const successMessage = req.query?.success === "1"
    ? (reportCode ? `Report ${reportCode} sent to admin successfully.` : "Report sent to admin successfully.")
    : null;

  return res.render(viewName, {
    pageTitle,
    user: req.user,
    reportTypes: REPORT_TYPE_OPTIONS,
    priorities: REPORT_PRIORITY_OPTIONS,
    errorMessage,
    successMessage,
  });
};

export const renderSalesReports = (req, res) => renderReportForm(req, res, "sales/reports", "Sales Reports");
export const renderManagerReports = (req, res) => renderReportForm(req, res, "manager/reports", "Manager Reports");

const handleReportSubmit = async (req, res, redirectPath, viewName, pageTitle) => {
  const { title, reportType, priority, description } = buildReportFormData(req);
  const submittedBy = req.user?.id ?? req.user?.userId ?? null;
  const file = req.file;

  if (!submittedBy) {
    return res.redirect(`${redirectPath}?error=1`);
  }

  if (!title || !reportType || !description || !REPORT_TYPE_OPTIONS.includes(reportType) || !REPORT_PRIORITY_OPTIONS.includes(priority)) {
    return res.redirect(`${redirectPath}?error=1`);
  }

  try {
    const reportCode = await getNextReportCode();
    const attachmentPath = normalizeAttachmentPath(file);

    await db.execute(
      `INSERT INTO reports (report_code, title, report_type, priority, description, attachment_path, submitted_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [reportCode, title, reportType, priority, description, attachmentPath, submittedBy, REPORT_STATUS_DEFAULT]
    );

    return res.redirect(`${redirectPath}?success=1&report_code=${encodeURIComponent(reportCode)}`);
  } catch (error) {
    console.error("Submit report error:", error);

    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_cleanupError) {
        // ignore cleanup problems
      }
    }

    return res.render(viewName, {
      pageTitle,
      user: req.user,
      reportTypes: REPORT_TYPE_OPTIONS,
      priorities: REPORT_PRIORITY_OPTIONS,
      errorMessage: "Unable to submit the report right now. Please try again.",
      successMessage: null,
    });
  }
};

export const submitSalesReport = async (req, res) => handleReportSubmit(req, res, "/sales/reports", "sales/reports", "Sales Reports");
export const submitManagerReport = async (req, res) => handleReportSubmit(req, res, "/manager/reports", "manager/reports", "Manager Reports");
