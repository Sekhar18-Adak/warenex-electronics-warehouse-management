import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEmployeeStatusSummary,
  normalizeEmployeeRole,
  normalizeEmployeeStatus,
  normalizeAnnouncementTarget,
  deduplicateReceiverIds,
  filterReportRows,
  filterSupplierRows,
} from "../src/controllers/adminController.js";

test("buildEmployeeStatusSummary counts total, active, and inactive employees", () => {
  const employees = [
    { status: "Active" },
    { status: "Inactive" },
    { status: "Active" },
    { status: "Inactive" },
    { status: "Active" },
  ];

  const result = buildEmployeeStatusSummary(employees);

  assert.equal(result.totalEmployees, 5);
  assert.equal(result.activeEmployees, 3);
  assert.equal(result.inactiveEmployees, 2);
});

test("normalizeEmployeeRole and normalizeEmployeeStatus normalize admin updates", () => {
  assert.equal(normalizeEmployeeRole("manager"), "Manager");
  assert.equal(normalizeEmployeeRole("unknown"), null);
  assert.equal(normalizeEmployeeStatus("inactive"), "Inactive");
  assert.equal(normalizeEmployeeStatus(""), "Active");
});

test("normalizeAnnouncementTarget keeps admin task assignment roles consistent", () => {
  assert.equal(normalizeAnnouncementTarget("sales"), "Sales");
  assert.equal(normalizeAnnouncementTarget("EMPLOYEE"), "Employee");
  assert.equal(normalizeAnnouncementTarget("support"), null);
});

test("deduplicateReceiverIds removes duplicate user records before inserting notifications", () => {
  const receiverRows = [
    { id: 1 },
    { id: 2 },
    { id: 2 },
    { id: 3 },
    { id: 0 },
    { id: null },
  ];

  assert.deepEqual(deduplicateReceiverIds(receiverRows), [1, 2, 3]);
});

test("filterReportRows narrows reports by submitter role and priority", () => {
  const reports = [
    { submitted_by_role: "Sales", priority: "High" },
    { submitted_by_role: "Sales", priority: "Low" },
    { submitted_by_role: "Manager", priority: "Urgent" },
    { submitted_by_role: "Manager", priority: "Medium" },
  ];

  assert.deepEqual(filterReportRows(reports, { role: "Sales", priority: "High" }), [reports[0]]);
  assert.deepEqual(filterReportRows(reports, { role: "Manager" }), [reports[2], reports[3]]);
  assert.deepEqual(filterReportRows(reports, { priority: "Urgent" }), [reports[2]]);
  assert.deepEqual(filterReportRows(reports, { role: "Unknown" }), reports);
});

test("filterSupplierRows narrows suppliers by status", () => {
  const suppliers = [
    { status: "Active" },
    { status: "Inactive" },
    { status: "Active" },
  ];

  assert.deepEqual(filterSupplierRows(suppliers, { status: "Active" }), [suppliers[0], suppliers[2]]);
  assert.deepEqual(filterSupplierRows(suppliers, { status: "Inactive" }), [suppliers[1]]);
  assert.deepEqual(filterSupplierRows(suppliers, { status: "Unknown" }), suppliers);
});
