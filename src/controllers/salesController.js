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

export const formatCurrencyAmount = (value = 0) => {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return "$0.00";
  }

  return `$${numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const calculateCustomerTotalPayment = (salesRows = []) => {
  if (!Array.isArray(salesRows)) {
    return 0;
  }

  return salesRows.reduce((total, sale) => {
    const value = Number(sale?.total_amount ?? sale?.totalAmount ?? 0);

    if (!Number.isFinite(value)) {
      return total;
    }

    return total + value;
  }, 0);
};

export const syncCustomerTotalPayment = async (customerCode) => {
  if (!customerCode) {
    return;
  }

  try {
    const [rows] = await db.execute(
      `SELECT COALESCE(SUM(CAST(total_amount AS DECIMAL(12, 2))), 0) AS total_paid
       FROM sales_history
       WHERE customer_id = ?`,
      [customerCode]
    );

    const totalPaid = Number(rows?.[0]?.total_paid ?? 0);

    if (!Number.isFinite(totalPaid)) {
      return;
    }

    await db.execute(
      `UPDATE customers
       SET total_payment_till_now = ?
       WHERE customer_code = ?`,
      [totalPaid, customerCode]
    );
  } catch (error) {
    console.error("Sync customer total payment error:", error);
  }
};

export const normalizeCustomerRecord = (customer = {}) => {
  const totalPayment = Number(customer?.total_payment_till_now ?? 0);

  return {
    id: customer.id ?? null,
    customer_code: customer.customer_code ?? "",
    customer_name: customer.customer_name ?? "",
    total_payment_till_now: totalPayment,
    total_payment_formatted: formatCurrencyAmount(totalPayment),
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    city: customer.city ?? "",
    state: customer.state ?? "",
    postal_code: customer.postal_code ?? "",
  };
};

export const formatSellingDate = (value) => {
  if (!value) {
    return "N/A";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return parsedDate.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const generateNextCustomerCode = (existingCodes = []) => {
  const normalizedCodes = (Array.isArray(existingCodes) ? existingCodes : [])
    .map((code) => String(code ?? "").trim())
    .filter((code) => /^CUS\d+$/i.test(code));

  if (!normalizedCodes.length) {
    return "CUS001";
  }

  let highestNumber = 0;

  normalizedCodes.forEach((code) => {
    const numericPart = Number(code.replace(/^CUS/i, ""));
    if (Number.isFinite(numericPart) && numericPart > highestNumber) {
      highestNumber = numericPart;
    }
  });

  return `CUS${String(highestNumber + 1).padStart(3, "0")}`;
};

export const paginateCustomers = (customers = [], page = 1, pageSize = 10) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const totalItems = Array.isArray(customers) ? customers.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const startIndex = (currentPage - 1) * safePageSize;
  const items = customers.slice(startIndex, startIndex + safePageSize);

  return {
    page: currentPage,
    totalPages,
    totalItems,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
    items,
  };
};

export const renderSalesDashboard = (req, res) => {
  res.render("dashboard/sales-dashboard", {
    pageTitle: "Sales Dashboard",
    user: req.user,
  });
};

export const submitSalesEntry = async (req, res) => {
  const salesUserId = req.user?.id ?? req.user?.userId ?? null;
  const productCode = String(req.body.product_id ?? "").trim();
  const customerCode = req.body.customer_id ? String(req.body.customer_id).trim() : null;
  const quantity = Number(req.body.quantity);
  const unitPrice = Number(req.body.unit_price);
  const paymentStatus = String(req.body.payment_status || "Pending").trim();
  const validPaymentStatuses = ["Pending", "Paid", "Partially Paid"];

  if (!salesUserId || !productCode || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0 || !validPaymentStatuses.includes(paymentStatus)) {
    return res.redirect("/sales/history?error=1");
  }

  try {
    const [productMatch] = await db.execute(
      `SELECT product_code FROM products WHERE product_code = ? LIMIT 1`,
      [productCode]
    );

    if (!Array.isArray(productMatch) || productMatch.length === 0) {
      return res.redirect("/sales/history?error=1");
    }

    if (customerCode) {
      const [customerMatch] = await db.execute(
        `SELECT customer_code FROM customers WHERE customer_code = ? LIMIT 1`,
        [customerCode]
      );

      if (!Array.isArray(customerMatch) || customerMatch.length === 0) {
        return res.redirect("/sales/history?error=1");
      }
    }

    const totalAmount = quantity * unitPrice;

    await db.execute(
      `INSERT INTO sales_history (product_id, customer_id, quantity, unit_price, total_amount, payment_status, sold_by, selling_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [productCode, customerCode, quantity, unitPrice, totalAmount, paymentStatus, salesUserId]
    );

    if (customerCode) {
      await syncCustomerTotalPayment(customerCode);
    }

    return res.redirect("/sales/history?success=1");
  } catch (error) {
    console.error("Submit sales entry error:", error);
    return res.redirect("/sales/history?error=1");
  }
};

export const updateSalesEntry = async (req, res) => {
  const saleId = Number(req.params.id);
  const productCode = String(req.body.product_id ?? "").trim();
  const customerCode = req.body.customer_id ? String(req.body.customer_id).trim() : null;
  const quantity = Number(req.body.quantity);
  const unitPrice = Number(req.body.unit_price);
  const paymentStatus = String(req.body.payment_status || "Pending").trim();
  const validPaymentStatuses = ["Pending", "Paid", "Partially Paid"];

  if (!saleId || !productCode || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0 || !validPaymentStatuses.includes(paymentStatus)) {
    return res.redirect("/sales/history?error=1");
  }

  try {
    const [productMatch] = await db.execute(
      `SELECT product_code FROM products WHERE product_code = ? LIMIT 1`,
      [productCode]
    );

    if (!Array.isArray(productMatch) || productMatch.length === 0) {
      return res.redirect("/sales/history?error=1");
    }

    if (customerCode) {
      const [customerMatch] = await db.execute(
        `SELECT customer_code FROM customers WHERE customer_code = ? LIMIT 1`,
        [customerCode]
      );

      if (!Array.isArray(customerMatch) || customerMatch.length === 0) {
        return res.redirect("/sales/history?error=1");
      }
    }

    const totalAmount = quantity * unitPrice;

    const [existingSale] = await db.execute(
      `SELECT customer_id FROM sales_history WHERE id = ? LIMIT 1`,
      [saleId]
    );
    const previousCustomerCode = existingSale?.[0]?.customer_id ? String(existingSale[0].customer_id).trim() : null;

    await db.execute(
      `UPDATE sales_history
       SET product_id = ?, customer_id = ?, quantity = ?, unit_price = ?, total_amount = ?, payment_status = ?, selling_date = NOW()
       WHERE id = ?`,
      [productCode, customerCode, quantity, unitPrice, totalAmount, paymentStatus, saleId]
    );

    const customerCodesToSync = new Set();
    if (previousCustomerCode) customerCodesToSync.add(previousCustomerCode);
    if (customerCode) customerCodesToSync.add(customerCode);

    for (const code of customerCodesToSync) {
      await syncCustomerTotalPayment(code);
    }

    return res.redirect("/sales/history?success=1");
  } catch (error) {
    console.error("Update sales entry error:", error);
    return res.redirect("/sales/history?error=1");
  }
};

export const renderSalesHistory = async (req, res) => {
  const selectedDate = typeof req.query?.date === "string" ? req.query.date.trim() : "";
  const selectedCustomerId = typeof req.query?.customerId === "string" ? req.query.customerId.trim() : "";
  const successMessage = req.query?.success === "1" ? "Sales record added successfully." : null;
  const errorMessage = req.query?.error === "1" ? "Unable to add the sales record." : null;

  try {
    const [products] = await db.execute(
      `SELECT product_code, name, selling_price
       FROM products
       WHERE status = 'Active'
       ORDER BY name ASC`
    );

    const [customers] = await db.execute(
      `SELECT customer_code, customer_name
       FROM customers
       ORDER BY customer_code ASC, customer_name ASC`
    );

    const queryParams = [];
    const whereClauses = [];

    if (selectedDate) {
      whereClauses.push("DATE(COALESCE(selling_date, created_at)) = ?");
      queryParams.push(selectedDate);
    }

    if (selectedCustomerId) {
      whereClauses.push("customer_id = ?");
      queryParams.push(selectedCustomerId);
    }

    const baseQuery = `SELECT
        sh.id,
        sh.product_id,
        sh.customer_id,
        sh.quantity,
        sh.unit_price,
        sh.total_amount,
        sh.payment_status,
        sh.selling_date,
        sh.created_at,
        p.name AS product_name,
        c.customer_name AS customer_name,
        COALESCE(sh.selling_date, sh.created_at) AS sale_time
      FROM sales_history sh
      LEFT JOIN products p ON p.product_code = sh.product_id
      LEFT JOIN customers c ON c.customer_code = sh.customer_id`;

    const query = whereClauses.length
      ? `${baseQuery}
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY COALESCE(sh.selling_date, sh.created_at) DESC, sh.id DESC`
      : `${baseQuery}
        ORDER BY COALESCE(sh.selling_date, sh.created_at) DESC, sh.id DESC
        LIMIT 5`;

    const [rows] = await db.execute(query, queryParams);
    const salesHistory = (rows || []).map((item) => {
      const saleTime = item.sale_time ?? item.selling_date ?? item.created_at ?? null;

      return {
        id: item.id ?? null,
        product_id: item.product_id ?? null,
        product_name: item.product_name ?? item.product_id ?? "N/A",
        customer_id: item.customer_id ?? null,
        customer_name: item.customer_name ?? item.customer_id ?? "N/A",
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        unit_price_formatted: formatCurrencyAmount(item.unit_price),
        total_amount: Number(item.total_amount ?? 0),
        total_amount_formatted: formatCurrencyAmount(item.total_amount),
        payment_status: item.payment_status ?? "Pending",
        selling_date: item.selling_date ?? null,
        created_at: item.created_at ?? null,
        sale_time: saleTime,
        selling_date_label: formatSellingDate(saleTime),
      };
    });
    const totalSalesAmount = salesHistory.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0);

    return res.render("sales/history", {
      pageTitle: "Sales History",
      user: req.user,
      salesHistory,
      products: products || [],
      customers: customers || [],
      selectedDate,
      selectedCustomerId,
      hasDateFilter: Boolean(selectedDate),
      hasCustomerFilter: Boolean(selectedCustomerId),
      totalRecords: salesHistory.length,
      totalSalesAmount,
      totalSalesAmountFormatted: formatCurrencyAmount(totalSalesAmount),
      formatCurrencyAmount,
      successMessage,
      errorMessage,
    });
  } catch (error) {
    console.error("Render sales history error:", error);

    return res.render("sales/history", {
      pageTitle: "Sales History",
      user: req.user,
      salesHistory: [],
      products: [],
      customers: [],
      selectedDate,
      selectedCustomerId,
      hasDateFilter: Boolean(selectedDate),
      hasCustomerFilter: Boolean(selectedCustomerId),
      totalRecords: 0,
      totalSalesAmount: 0,
      totalSalesAmountFormatted: formatCurrencyAmount(0),
      formatCurrencyAmount,
      successMessage: null,
      errorMessage: errorMessage || "Unable to load sales history.",
    });
  }
};

export const createCustomer = async (req, res) => {
  const customerCode = String(req.body.customer_code || "").trim();
  const customerName = String(req.body.customer_name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const email = String(req.body.email || "").trim();
  const address = String(req.body.address || "").trim();
  const city = String(req.body.city || "").trim();
  const state = String(req.body.state || "").trim();
  const postalCode = String(req.body.postal_code || "").trim();
  const totalPaymentTillNow = Number(req.body.total_payment_till_now ?? 0);

  if (!customerCode || !customerName || !phone) {
    return res.redirect("/sales/customers?error=1");
  }

  try {
    const [existingCustomer] = await db.execute(
      `SELECT id FROM customers WHERE customer_code = ? OR phone = ? LIMIT 1`,
      [customerCode, phone]
    );

    if (Array.isArray(existingCustomer) && existingCustomer.length > 0) {
      return res.redirect("/sales/customers?error=duplicate");
    }

    await db.execute(
      `INSERT INTO customers (customer_code, customer_name, phone, email, address, city, state, postal_code, total_payment_till_now)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerCode,
        customerName,
        phone,
        email || null,
        address || null,
        city || null,
        state || null,
        postalCode || null,
        Number.isFinite(totalPaymentTillNow) ? totalPaymentTillNow : 0,
      ]
    );

    return res.redirect("/sales/customers?success=created");
  } catch (error) {
    console.error("Create customer error:", error);
    return res.redirect("/sales/customers?error=1");
  }
};

export const updateCustomer = async (req, res) => {
  const customerId = Number(req.params.id);
  const customerCode = String(req.body.customer_code || "").trim();
  const customerName = String(req.body.customer_name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const email = String(req.body.email || "").trim();
  const address = String(req.body.address || "").trim();
  const city = String(req.body.city || "").trim();
  const state = String(req.body.state || "").trim();
  const postalCode = String(req.body.postal_code || "").trim();
  const totalPaymentTillNow = Number(req.body.total_payment_till_now ?? 0);

  if (!customerId || !customerCode || !customerName || !phone) {
    return res.redirect("/sales/customers?error=1");
  }

  try {
    const [existingCustomer] = await db.execute(
      `SELECT id, customer_code, phone FROM customers WHERE id = ? LIMIT 1`,
      [customerId]
    );

    if (!Array.isArray(existingCustomer) || existingCustomer.length === 0) {
      return res.redirect("/sales/customers?error=notfound");
    }

    const [duplicateCustomer] = await db.execute(
      `SELECT id FROM customers WHERE (customer_code = ? OR phone = ?) AND id <> ? LIMIT 1`,
      [customerCode, phone, customerId]
    );

    if (Array.isArray(duplicateCustomer) && duplicateCustomer.length > 0) {
      return res.redirect("/sales/customers?error=duplicate");
    }

    await db.execute(
      `UPDATE customers
       SET customer_code = ?, customer_name = ?, phone = ?, email = ?, address = ?, city = ?, state = ?, postal_code = ?, total_payment_till_now = ?
       WHERE id = ?`,
      [
        customerCode,
        customerName,
        phone,
        email || null,
        address || null,
        city || null,
        state || null,
        postalCode || null,
        Number.isFinite(totalPaymentTillNow) ? totalPaymentTillNow : 0,
        customerId,
      ]
    );

    return res.redirect("/sales/customers?success=updated");
  } catch (error) {
    console.error("Update customer error:", error);
    return res.redirect("/sales/customers?error=1");
  }
};

export const renderCustomers = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
        id,
        customer_code,
        customer_name,
        phone,
        email,
        address,
        city,
        state,
        postal_code,
        total_payment_till_now
      FROM customers
      ORDER BY customer_name ASC`
    );

    const allCustomers = (rows || []).map(normalizeCustomerRecord);
    const summary = allCustomers.reduce(
      (accumulator, customer) => {
        accumulator.total += 1;
        accumulator.totalPayment += Number(customer.total_payment_till_now ?? 0);
        return accumulator;
      },
      { total: 0, totalPayment: 0 }
    );

    const page = Math.max(1, Number(req.query?.page) || 1);
    const pagination = paginateCustomers(allCustomers, page, 5);
    const nextCustomerCode = generateNextCustomerCode((rows || []).map((row) => row.customer_code));
    const successMessage = req.query?.success === "created"
      ? "Customer added successfully."
      : req.query?.success === "updated"
        ? "Customer details updated successfully."
        : null;
    const errorMessage = req.query?.error === "1"
      ? "Please enter valid customer details before saving."
      : req.query?.error === "duplicate"
        ? "A customer with that code or phone number already exists."
        : req.query?.error === "notfound"
          ? "The customer record could not be found."
          : null;

    return res.render("sales/customers", {
      pageTitle: "Customers",
      user: req.user,
      customers: pagination.items,
      summary,
      pagination,
      formatCurrencyAmount,
      successMessage,
      errorMessage,
      nextCustomerCode,
    });
  } catch (error) {
    console.error("Render customer list error:", error);
    return res.render("sales/customers", {
      pageTitle: "Customers",
      user: req.user,
      customers: [],
      summary: { total: 0, totalPayment: 0 },
      pagination: { page: 1, totalPages: 1, totalItems: 0, hasPrev: false, hasNext: false, items: [] },
      formatCurrencyAmount,
      successMessage: null,
      errorMessage: "Unable to load customers.",
    });
  }
};

export const renderCustomerDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.execute("SELECT * FROM customers WHERE id = ?", [id]);

    if (!rows.length) {
      return res.redirect("/sales/customers");
    }

    const customer = normalizeCustomerRecord(rows[0]);

    return res.render("sales/customer-details", {
      pageTitle: `Customer Details - ${customer.customer_name}`,
      user: req.user,
      customer,
      formatCurrencyAmount,
    });
  } catch (error) {
    console.error("Render customer details error:", error);
    return res.redirect("/sales/customers");
  }
};

export const renderSalesProfile = async (req, res) => {
  const announcements = Array.isArray(res.locals.announcements) ? res.locals.announcements : [];

  return res.render("sales/profile", {
    pageTitle: "Sales Profile",
    user: req.user,
    announcements,
    announcementCount: announcements.length,
    successMessage: req.query.success === "1" ? "Profile image updated successfully." : null,
    errorMessage: req.query.error === "1" ? "Please upload a valid JPG, JPEG, or PNG image before saving." : null,
  });
};

export const updateSalesProfileImage = async (req, res) => {
  const userId = req.user?.id ?? req.user?.userId ?? null;
  const imageFile = req.file;

  if (!userId) {
    return res.redirect("/sales/profile");
  }

  if (!imageFile) {
    return res.redirect("/sales/profile?error=1");
  }

  try {
    const imagePath = normalizeProfileImagePath(imageFile);
    await updateUserProfileImageById(userId, imagePath);
    req.user = {
      ...req.user,
      profile_image: imagePath,
    };

    return res.redirect("/sales/profile?success=1");
  } catch (error) {
    console.error("Update sales profile image error:", error);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_cleanupError) {
        // ignore cleanup issues
      }
    }
    return res.redirect("/sales/profile?error=1");
  }
};

export const markSalesAnnouncementAsRead = async (req, res) => {
  const userId = req.user?.id ?? req.user?.userId ?? null;
  const announcementId = Number(req.params?.id);

  if (!userId || !announcementId) {
    return res.redirect("/sales/announcements");
  }

  try {
    await db.execute(
      `UPDATE notifications
       SET is_read = 1
       WHERE id = ? AND receiver_id = ?`,
      [announcementId, userId]
    );

    return res.redirect("/sales/announcements");
  } catch (error) {
    console.error("Mark sales announcement as read error:", error);
    return res.redirect("/sales/announcements");
  }
};

export const renderSalesAnnouncements = async (req, res) => {
  const userId = req.user?.id ?? req.user?.userId ?? null;
  const roleType = String(req.user?.role || "Sales").trim();

  try {
    const [rows] = await db.execute(
      `SELECT id, title, message, type, is_read, created_at
       FROM notifications
       WHERE receiver_id = ?
         AND is_read = 0
         AND LOWER(type) = LOWER(?)
       ORDER BY created_at DESC` ,
      [userId, roleType]
    );

    return res.render("sales/announcements", {
      pageTitle: "Announcements",
      user: req.user,
      announcements: rows || [],
    });
  } catch (error) {
    console.error("Render sales announcements error:", error);
    return res.render("sales/announcements", {
      pageTitle: "Announcements",
      user: req.user,
      announcements: [],
      error: "Unable to load announcements.",
    });
  }
};

export const renderSalesAnnouncementDetails = async (req, res) => {
  const announcementId = Number(req.params?.id);
  const userId = req.user?.id ?? req.user?.userId ?? null;

  if (!announcementId || !userId) {
    return res.redirect("/sales/announcements");
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
      return res.redirect("/sales/announcements");
    }

    return res.render("sales/announcement-details", {
      pageTitle: "Announcement Details",
      user: req.user,
      announcement: rows[0],
    });
  } catch (error) {
    console.error("Render sales announcement details error:", error);
    return res.redirect("/sales/announcements");
  }
};

export const renderSalesProducts = async (req, res) => {
  const page = Math.max(1, Number(req.query?.page) || 1);
  const pageSize = 5;

  try {
    const [rows] = await db.execute(
      `SELECT
        id,
        product_code,
        name,
        category,
        brand,
        model,
        purchase_price,
        selling_price,
        current_stock,
        minimum_stock,
        unit,
        status
      FROM products
      ORDER BY id ASC`
    );

    const products = (rows || []).map((product) => ({
      id: product.id,
      product_code: product.product_code ?? "",
      name: product.name ?? "N/A",
      category: product.category ?? "N/A",
      brand: product.brand ?? "N/A",
      model: product.model ?? "N/A",
      current_stock: Number(product.current_stock ?? 0),
      minimum_stock: Number(product.minimum_stock ?? 0),
      unit: product.unit ?? "Piece",
      status: product.status ?? "Active",
      purchase_price: Number(product.purchase_price ?? 0),
      selling_price: Number(product.selling_price ?? 0),
      purchase_price_formatted: formatCurrencyAmount(product.purchase_price),
      selling_price_formatted: formatCurrencyAmount(product.selling_price),
    }));

    const totalProducts = products.length;
    const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const paginatedProducts = products.slice(startIndex, startIndex + pageSize);

    return res.render("sales/products", {
      pageTitle: "Products",
      user: req.user,
      products: paginatedProducts,
      currentPage: safePage,
      totalPages,
      totalProducts,
      pageSize,
      formatCurrencyAmount,
    });
  } catch (error) {
    console.error("Render sales products error:", error);
    return res.render("sales/products", {
      pageTitle: "Products",
      user: req.user,
      products: [],
      currentPage: 1,
      totalPages: 1,
      totalProducts: 0,
      pageSize: 5,
      formatCurrencyAmount,
      error: "Unable to load products.",
    });
  }
};

export const renderSalesProductDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT
        id,
        product_code,
        name,
        category,
        brand,
        model,
        description,
        purchase_price,
        selling_price,
        current_stock,
        minimum_stock,
        unit,
        status,
        created_at,
        updated_at
      FROM products
      WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.redirect("/sales/products");
    }

    const product = rows[0];
    const productData = {
      id: product.id,
      product_code: product.product_code ?? "",
      name: product.name ?? "N/A",
      category: product.category ?? "N/A",
      brand: product.brand ?? "N/A",
      model: product.model ?? "N/A",
      description: product.description ?? "No description provided.",
      purchase_price: Number(product.purchase_price ?? 0),
      selling_price: Number(product.selling_price ?? 0),
      current_stock: Number(product.current_stock ?? 0),
      minimum_stock: Number(product.minimum_stock ?? 0),
      unit: product.unit ?? "Piece",
      status: product.status ?? "Active",
      created_at: product.created_at ?? null,
      updated_at: product.updated_at ?? null,
      purchase_price_formatted: formatCurrencyAmount(product.purchase_price),
      selling_price_formatted: formatCurrencyAmount(product.selling_price),
    };

    return res.render("sales/product-details", {
      pageTitle: `Product Details - ${productData.name}`,
      user: req.user,
      product: productData,
      formatCurrencyAmount,
    });
  } catch (error) {
    console.error("Render sales product details error:", error);
    return res.redirect("/sales/products");
  }
};

export const updateSalesProductPrice = async (req, res) => {
  const { id } = req.params;
  const field = req.body?.field || "purchase_price";
  const page = Math.max(1, Number(req.body?.page) || 1);
  const value = Number(req.body?.value ?? 0);

  try {
    if (!id || !Number.isFinite(value)) {
      return res.redirect(`/sales/products?page=${page}`);
    }

    const updateField = field === "selling_price" ? "selling_price" : "purchase_price";

    await db.execute(
      `UPDATE products
       SET ${updateField} = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [value, id]
    );

    return res.redirect(`/sales/products?page=${page}`);
  } catch (error) {
    console.error("Update sales product price error:", error);
    return res.redirect(`/sales/products?page=${page}`);
  }
};
