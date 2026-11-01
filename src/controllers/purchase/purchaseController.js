import db from "../../config/db.js";

const statusMeta = {
  approved: { label: "Approved", className: "bg-success-subtle text-success" },
  pending: { label: "Pending", className: "bg-warning-subtle text-warning" },
  cancelled: { label: "Cancelled", className: "bg-danger-subtle text-danger" },
  completed: { label: "Completed", className: "bg-primary-subtle text-primary" },
  "partially approved": {
    label: "Partially Approved",
    className: "bg-info-subtle text-info",
  },
  all: { label: "All Orders", className: "bg-secondary-subtle text-secondary" },
};

const normalizeOrderStatus = (status = "Pending") => {
  const value = String(status || "Pending").trim();
  const normalized = value.toLowerCase();

  if (normalized === "partially received") return "Partially Approved";
  if (normalized === "partially approved") return "Partially Approved";
  return value;
};

const normalizeFilter = (value) => {
  if (!value) return "all";
  const key = String(value).trim().toLowerCase();
  if (key === "partially-approved" || key === "partially approved" || key === "partially received") {
    return "partially approved";
  }
  return key;
};

const getStatusText = (status = "Pending") => normalizeOrderStatus(status);

const normalizeDatabaseStatus = (status = "Pending") => {
  const value = String(status || "Pending").trim();
  const normalized = value.toLowerCase();

  if (normalized === "partially approved" || normalized === "partially received") return "Partially Received";
  if (normalized === "approved") return "Approved";
  if (normalized === "pending") return "Pending";
  if (normalized === "cancelled") return "Cancelled";
  if (normalized === "completed") return "Completed";

  return "Pending";
};

const toCurrency = (value) =>
  Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getStatusClass = (status) => {
  const normalized = normalizeFilter(status);
  const meta = statusMeta[normalized] || statusMeta.all;
  return meta.className;
};

export const renderPurchaseEditPage = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT
        po.id,
        po.purchase_order_no AS poNo,
        po.order_date AS orderDate,
        po.expected_delivery AS expectedDelivery,
        po.actual_delivery AS actualDelivery,
        po.total_amount AS totalAmount,
        po.payment_status AS paymentStatus,
        po.order_status AS status,
        po.notes,
        s.supplier_name AS supplier,
        s.contact_person AS supplierContact,
        s.phone AS supplierPhone,
        s.email AS supplierEmail,
        u.name AS createdByName
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN users u ON u.id = po.created_by
      WHERE po.id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.redirect("/manager/purchases");
    }

    const purchase = {
      id: rows[0].id,
      poNo: rows[0].poNo,
      supplier: rows[0].supplier || "Unknown Supplier",
      supplierContact: rows[0].supplierContact || "N/A",
      supplierPhone: rows[0].supplierPhone || "N/A",
      supplierEmail: rows[0].supplierEmail || "N/A",
      orderDate: rows[0].orderDate ? new Date(rows[0].orderDate).toISOString().split("T")[0] : "N/A",
      expectedDelivery: rows[0].expectedDelivery ? new Date(rows[0].expectedDelivery).toISOString().split("T")[0] : "N/A",
      actualDelivery: rows[0].actualDelivery ? new Date(rows[0].actualDelivery).toISOString().split("T")[0] : "N/A",
      totalAmount: Number(rows[0].totalAmount) || 0,
      paymentStatus: rows[0].paymentStatus || "Pending",
      status: normalizeOrderStatus(rows[0].status),
      notes: rows[0].notes || "No notes provided.",
      createdByName: rows[0].createdByName || "N/A",
      formattedTotal: `Rs. ${toCurrency(Number(rows[0].totalAmount) || 0)}`,
      canEdit: normalizeOrderStatus(rows[0].status) !== "Completed",
    };

    return res.render("purchase/edit-purchase", {
      pageTitle: "Edit Purchase Order",
      user: req.user,
      purchase,
      statusClass: getStatusClass(purchase.status),
    });
  } catch (error) {
    console.error("Render purchase edit page error:", error);
    return res.redirect("/manager/purchases");
  }
};

export const deletePurchaseOrder = async (req, res) => {
  const { id } = req.params;

  try {
    await db.execute("DELETE FROM purchase_order_items WHERE purchase_order_id = ?", [id]);
    await db.execute("DELETE FROM purchase_orders WHERE id = ?", [id]);
    return res.redirect("/manager/purchases");
  } catch (error) {
    console.error("Delete purchase order error:", error);
    return res.redirect("/manager/purchases");
  }
};

export const updatePurchaseStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const dbStatus = normalizeDatabaseStatus(status);
    const today = new Date().toISOString().slice(0, 10);
    const actualDeliveryValue = dbStatus === "Completed" ? today : null;

    await db.execute(
      `UPDATE purchase_orders
       SET order_status = ?,
           actual_delivery = ?
       WHERE id = ?`,
      [dbStatus, actualDeliveryValue, id]
    );

    return res.redirect(`/manager/purchases/view/${id}`);
  } catch (error) {
    console.error("Update purchase status error:", error);
    return res.redirect("/manager/purchases");
  }
};

export const renderPurchaseDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT
        po.id,
        po.purchase_order_no AS poNo,
        po.order_date AS orderDate,
        po.expected_delivery AS expectedDelivery,
        po.actual_delivery AS actualDelivery,
        po.total_amount AS totalAmount,
        po.payment_status AS paymentStatus,
        po.order_status AS status,
        po.notes,
        s.supplier_name AS supplier,
        s.contact_person AS supplierContact,
        s.phone AS supplierPhone,
        s.email AS supplierEmail,
        p.id AS productId,
        p.product_code AS productCode,
        p.name AS productName,
        p.category AS productCategory,
        p.brand AS productBrand,
        p.model AS productModel,
        poi.quantity,
        poi.received_quantity AS receivedQuantity,
        poi.purchase_price AS purchasePrice,
        poi.subtotal,
        poi.remarks,
        u.name AS createdByName
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN users u ON u.id = po.created_by
      LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      LEFT JOIN products p ON p.id = poi.product_id
      WHERE po.id = ?
      ORDER BY poi.id ASC`,
      [id]
    );

    if (!rows.length) {
      return res.redirect("/manager/purchases");
    }

    const purchase = {
      id: rows[0].id,
      poNo: rows[0].poNo,
      supplier: rows[0].supplier || "Unknown Supplier",
      supplierContact: rows[0].supplierContact || "N/A",
      supplierPhone: rows[0].supplierPhone || "N/A",
      supplierEmail: rows[0].supplierEmail || "N/A",
      orderDate: rows[0].orderDate ? new Date(rows[0].orderDate).toISOString().split("T")[0] : "N/A",
      expectedDelivery: rows[0].expectedDelivery ? new Date(rows[0].expectedDelivery).toISOString().split("T")[0] : "N/A",
      actualDelivery: rows[0].actualDelivery ? new Date(rows[0].actualDelivery).toISOString().split("T")[0] : "N/A",
      totalAmount: Number(rows[0].totalAmount) || 0,
      paymentStatus: rows[0].paymentStatus || "Pending",
      status: normalizeOrderStatus(rows[0].status),
      notes: rows[0].notes || "No notes provided.",
      createdByName: rows[0].createdByName || "N/A",
      items: rows
        .filter((row) => row.productId)
        .map((row) => ({
          productId: row.productId,
          productCode: row.productCode || "N/A",
          productName: row.productName || "Unknown Product",
          category: row.productCategory || "N/A",
          brand: row.productBrand || "N/A",
          model: row.productModel || "N/A",
          quantity: Number(row.quantity) || 0,
          receivedQuantity: Number(row.receivedQuantity) || 0,
          purchasePrice: Number(row.purchasePrice) || 0,
          subtotal: Number(row.subtotal) || 0,
          remarks: row.remarks || "—",
          formattedPurchasePrice: ` ${toCurrency(Number(row.purchasePrice) || 0)}`,
          formattedSubtotal: toCurrency(Number(row.subtotal) || 0),
        })),
    };

    purchase.formattedTotal = `Rs. ${toCurrency(purchase.totalAmount)}`;

    return res.render("purchase/view-purchase", {
      pageTitle: "Purchase Order Details",
      user: req.user,
      purchase,
      statusClass: getStatusClass(purchase.status),
    });
  } catch (error) {
    console.error("Render purchase details error:", error);
    return res.redirect("/manager/purchases");
  }
};

export const renderPurchasePage = async (req, res) => {
  const activeFilter = normalizeFilter(req.query.filter || "all");
  const activeLabel = statusMeta[activeFilter]?.label || "All Orders";
  const page = Number.parseInt(req.query.page, 10) || 1;
  const pageSize = 5;

  try {
    const [rows] = await db.execute(
      `SELECT
        po.id,
        po.purchase_order_no AS poNo,
        s.supplier_name AS supplier,
        po.order_date AS orderDate,
        po.expected_delivery AS expectedDelivery,
        po.order_status AS status,
        po.total_amount AS totalAmount
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      ORDER BY po.created_at DESC`
    );

    const purchaseOrders = rows.map((order) => ({
      id: order.id,
      poNo: order.poNo,
      supplier: order.supplier || "Unknown Supplier",
      orderDate: order.orderDate ? new Date(order.orderDate).toISOString().split("T")[0] : "N/A",
      expectedDelivery: order.expectedDelivery ? new Date(order.expectedDelivery).toISOString().split("T")[0] : "N/A",
      status: getStatusText(order.status),
      totalAmount: Number(order.totalAmount) || 0,
    }));

    const filteredOrders =
      activeFilter === "all"
        ? purchaseOrders
        : purchaseOrders.filter((order) => normalizeFilter(order.status) === activeFilter);

    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedOrders = filteredOrders.slice(startIndex, startIndex + pageSize);

    const summary = purchaseOrders.reduce(
      (acc, order) => {
        acc.total += 1;
        const key = normalizeFilter(order.status);

        if (key === "approved") acc.approved += 1;
        if (key === "cancelled") acc.cancelled += 1;
        if (key === "pending") acc.pending += 1;
        if (key === "completed") acc.completed += 1;
        if (key === "partially approved") acc.partiallyApproved += 1;

        return acc;
      },
      {
        total: 0,
        approved: 0,
        cancelled: 0,
        pending: 0,
        completed: 0,
        partiallyApproved: 0,
      }
    );

    const purchases = paginatedOrders.map((order) => ({
      ...order,
      statusClass: getStatusClass(order.status),
      formattedTotal: `Rs. ${toCurrency(order.totalAmount)}`,
    }));

    return res.render("purchase/purchase", {
      pageTitle: "Purchase Orders",
      user: req.user,
      activeFilter,
      activeLabel,
      summary,
      purchases,
      statusMeta,
      currentPage,
      totalPages,
    });
  } catch (error) {
    console.error("Render purchase page error:", error);
    return res.render("purchase/purchase", {
      pageTitle: "Purchase Orders",
      user: req.user,
      activeFilter,
      activeLabel: "All Orders",
      summary: {
        total: 0,
        approved: 0,
        cancelled: 0,
        pending: 0,
        completed: 0,
        partiallyApproved: 0,
      },
      purchases: [],
      statusMeta,
      currentPage: 1,
      totalPages: 1,
      error: "Unable to load purchase orders.",
    });
  }
};
