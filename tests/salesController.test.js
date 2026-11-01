import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCustomerTotalPayment,
  formatCurrencyAmount,
  normalizeCustomerRecord,
  paginateCustomers,
} from "../src/controllers/salesController.js";

test("formatCurrencyAmount keeps currency values consistent for tables", () => {
  assert.equal(formatCurrencyAmount(1250.5), "$1,250.50");
  assert.equal(formatCurrencyAmount(0), "$0.00");
});

test("normalizeCustomerRecord exposes the customer fields used in the sales customer table", () => {
  const customer = {
    id: 7,
    customer_code: "CUST-1001",
    customer_name: "Alice Perera",
    total_payment_till_now: "2500.75",
    phone: "0771234567",
    email: "alice@example.com",
    address: "Main Street",
    city: "Colombo",
    state: "Western",
    postal_code: "00100",
  };

  const result = normalizeCustomerRecord(customer);

  assert.deepEqual(result, {
    id: 7,
    customer_code: "CUST-1001",
    customer_name: "Alice Perera",
    total_payment_till_now: 2500.75,
    total_payment_formatted: "$2,500.75",
    phone: "0771234567",
    email: "alice@example.com",
    address: "Main Street",
    city: "Colombo",
    state: "Western",
    postal_code: "00100",
  });
});

test("paginateCustomers splits the list into 10-item chunks with navigation metadata", () => {
  const customers = Array.from({ length: 25 }, (_, index) => ({ id: index + 1, customer_name: `Customer ${index + 1}` }));

  const firstPage = paginateCustomers(customers, 1, 10);
  const secondPage = paginateCustomers(customers, 2, 10);
  const lastPage = paginateCustomers(customers, 3, 10);

  assert.equal(firstPage.items.length, 10);
  assert.equal(firstPage.page, 1);
  assert.equal(firstPage.totalPages, 3);
  assert.equal(firstPage.hasPrev, false);
  assert.equal(firstPage.hasNext, true);
  assert.equal(secondPage.items[0].id, 11);
  assert.equal(lastPage.items.length, 5);
  assert.equal(lastPage.hasNext, false);
});

test("calculateCustomerTotalPayment totals all sales for a customer without double-counting or NaN values", () => {
  const salesRows = [
    { total_amount: 2500 },
    { total_amount: "1500.50" },
    { total_amount: null },
    { total_amount: "bad" },
    { total_amount: 500 },
  ];

  assert.equal(calculateCustomerTotalPayment(salesRows), 4500.5);
  assert.equal(calculateCustomerTotalPayment([]), 0);
});
