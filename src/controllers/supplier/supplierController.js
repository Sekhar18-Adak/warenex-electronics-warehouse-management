import db from "../../config/db.js";

const getSupplierBasePath = (req) => (req?.user?.role === "Admin" ? "/admin" : "/manager");

const getStatusClass = (status = "Active") => {
  return status === "Active" ? "bg-success-subtle text-success" : "bg-secondary-subtle text-secondary";
};

const getNextSupplierCode = async () => {
  const [rows] = await db.execute("SELECT MAX(id) AS lastId FROM suppliers");
  const nextId = Number(rows[0]?.lastId || 0) + 1;
  return `SUP${nextId}`;
};

export const renderSuppliers = async (req, res) => {
  const successMessage = req.query.success === "created"
    ? "Supplier added successfully."
    : req.query.success === "updated"
      ? "Supplier updated successfully."
      : null;

  try {
    const [rows] = await db.execute(
      "SELECT id, supplier_name, status FROM suppliers ORDER BY supplier_name"
    );

    const suppliers = rows.map((supplier) => ({
      id: supplier.id,
      supplier_name: supplier.supplier_name,
      status: supplier.status,
      statusClass: getStatusClass(supplier.status),
    }));

    const summary = suppliers.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === "Active") acc.active += 1;
        if (item.status === "Inactive") acc.inactive += 1;
        return acc;
      },
      { total: 0, active: 0, inactive: 0 }
    );

    res.render("supplier/suppliers", {
      pageTitle: "Suppliers",
      user: req.user,
      suppliers,
      summary,
      successMessage,
    });
  } catch (error) {
    console.error("Render suppliers error:", error);
    res.render("supplier/suppliers", {
      pageTitle: "Suppliers",
      user: req.user,
      suppliers: [],
      summary: { total: 0, active: 0, inactive: 0 },
      error: "Unable to load suppliers.",
      successMessage: null,
    });
  }
};

export const renderAddSupplierForm = async (req, res) => {
  const basePath = getSupplierBasePath(req);

  try {
    const supplierCode = await getNextSupplierCode();

    return res.render("supplier/add-supplier", {
      pageTitle: "Add Supplier",
      user: req.user,
      basePath,
      listPath: `${basePath}/suppliers`,
      actionPath: `${basePath}/suppliers/add`,
      form: { supplier_code: supplierCode, status: "Active" },
    });
  } catch (error) {
    console.error("Generate supplier code error:", error);
    return res.render("supplier/add-supplier", {
      pageTitle: "Add Supplier",
      user: req.user,
      basePath,
      listPath: `${basePath}/suppliers`,
      actionPath: `${basePath}/suppliers/add`,
      form: { status: "Active" },
    });
  }
};

export const createSupplier = async (req, res) => {
  let {
    supplier_code,
    supplier_name,
    contact_person,
    phone,
    email = "",
    gst_number = "",
    address = "",
    city = "",
    state = "",
    postal_code = "",
    status = "Active",
  } = req.body;

  try {
    supplier_code = supplier_code?.trim() || (await getNextSupplierCode());
  } catch (error) {
    console.error("Generate supplier code for create error:", error);
    supplier_code = "SUP1";
  }

  if (!supplier_name || !contact_person || !phone) {
    return res.status(400).render("supplier/add-supplier", {
      pageTitle: "Add Supplier",
      user: req.user,
      error: "Supplier name, contact person, and phone are required.",
      form: { ...req.body, supplier_code },
    });
  }

  try {
    await db.execute(
      `INSERT INTO suppliers (
        supplier_code,
        supplier_name,
        contact_person,
        phone,
        email,
        gst_number,
        address,
        city,
        state,
        postal_code,
        status,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplier_code,
        supplier_name,
        contact_person,
        phone,
        email || null,
        gst_number || null,
        address || null,
        city || null,
        state || null,
        postal_code || null,
        status,
        req.user?.id || req.user?.userId || 1,
      ]
    );

    const redirectPath = `${getSupplierBasePath(req)}/suppliers?success=created`;
    return res.redirect(redirectPath);
  } catch (error) {
    console.error("Create supplier error:", error);
    return res.status(500).render("supplier/add-supplier", {
      pageTitle: "Add Supplier",
      user: req.user,
      basePath: getSupplierBasePath(req),
      listPath: `${getSupplierBasePath(req)}/suppliers`,
      actionPath: `${getSupplierBasePath(req)}/suppliers/add`,
      error: "An error occurred while saving the supplier.",
      form: req.body,
    });
  }
};

export const renderSupplierDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT * FROM suppliers WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.redirect(getSupplierBasePath(req) + "/suppliers");
    }

    const supplier = rows[0];
    return res.render("supplier/view-supplier", {
      pageTitle: "Supplier Details",
      user: req.user,
      basePath: getSupplierBasePath(req),
      listPath: `${getSupplierBasePath(req)}/suppliers`,
      supplier,
      statusClass: getStatusClass(supplier.status),
    });
  } catch (error) {
    console.error("View supplier error:", error);
    return res.redirect(getSupplierBasePath(req) + "/suppliers");
  }
};

export const renderEditSupplierForm = async (req, res) => {
  const { id } = req.params;
  const basePath = getSupplierBasePath(req);

  try {
    const [rows] = await db.execute(
      "SELECT * FROM suppliers WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      return res.redirect(basePath + "/suppliers");
    }

    res.render("supplier/edit-supplier", {
      pageTitle: "Edit Supplier",
      user: req.user,
      basePath,
      listPath: `${basePath}/suppliers`,
      actionPath: `${basePath}/suppliers/edit/${id}`,
      supplier: rows[0],
    });
  } catch (error) {
    console.error("Edit supplier error:", error);
    res.redirect(basePath + "/suppliers");
  }
};

export const updateSupplier = async (req, res) => {
  const { id } = req.params;
  const {
    supplier_code,
    supplier_name,
    contact_person,
    phone,
    email = "",
    gst_number = "",
    address = "",
    city = "",
    state = "",
    postal_code = "",
    status = "Active",
  } = req.body;

  if (!supplier_code || !supplier_name || !contact_person || !phone) {
    return res.status(400).render("supplier/edit-supplier", {
      pageTitle: "Edit Supplier",
      user: req.user,
      error: "Supplier code, supplier name, contact person, and phone are required.",
      supplier: { id, ...req.body },
    });
  }

  try {
    await db.execute(
      `UPDATE suppliers SET
        supplier_code = ?,
        supplier_name = ?,
        contact_person = ?,
        phone = ?,
        email = ?,
        gst_number = ?,
        address = ?,
        city = ?,
        state = ?,
        postal_code = ?,
        status = ?
      WHERE id = ?`,
      [
        supplier_code,
        supplier_name,
        contact_person,
        phone,
        email || null,
        gst_number || null,
        address || null,
        city || null,
        state || null,
        postal_code || null,
        status,
        id,
      ]
    );

    const redirectPath = `${getSupplierBasePath(req)}/suppliers?success=updated`;
    return res.redirect(redirectPath);
  } catch (error) {
    console.error("Update supplier error:", error);
    return res.status(500).render("supplier/edit-supplier", {
      pageTitle: "Edit Supplier",
      user: req.user,
      basePath: getSupplierBasePath(req),
      listPath: `${getSupplierBasePath(req)}/suppliers`,
      actionPath: `${getSupplierBasePath(req)}/suppliers/edit/${id}`,
      error: "An error occurred while updating the supplier.",
      supplier: { id, ...req.body },
    });
  }
};
