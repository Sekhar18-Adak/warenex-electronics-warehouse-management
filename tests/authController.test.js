import test from "node:test";
import assert from "node:assert/strict";
import { getDashboardPathForRole } from "../src/controllers/authController.js";

test("getDashboardPathForRole returns the correct dashboard path for each employee role", () => {
  assert.equal(getDashboardPathForRole("Manager"), "/manager/dashboard");
  assert.equal(getDashboardPathForRole("Sales"), "/sales/dashboard");
  assert.equal(getDashboardPathForRole("Employee"), "/employee/dashboard");
  assert.equal(getDashboardPathForRole("Admin"), "/admin/dashboard");
  assert.equal(getDashboardPathForRole("Unknown"), "/login");
});
