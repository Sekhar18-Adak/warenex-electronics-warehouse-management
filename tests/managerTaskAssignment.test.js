import assert from 'node:assert/strict';
import {
  generateTaskCode,
  normalizeTaskPriority,
  reactivateEmployeeStatus,
  validateTaskAssignmentInput,
} from '../src/controllers/managerController.js';
import { buildEmployeeTaskSummary } from '../src/controllers/employeeController.js';

const taskCode = generateTaskCode();
assert.match(taskCode, /^TASK-\d{8}-\d{4}$/u, 'task code should use a TASK prefix with date and sequence');

assert.equal(normalizeTaskPriority('urgent'), 'Urgent');
assert.equal(normalizeTaskPriority('unknown'), 'Medium');
assert.equal(reactivateEmployeeStatus('Inactive'), 'Active');
assert.equal(reactivateEmployeeStatus('Active'), 'Active');

const employeeSummary = buildEmployeeTaskSummary([
  { status: 'Completed', priority: 'High' },
  { status: 'Pending', priority: 'Medium' },
  { status: 'In Progress', priority: 'Low' },
  { status: 'Completed', priority: 'Urgent' },
  { status: 'Pending', priority: 'Medium' },
]);
assert.equal(employeeSummary.completedTasks, 2);
assert.equal(employeeSummary.remainingTasks, 3);
assert.equal(employeeSummary.highPriorityTasks, 2);
assert.equal(employeeSummary.mediumPriorityTasks, 2);
assert.equal(employeeSummary.lowPriorityTasks, 1);

const valid = validateTaskAssignmentInput({
  assignedTo: '7',
  title: 'Restock shelves',
  description: 'Check all retail displays',
  priority: 'High',
  dueDate: '2026-10-25',
});
assert.equal(valid.valid, true);

const invalid = validateTaskAssignmentInput({
  assignedTo: '',
  title: '',
  description: 'Missing required values',
  priority: 'Medium',
  dueDate: '',
});
assert.equal(invalid.valid, false);
assert.ok(invalid.errors.includes('Employee ID is required.'));
assert.ok(invalid.errors.includes('Task title is required.'));
assert.ok(invalid.errors.includes('Due date is required.'));

console.log('manager task assignment validation tests passed');
