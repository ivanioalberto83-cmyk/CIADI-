(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_SUPPORT_TRANSACTIONS = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const MOVEMENT_TYPES = Object.freeze([
    'entrada', 'saida', 'ajuste_positivo', 'ajuste_negativo',
    'devolucao_entrada', 'devolucao_saida'
  ]);

  function clean(value) {
    return String(value ?? '').trim();
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value));
  }

  function positiveQuantity(value) {
    const quantity = Number(value);
    return Number.isFinite(quantity) && quantity > 0;
  }

  function optionalText(value, max = 500) {
    const text = clean(value);
    if (text.length > max) throw new Error('O texto excede o limite permitido (' + max + ' caracteres).');
    return text || null;
  }

  function createSupportTransactionService({ db, role } = {}) {
    if (!db || typeof db.schema !== 'function') {
      throw new Error('Cliente Supabase com suporte ao schema ciadi_ti obrigatório.');
    }

    function ensureSupport() {
      if (String(role || '').toLowerCase() !== 'suporte_informatica') {
        throw new Error('Esta operação está disponível apenas na estação Suporte Informática.');
      }
    }

    async function invoke(name, args) {
      const result = await db.schema('ciadi_ti').rpc(name, args);
      if (result?.error) throw result.error;
      return result?.data;
    }

    return Object.freeze({
      async postStockMovement(input = {}) {
        ensureSupport();
        if (!isUuid(input.item_id)) throw new Error('Artigo inválido.');
        if (!isUuid(input.warehouse_id)) throw new Error('Armazém inválido.');
        if (!MOVEMENT_TYPES.includes(clean(input.movement_type))) throw new Error('Tipo de movimento inválido. As transferências usam a operação própria.');
        if (!positiveQuantity(input.quantity)) throw new Error('A quantidade deve ser superior a zero.');
        if (input.unit_cost !== undefined && input.unit_cost !== null && input.unit_cost !== '' &&
            (!Number.isFinite(Number(input.unit_cost)) || Number(input.unit_cost) < 0)) {
          throw new Error('O custo unitário não pode ser negativo.');
        }
        return invoke('post_stock_movement', {
          p_item_id: clean(input.item_id),
          p_warehouse_id: clean(input.warehouse_id),
          p_movement_type: clean(input.movement_type),
          p_quantity: Number(input.quantity),
          p_reference: optionalText(input.reference, 120),
          p_notes: optionalText(input.notes, 1000),
          p_unit_cost: input.unit_cost === undefined || input.unit_cost === null || input.unit_cost === '' ? null : Number(input.unit_cost),
          p_lot_code: optionalText(input.lot_code, 120)
        });
      },

      async transferStock(input = {}) {
        ensureSupport();
        if (!isUuid(input.item_id)) throw new Error('Artigo inválido.');
        if (!isUuid(input.from_warehouse_id) || !isUuid(input.to_warehouse_id)) throw new Error('Armazém de origem ou destino inválido.');
        if (input.from_warehouse_id === input.to_warehouse_id) throw new Error('A origem e o destino têm de ser diferentes.');
        if (!positiveQuantity(input.quantity)) throw new Error('A quantidade deve ser superior a zero.');
        return invoke('transfer_stock', {
          p_item_id: clean(input.item_id),
          p_from_warehouse_id: clean(input.from_warehouse_id),
          p_to_warehouse_id: clean(input.to_warehouse_id),
          p_quantity: Number(input.quantity),
          p_reference: optionalText(input.reference, 120),
          p_notes: optionalText(input.notes, 1000),
          p_lot_code: optionalText(input.lot_code, 120)
        });
      }
    });
  }

  return Object.freeze({ MOVEMENT_TYPES, createSupportTransactionService });
});
