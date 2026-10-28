(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CIADIPayroll = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const IRT_GROUP_A_2026 = Object.freeze([
    { min: 0, max: 150000, fixed: 0, rate: 0, excess: 0 },
    { min: 150000, max: 200000, fixed: 12500, rate: 0.16, excess: 150000 },
    { min: 200000, max: 300000, fixed: 31250, rate: 0.18, excess: 200000 },
    { min: 300000, max: 500000, fixed: 49250, rate: 0.19, excess: 300000 },
    { min: 500000, max: 1000000, fixed: 87250, rate: 0.20, excess: 500000 },
    { min: 1000000, max: 1500000, fixed: 187250, rate: 0.21, excess: 1000000 },
    { min: 1500000, max: 2000000, fixed: 292250, rate: 0.22, excess: 1500000 },
    { min: 2000000, max: 2500000, fixed: 402250, rate: 0.23, excess: 2000000 },
    { min: 2500000, max: 5000000, fixed: 517250, rate: 0.24, excess: 2500000 },
    { min: 5000000, max: 10000000, fixed: 1117250, rate: 0.245, excess: 5000000 },
    { min: 10000000, max: Infinity, fixed: 2342250, rate: 0.25, excess: 10000000 }
  ]);
  const roundKz = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const amount = (v, label) => {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n) || n < 0) throw new Error(label + ': os valores têm de ser números não negativos.');
    return n;
  };
  function calculateIrtGroupA2026(taxableBase) {
    const base = Math.max(0, amount(taxableBase, 'Matéria colectável'));
    const bracket = IRT_GROUP_A_2026.find(b => base <= b.max) || IRT_GROUP_A_2026[IRT_GROUP_A_2026.length - 1];
    return roundKz(Math.max(0, bracket.fixed + Math.max(0, base - bracket.excess) * bracket.rate));
  }
  function calculatePayroll(input) {
    const baseSalary = amount(input.baseSalary, 'Salário base');
    const overtimeAmount = amount(input.overtimeAmount, 'Horas extraordinárias');
    const otherDeductions = amount(input.otherDeductions, 'Outros descontos');
    const unpaidAbsenceDays = amount(input.unpaidAbsenceDays, 'Faltas não remuneradas');
    const workingDays = amount(input.workingDays, 'Dias úteis contratados');
    if (workingDays <= 0) throw new Error('Os dias úteis contratados têm de ser superiores a zero.');
    if (unpaidAbsenceDays > workingDays) throw new Error('As faltas não podem exceder os dias úteis contratados.');
    const allowances = Array.isArray(input.allowances) ? input.allowances.map((a, i) => ({
      code: String(a.code || ('SUB' + (i + 1))),
      amount: amount(a.amount, 'Subsídio ' + (a.code || (i + 1))),
      taxableIRT: a.taxableIRT === true,
      contributesINSS: a.contributesINSS === true
    })) : [];
    const absenceDeduction = roundKz(baseSalary / workingDays * unpaidAbsenceDays);
    const adjustedBaseSalary = roundKz(Math.max(0, baseSalary - absenceDeduction));
    const allowanceTotal = roundKz(allowances.reduce((s, a) => s + a.amount, 0));
    const inssAllowanceBase = roundKz(allowances.filter(a => a.contributesINSS).reduce((s, a) => s + a.amount, 0));
    const irtAllowanceBase = roundKz(allowances.filter(a => a.taxableIRT).reduce((s, a) => s + a.amount, 0));
    const inssBase = roundKz(adjustedBaseSalary + inssAllowanceBase);
    const regime = input.regime || 'geral';
    const workerRate = regime === 'geral' ? 0.03 : amount(input.workerINSSRate, 'Taxa INSS trabalhador') / 100;
    const employerRate = regime === 'geral' ? 0.08 : amount(input.employerINSSRate, 'Taxa INSS empregador') / 100;
    const inssEmployee = roundKz(inssBase * workerRate);
    const inssEmployer = roundKz(inssBase * employerRate);
    const irtGroup = input.irtGroup || 'A';
    const irtTaxableBase = roundKz(Math.max(0, adjustedBaseSalary + irtAllowanceBase + overtimeAmount - inssEmployee));
    if (irtGroup !== 'A') throw new Error('O cálculo automático só está configurado para IRT Grupo A; Grupo B/C requer regras próprias validadas.');
    const irt = calculateIrtGroupA2026(irtTaxableBase);
    const grossPay = roundKz(baseSalary + allowanceTotal + overtimeAmount);
    const totalDeductions = roundKz(absenceDeduction + inssEmployee + irt + otherDeductions);
    if (totalDeductions > grossPay) throw new Error('Os descontos não podem exceder o total bruto.');
    return {
      baseSalary: roundKz(baseSalary), absenceDeduction, adjustedBaseSalary,
      allowances, allowanceTotal, overtimeAmount, inssBase, inssEmployee,
      inssEmployer, irtTaxableBase, irt, otherDeductions, grossPay,
      totalDeductions, netPay: roundKz(grossPay - totalDeductions),
      employerTotalCost: roundKz(grossPay - absenceDeduction + inssEmployer),
      ruleVersion: 'AO-IRT-A-2026-LEI-14-25',
      warnings: [
        'Confirme com a Contabilidade a incidência de IRT/INSS de cada subsídio e a regra contratual de faltas antes de aprovar a folha.',
        'Regime geral de INSS aplicado: 3% trabalhador e 8% empregador; confirme regimes especiais e excepções.'
      ]
    };
  }
  return { IRT_GROUP_A_2026, calculateIrtGroupA2026, calculatePayroll };
});
