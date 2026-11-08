(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_SUPPORT_INVENTORY_LIFECYCLE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const SUPPORT_ROLE = 'suporte_informatica';

  function finiteNonNegative(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new Error(label + ': quantidades não negativas são obrigatórias.');
    }
    return number;
  }

  function validateReceiptLines(lines) {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new Error('A recepção deve conter pelo menos uma linha.');
    }
    return lines.map((line) => {
      const ordered = finiteNonNegative(line?.ordered_quantity, 'Encomendada');
      const received = finiteNonNegative(line?.received_quantity, 'Recebida');
      const accepted = finiteNonNegative(line?.accepted_quantity, 'Aceite');
      const damaged = finiteNonNegative(line?.damaged_quantity ?? 0, 'Danificada');
      if (accepted > received) {
        throw new Error('A quantidade aceite não pode exceder a quantidade recebida.');
      }
      if (damaged > received || accepted + damaged > received) {
        throw new Error('As quantidades aceite e danificada não podem exceder a quantidade recebida.');
      }
      return { ordered_quantity: ordered, received_quantity: received, accepted_quantity: accepted, damaged_quantity: damaged };
    });
  }

  function summarizeGoodsReceipts(rows = []) {
    const receipts = Array.isArray(rows) ? rows : [];
    const summary = {
      total: receipts.length, draft: 0, checked: 0, posted: 0,
      receivedQuantity: 0, acceptedQuantity: 0, damagedQuantity: 0, discrepancies: 0
    };
    for (const receipt of receipts) {
      const status = String(receipt?.status || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(summary, status)) summary[status] += 1;
      const received = Number(receipt?.received_quantity || 0);
      const accepted = Number(receipt?.accepted_quantity || 0);
      const damaged = Number(receipt?.damaged_quantity || 0);
      if (Number.isFinite(received)) summary.receivedQuantity += received;
      if (Number.isFinite(accepted)) summary.acceptedQuantity += accepted;
      if (Number.isFinite(damaged)) summary.damagedQuantity += damaged;
      if (['checked', 'posted'].includes(status) && (received !== accepted || damaged > 0)) summary.discrepancies += 1;
    }
    return summary;
  }

  function summarizeReceiptDiscrepancies(lines = []) {
    const rows = Array.isArray(lines) ? lines : [];
    const result = {
      lines: rows.length, shortages: 0, excesses: 0, damagedLines: 0,
      shortageQuantity: 0, excessQuantity: 0, damagedQuantity: 0
    };
    for (const line of rows) {
      const ordered = Number(line?.ordered_quantity);
      const received = Number(line?.received_quantity);
      const damaged = Number(line?.damaged_quantity || 0);
      if (![ordered, received, damaged].every(Number.isFinite)) continue;
      if (received < ordered) {
        result.shortages += 1;
        result.shortageQuantity += ordered - received;
      } else if (received > ordered) {
        result.excesses += 1;
        result.excessQuantity += received - ordered;
      }
      if (damaged > 0) {
        result.damagedLines += 1;
        result.damagedQuantity += damaged;
      }
    }
    return result;
  }

  function summarizeInventoryReconciliation(rows = []) {
    const counts = Array.isArray(rows) ? rows : [];
    const result = {
      total: counts.length, draft: 0, counted: 0, reconciled: 0,
      varianceLines: 0, shortageQuantity: 0, surplusQuantity: 0
    };
    for (const count of counts) {
      const status = String(count?.status || '').toLowerCase();
      if (['draft', 'counted', 'reconciled'].includes(status)) result[status] += 1;
      const variance = Number(count?.variance);
      if (!Number.isFinite(variance) || variance === 0 || status === 'draft') continue;
      result.varianceLines += 1;
      if (variance < 0) result.shortageQuantity += Math.abs(variance);
      else result.surplusQuantity += variance;
    }
    return result;
  }

  function summarizeInventoryOperations({ receipts = [], receiptLines = [], counts = [] } = {}) {
    return {
      receipts: summarizeGoodsReceipts(receipts),
      discrepancies: summarizeReceiptDiscrepancies(receiptLines),
      inventory: summarizeInventoryReconciliation(counts)
    };
  }

  function createInventoryLifecycleService({ db, role, actorId } = {}) {
    if (typeof db?.rpc !== 'function') throw new Error('Cliente Supabase com RPC obrigatório.');
    function ensureAccess() {
      if (String(role || '').toLowerCase() !== SUPPORT_ROLE) {
        throw new Error('Perfil sem autorização para executar operações de recepção ou reconciliação.');
      }
      if (!actorId) throw new Error('É necessária uma sessão autenticada para executar esta operação.');
    }
    async function invoke(name, id, argumentName) {
      ensureAccess();
      if (typeof id !== 'string' || !id.trim()) throw new Error('Identificador do registo obrigatório.');
      const result = await db.rpc(name, { [argumentName]: id });
      if (result?.error) throw result.error;
      if (!result?.data) throw new Error('A operação transaccional não devolveu confirmação.');
      return result.data;
    }
    async function createGoodsReceipt(input = {}) {
      ensureAccess();
      if (typeof input.purchaseRequestId !== 'string' || !input.purchaseRequestId.trim()) {
        throw new Error('Pedido de aquisição obrigatório para a recepção.');
      }
      if (typeof input.warehouseId !== 'string' || !input.warehouseId.trim()) {
        throw new Error('Armazém obrigatório para a recepção.');
      }
      if (!Array.isArray(input.lines) || input.lines.length === 0) {
        throw new Error('A recepção deve conter pelo menos uma linha.');
      }
      const lines = input.lines.map((line) => {
        if (typeof line?.purchaseRequestLineId !== 'string' || !line.purchaseRequestLineId.trim()) {
          throw new Error('Cada linha deve conter uma referência à linha da encomenda.');
        }
        const quantities = validateReceiptLines([{
          ordered_quantity: line.ordered_quantity ?? 0,
          received_quantity: line.received_quantity,
          accepted_quantity: line.accepted_quantity,
          damaged_quantity: line.damaged_quantity ?? 0
        }])[0];
        let unitCost = null;
        if (line.unit_cost !== undefined && line.unit_cost !== null && line.unit_cost !== '') {
          unitCost = Number(line.unit_cost);
          if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error('Custo unitário inválido.');
        }
        return {
          purchase_request_line_id: line.purchaseRequestLineId,
          received_quantity: quantities.received_quantity,
          accepted_quantity: quantities.accepted_quantity,
          damaged_quantity: quantities.damaged_quantity,
          unit_cost: unitCost,
          lot_code: String(line.lot_code || '').trim() || null,
          notes: String(line.notes || '').trim() || null
        };
      });
      const result = await db.rpc('create_goods_receipt', {
        p_purchase_request_id: input.purchaseRequestId,
        p_warehouse_id: input.warehouseId,
        p_delivery_reference: String(input.deliveryReference || '').trim() || null,
        p_delivery_date: input.deliveryDate || null,
        p_notes: String(input.notes || '').trim() || null,
        p_lines: lines
      });
      if (result?.error) throw result.error;
      if (!result?.data) throw new Error('O servidor não confirmou a criação da recepção.');
      return result.data;
    }
    return Object.freeze({
      createGoodsReceipt,
      checkGoodsReceipt(receiptId) {
        return invoke('check_goods_receipt', receiptId, 'p_receipt_id');
      },
      finalizeGoodsReceipt(receiptId) {
        return invoke('finalize_goods_receipt', receiptId, 'p_receipt_id');
      },
      reconcileInventoryCount(countId) {
        return invoke('reconcile_inventory_count', countId, 'p_count_id');
      }
    });
  }

  return Object.freeze({
    validateReceiptLines,
    summarizeGoodsReceipts,
    summarizeReceiptDiscrepancies,
    summarizeInventoryReconciliation,
    summarizeInventoryOperations,
    createInventoryLifecycleService
  });
});
