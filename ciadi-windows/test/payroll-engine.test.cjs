const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePayroll, IRT_GROUP_A_2026 } = require('../payroll-engine.js');

test('calculates INSS employee/employer and IRT Group A from 2026 table', () => {
  const result = calculatePayroll({
    baseSalary: 500000,
    allowances: [],
    overtimeAmount: 0,
    unpaidAbsenceDays: 0,
    workingDays: 22,
    otherDeductions: 0,
    regime: 'geral',
    irtGroup: 'A',
  });
  assert.equal(result.inssEmployee, 15000);
  assert.equal(result.inssEmployer, 40000);
  assert.equal(result.irtTaxableBase, 485000);
  assert.equal(result.irt, 84400);
  assert.equal(result.netPay, 400600);
});

test('applies the 150,000 Kz exemption to IRT Group A taxable base', () => {
  const result = calculatePayroll({
    baseSalary: 150000,
    allowances: [],
    overtimeAmount: 0,
    unpaidAbsenceDays: 0,
    workingDays: 22,
    otherDeductions: 0,
    regime: 'geral',
    irtGroup: 'A',
  });
  assert.equal(result.inssEmployee, 4500);
  assert.equal(result.irtTaxableBase, 145500);
  assert.equal(result.irt, 0);
});

test('supports explicit allowance tax/contribution flags and unpaid absences', () => {
  const result = calculatePayroll({
    baseSalary: 220000,
    allowances: [
      { code: 'ALIM', amount: 20000, taxableIRT: false, contributesINSS: false },
      { code: 'PREMIO', amount: 10000, taxableIRT: true, contributesINSS: true },
    ],
    overtimeAmount: 5000,
    unpaidAbsenceDays: 2,
    workingDays: 22,
    otherDeductions: 1000,
    regime: 'geral',
    irtGroup: 'A',
  });
  assert.equal(result.absenceDeduction, 20000);
  assert.equal(result.adjustedBaseSalary, 200000);
  assert.equal(result.inssBase, 210000);
  assert.equal(result.inssEmployee, 6300);
  assert.equal(result.inssEmployer, 16800);
  assert.equal(result.grossPay, 235000);
  assert.equal(result.netPay, result.grossPay - result.inssEmployee - result.irt - 1000);
});

test('rejects invalid values and deductions that exceed gross pay', () => {
  assert.throws(() => calculatePayroll({
    baseSalary: -1, allowances: [], overtimeAmount: 0,
    unpaidAbsenceDays: 0, workingDays: 22, otherDeductions: 0,
    regime: 'geral', irtGroup: 'A',
  }), /não negativos/);
  assert.throws(() => calculatePayroll({
    baseSalary: 1000, allowances: [], overtimeAmount: 0,
    unpaidAbsenceDays: 0, workingDays: 22, otherDeductions: 99999,
    regime: 'geral', irtGroup: 'A',
  }), /exceder/);
});

test('documents the versioned 2026 IRT bracket table', () => {
  assert.equal(IRT_GROUP_A_2026.length, 11);
  assert.equal(IRT_GROUP_A_2026[0].max, 150000);
  assert.equal(IRT_GROUP_A_2026[10].rate, 0.25);
});
