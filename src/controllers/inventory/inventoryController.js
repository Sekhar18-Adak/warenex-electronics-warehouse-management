import db from "../../config/db.js";

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

const buildInventoryViewData = async (req, defaultView = "all") => {
  const view = String(req.query.view || defaultView).toLowerCase();
  const activeView = ["all", "critical", "lowstock", "outofstock"].includes(view) ? view : defaultView;
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

    const mapped = rows.map((product) => {
      const status = getInventoryStatus(product.current_stock, product.minimum_stock);
      return {
        id: product.id,
        code: product.product_code,
        name: product.name,
        purchasePrice: Number(product.purchase_price) || 0,
        sellingPrice: Number(product.selling_price) || 0,
        currentStock: Number(product.current_stock),
        minimumStock: Number(product.minimum_stock),
        status,
        statusClass: getStatusClasses(status),
        rawStatus: product.status || "Active",
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
      if (activeView === "critical") return item.status === "Low Stock" || item.status === "Out of Stock";
      if (activeView === "lowstock") return item.status === "Low Stock";
      if (activeView === "outofstock") return item.status === "Out of Stock";
      return true;
    });

    totalPages = Math.max(1, Math.ceil(products.length / pageSize));
    currentPage = Math.min(Math.max(1, page), totalPages);
    const offset = (currentPage - 1) * pageSize;
    pageProducts = products.slice(offset, offset + pageSize);

    filterLabel =
      activeView === "critical"
        ? "Low Stock & Out of Stock Products"
        : activeView === "lowstock"
        ? "Low Stock Products"
        : activeView === "outofstock"
        ? "Out of Stock Products"
        : "All Products";
  } catch (error) {
    console.error("Render inventory error:", error);
  }

  return {
    pageTitle: "Inventory",
    user: req.user,
    inventoryBasePath: req.baseUrl || "/manager",
    isAdminView: String(req.baseUrl || "").startsWith("/admin"),
    notice: req.query.notice || null,
    products: pageProducts,
    summary,
    activeView,
    filterLabel,
    currentPage,
    totalPages,
    view: activeView,
  };
};

export const renderInventory = async (req, res) => {
  const viewData = await buildInventoryViewData(req, "all");
  return res.render("inventory/inventory", viewData);
};

export const renderAdminInventory = async (req, res) => {
  const viewData = await buildInventoryViewData(req, "critical");
  return res.render("inventory/inventory", viewData);
};

const getManagerUserId = async () => {
  const [rows] = await db.execute(
    "SELECT id FROM users WHERE role = 'Manager' ORDER BY id ASC LIMIT 1"
  );

  return rows?.[0]?.id ?? null;
};

export const notifyManagerForProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const managerId = await getManagerUserId();

    if (!managerId) {
      return res.redirect("/admin/inventory?notice=" + encodeURIComponent("No manager account is available to receive the notification."));
    }

    const [productRows] = await db.execute(
      "SELECT product_code, name, current_stock, minimum_stock FROM products WHERE id = ?",
      [id]
    );

    const product = productRows?.[0];
    const title = "Inventory Alert";
    const message = product
      ? `Admin reported low stock for ${product.name} (${product.product_code}). Current stock: ${product.current_stock}. Reorder threshold: ${product.minimum_stock}.`
      : "Admin reported a product for manager review.";

    await db.execute(
      "INSERT INTO notifications (sender_id, receiver_id, title, message, type) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, managerId, title, message, "Manager"]
    );

    return res.redirect("/admin/inventory?notice=" + encodeURIComponent("Manager has been notified about this product."));
  } catch (error) {
    console.error("Notify manager for product error:", error);
    return res.redirect("/admin/inventory?notice=" + encodeURIComponent("Unable to notify the manager right now."));
  }
};

export const notifyAllLowStockProducts = async (req, res) => {
  try {
    const managerId = await getManagerUserId();

    if (!managerId) {
      return res.redirect("/admin/inventory?notice=" + encodeURIComponent("No manager account is available to receive the notification."));
    }

    const [rows] = await db.execute(
      `SELECT product_code, name, current_stock, minimum_stock
       FROM products
       WHERE current_stock <= minimum_stock OR current_stock <= 0
       ORDER BY name`
    );

    const productNames = rows?.length
      ? rows.map((product) => `${product.name} (${product.product_code})`).join(", ")
      : "No products are currently below their stock threshold.";

    const message = rows?.length
      ? `Admin notified manager about all low stock products: ${productNames}.`
      : "Admin checked the inventory and no items are currently below the stock threshold.";

    await db.execute(
      "INSERT INTO notifications (sender_id, receiver_id, title, message, type) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, managerId, "Inventory Alert", message, "Manager"]
    );

    return res.redirect("/admin/inventory?notice=" + encodeURIComponent("Manager has been notified about all low-stock products."));
  } catch (error) {
    console.error("Notify all low stock products error:", error);
    return res.redirect("/admin/inventory?notice=" + encodeURIComponent("Unable to send the manager notification right now."));
  }
};

export const renderAddProductForm = async (req, res) => {
  res.render("products/add-product", {
    pageTitle: "Add Product",
    user: req.user,
    form: {},
  });
};

export const handleAddProduct = async (req, res) => {
  const {
    name,
    category = "General",
    brand = "",
    model = null,
    description = null,
    purchase_price = 0,
    selling_price = 0,
    current_stock = 0,
    minimum_stock = 0,
    unit = "Piece",
    status = "Active",
  } = req.body;

  if (!name || !selling_price || !purchase_price) {
    return res.status(400).render("products/add-product", {
      pageTitle: "Add Product",
      user: req.user,
      error: "Please provide at least product name, purchase and selling price.",
      form: req.body,
    });
  }

  const productCode = `P${Date.now().toString().slice(-8)}`;

  try {
    const query = `INSERT INTO products (product_code, name, category, brand, model, description, purchase_price, selling_price, current_stock, minimum_stock, unit, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      productCode,
      name,
      category,
      brand,
      model,
      description,
      Number(purchase_price) || 0,
      Number(selling_price) || 0,
      Number(current_stock) || 0,
      Number(minimum_stock) || 0,
      unit,
      status,
      req.user?.id || req.user?.userId || null,
    ];

    await db.execute(query, params);

    return res.redirect("/manager/inventory");
  } catch (error) {
    console.error("Add product error:", error);
    return res.status(500).render("products/add-product", {
      pageTitle: "Add Product",
      user: req.user,
      error: "An error occurred while saving the product.",
      form: req.body,
    });
  }
};

export const updateInventoryStock = async (req, res) => {
  const { id } = req.params;
  const currentStock = Number(req.body.currentStock ?? 0);
  const minimumStock = Number(req.body.minimumStock ?? 0);
  const status = String(req.body.status || "Active");
  const validStatuses = ["Active", "Inactive", "Discontinued"];

  if (!id || Number.isNaN(currentStock) || Number.isNaN(minimumStock) || !validStatuses.includes(status)) {
    return res.redirect("/manager/inventory");
  }

  try {
    await db.execute(
      "UPDATE products SET current_stock = ?, minimum_stock = ?, status = ? WHERE id = ?",
      [currentStock, minimumStock, status, id]
    );
  } catch (error) {
    console.error("Inventory stock update error:", error);
  }

  return res.redirect("/manager/inventory");
};
