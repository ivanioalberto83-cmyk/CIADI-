(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_RECEPTION_MODULE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const POLOS = Object.freeze(['talatona', 'jardim_de_rosas']);
  const VISIT_TYPES = Object.freeze(['appointment', 'walk_in']);
  const VISIT_STATUSES = Object.freeze(['waiting', 'in_service', 'referred', 'completed', 'no_show', 'cancelled']);
  const VISITOR_STATUSES = Object.freeze(['inside', 'exited']);
  const ROUTES = Object.freeze([
    { id: 'pedidos_site', label: 'Pedidos de triagem do site' },
    { id: 'agendamentos', label: 'Agenda de consultas' },
    { id: 'pacientes', label: 'Consulta de pacientes' },
    { id: 'familias', label: 'Portal das famílias' },
    { id: 'triagens', label: 'Triagens' }
  ]);
  const TRANSITIONS = Object.freeze({
    waiting: Object.freeze(['in_service', 'no_show', 'cancelled']),
    in_service: Object.freeze(['waiting', 'referred', 'completed']),
    referred: Object.freeze(['waiting', 'completed']),
    completed: Object.freeze([]),
    no_show: Object.freeze([]),
    cancelled: Object.freeze([])
  });
  const STATUS_LABELS = Object.freeze({
    waiting: 'A aguardar',
    in_service: 'Em atendimento',
    referred: 'Encaminhado',
    completed: 'Concluído',
    no_show: 'Não compareceu',
    cancelled: 'Cancelado'
  });
  const POLO_LABELS = Object.freeze({
    talatona: 'Talatona',
    jardim_de_rosas: 'Jardim de Rosas'
  });

  function clean(value, max = 160) {
    return String(value ?? '').trim().slice(0, max);
  }

  function validateVisitInput(input = {}) {
    const errors = [];
    const visitType = input.visitType;
    const poloCode = input.poloCode;
    const displayName = clean(input.displayName, 120);
    const purpose = clean(input.purpose, 160);
    const appointmentId = clean(input.appointmentId, 128);
    const patientId = clean(input.patientId, 128);

    if (!VISIT_TYPES.includes(visitType)) errors.push('Seleccione o tipo de chegada.');
    if (!POLOS.includes(poloCode)) errors.push('Seleccione um polo CIADI válido.');
    if (displayName.length < 2) errors.push('Indique o nome do responsável ou visitante.');
    if (purpose.length < 2) errors.push('Indique a finalidade do atendimento.');
    if (visitType === 'appointment' && !appointmentId) errors.push('Associe a chegada a uma marcação/agendamento existente.');
    if (visitType === 'appointment' && !patientId) errors.push('A marcação seleccionada deve identificar o utente associado.');

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      value: Object.freeze({
        visitType,
        appointmentId: appointmentId || null,
        patientId: patientId || null,
        displayName,
        purpose,
        poloCode
      })
    });
  }

  function transitionVisitStatus(current, next) {
    const known = VISIT_STATUSES.includes(current) && VISIT_STATUSES.includes(next);
    const valid = known && TRANSITIONS[current].includes(next);
    return Object.freeze({
      valid,
      errors: Object.freeze(valid ? [] : ['A transição de estado solicitada não é permitida.']),
      value: valid ? Object.freeze({ from: current, to: next }) : null
    });
  }

  function validatePurchaseReceiptInput(input = {}) {
    const errors = [];
    const requestStatus = clean(input.requestStatus, 32);
    const requestedQuantity = Number(input.requestedQuantity);
    const alreadyReceivedQuantity = Number(input.alreadyReceivedQuantity ?? 0);
    const deliveryQuantity = Number(input.deliveryQuantity);
    const warehouseId = clean(input.warehouseId, 128);
    const deliveryReference = clean(input.deliveryReference, 100);
    const idempotencyKey = clean(input.idempotencyKey, 128);
    const actorId = clean(input.actorId, 128);

    if (requestStatus !== 'approved') errors.push('Só podem ser recebidas requisições aprovadas.');
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      errors.push('A quantidade requisitada tem de ser superior a zero.');
    }
    if (!Number.isFinite(alreadyReceivedQuantity) || alreadyReceivedQuantity < 0) {
      errors.push('A quantidade já recebida não pode ser negativa.');
    }
    if (!Number.isFinite(deliveryQuantity) || deliveryQuantity <= 0) {
      errors.push('A quantidade entregue tem de ser superior a zero.');
    }
    if (Number.isFinite(requestedQuantity) && Number.isFinite(alreadyReceivedQuantity) &&
        Number.isFinite(deliveryQuantity) && deliveryQuantity > 0) {
      const outstanding = Math.round((requestedQuantity - alreadyReceivedQuantity) * 1000) / 1000;
      if (outstanding <= 0) errors.push('A linha da requisição já está totalmente recebida.');
      else if (deliveryQuantity - outstanding > 0.0005) {
        errors.push('A quantidade entregue excede a quantidade ainda em falta.');
      }
    }
    if (!warehouseId) errors.push('Seleccione o armazém de destino.');
    if (!deliveryReference) errors.push('Indique a referência da guia/documento de entrega.');
    if (!idempotencyKey) errors.push('A operação necessita de uma chave idempotente.');
    if (!actorId) errors.push('É obrigatória uma sessão autenticada para registar a recepção.');

    const remainingQuantity = Number.isFinite(requestedQuantity) &&
      Number.isFinite(alreadyReceivedQuantity) && Number.isFinite(deliveryQuantity)
      ? Math.max(0, Math.round((requestedQuantity - alreadyReceivedQuantity - deliveryQuantity) * 1000) / 1000)
      : null;

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      value: errors.length === 0 ? Object.freeze({
        requestedQuantity,
        alreadyReceivedQuantity,
        deliveryQuantity,
        warehouseId,
        deliveryReference,
        idempotencyKey,
        actorId,
        remainingQuantity,
        partial: remainingQuantity > 0
      }) : null
    });
  }

  function validateReceptionStockExitInput(input = {}) {
    const errors = [];
    const mode = clean(input.mode, 32);
    const itemId = clean(input.itemId, 128);
    const warehouseId = clean(input.warehouseId, 128);
    const requestId = clean(input.requestId, 128);
    const requestLineId = clean(input.requestLineId, 128);
    const quantity = Number(input.quantity);
    const justification = clean(input.justification, 1000);
    const reference = clean(input.reference, 100);
    const actorId = clean(input.actorId, 128);

    if (!['approved_request', 'direct_justified'].includes(mode)) errors.push('Seleccione o modo de saída do stock.');
    if (!itemId) errors.push('Artigo obrigatório.');
    if (!warehouseId) errors.push('Armazém obrigatório.');
    if (!Number.isFinite(quantity) || quantity <= 0) errors.push('A quantidade de saída deve ser superior a zero.');
    else if (Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.000001) errors.push('A quantidade não pode exceder três casas decimais.');
    if (mode === 'approved_request' && (!requestId || !requestLineId)) {
      errors.push('A saída por requisição exige uma requisição aprovada e a respectiva linha.');
    }
    if (mode === 'direct_justified' && justification.length < 10) {
      errors.push('A saída directa exige uma justificação com pelo menos 10 caracteres.');
    }
    if (!actorId) errors.push('É obrigatória uma sessão autenticada.');
    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      value: errors.length === 0 ? Object.freeze({
        mode, itemId, warehouseId, requestId: requestId || null,
        requestLineId: requestLineId || null, quantity,
        justification: justification || null, reference: reference || null
      }) : null
    });
  }

  function validateReceptionGoodsInput(input = {}) {
    const errors = [];
    const requestStatus = clean(input.requestStatus, 32);
    const requestId = clean(input.requestId, 128);
    const warehouseId = clean(input.warehouseId, 128);
    const deliveryReference = clean(input.deliveryReference, 100);
    const actorId = clean(input.actorId, 128);
    if (requestStatus !== 'approved') errors.push('Só podem ser recebidas requisições aprovadas.');
    if (!requestId) errors.push('Requisição de compra obrigatória.');
    if (!warehouseId) errors.push('Armazém de destino obrigatório.');
    if (deliveryReference.length < 2) errors.push('Referência da guia/documento de entrega obrigatória.');
    if (!actorId) errors.push('É obrigatória uma sessão autenticada.');
    if (!Array.isArray(input.lines) || !input.lines.length) errors.push('A recepção deve conter pelo menos uma linha.');
    const lines = [];
    for (const line of Array.isArray(input.lines) ? input.lines : []) {
      const requestLineId = clean(line?.requestLineId, 128);
      const orderedQuantity = Number(line?.orderedQuantity);
      const alreadyReceivedQuantity = Number(line?.alreadyReceivedQuantity ?? 0);
      const receivedQuantity = Number(line?.receivedQuantity);
      const acceptedQuantity = Number(line?.acceptedQuantity);
      const damagedQuantity = Number(line?.damagedQuantity ?? 0);
      const returnedQuantity = Number(line?.returnedQuantity ?? 0);
      if (!requestLineId) errors.push('Cada linha deve estar ligada à linha original da requisição.');
      if (!Number.isFinite(orderedQuantity) || orderedQuantity <= 0) errors.push('A quantidade encomendada deve ser superior a zero.');
      if (!Number.isFinite(alreadyReceivedQuantity) || alreadyReceivedQuantity < 0) errors.push('A quantidade já recebida não pode ser negativa.');
      if (!Number.isFinite(receivedQuantity) || receivedQuantity <= 0) errors.push('A quantidade recebida deve ser superior a zero.');
      for (const [label, value] of [['aceite', acceptedQuantity], ['danificada', damagedQuantity], ['devolvida', returnedQuantity]]) {
        if (!Number.isFinite(value) || value < 0) errors.push('A quantidade ' + label + ' não pode ser negativa.');
      }
      if ([orderedQuantity, alreadyReceivedQuantity, receivedQuantity].every(Number.isFinite)) {
        const remainingQuantity = Math.round((orderedQuantity - alreadyReceivedQuantity) * 1000) / 1000;
        if (remainingQuantity <= 0) errors.push('A linha já está totalmente recebida.');
        else if (receivedQuantity - remainingQuantity > 0.0005) errors.push('A quantidade recebida excede a quantidade ainda em falta.');
        if ([acceptedQuantity, damagedQuantity, returnedQuantity].every(Number.isFinite) &&
            Math.abs(acceptedQuantity + damagedQuantity + returnedQuantity - receivedQuantity) > 0.0005) {
          errors.push('As quantidades recebidas têm de ficar integralmente classificadas como aceites, danificadas ou devolvidas.');
        }
        const unitCost = line?.unitCost === undefined || line?.unitCost === null || line?.unitCost === ''
          ? null : Number(line.unitCost);
        if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) errors.push('O custo unitário não pode ser negativo.');
        lines.push({
          requestLineId, orderedQuantity, alreadyReceivedQuantity, receivedQuantity,
          acceptedQuantity, damagedQuantity, returnedQuantity,
          remainingQuantity: Math.max(0, Math.round((remainingQuantity - receivedQuantity) * 1000) / 1000),
          unitCost, lotCode: clean(line?.lotCode, 100) || null, notes: clean(line?.notes, 1000) || null
        });
      }
    }
    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      value: errors.length === 0 ? Object.freeze({
        requestId, warehouseId, deliveryReference, actorId,
        deliveryDate: clean(input.deliveryDate, 20) || null,
        notes: clean(input.notes, 2000) || null,
        lines: Object.freeze(lines.map(line => Object.freeze(line)))
      }) : null
    });
  }

  function createReceptionProcurementService({ supabase, actorId, poloCode, idempotencyKeyFactory } = {}) {
    if (typeof supabase?.schema !== 'function') throw new Error('O schema central ciadi_ti não está disponível.');
    const db = supabase.schema('ciadi_ti');
    const actor = clean(actorId, 128);
    const polo = POLOS.includes(poloCode) ? poloCode : null;
    const makeKey = typeof idempotencyKeyFactory === 'function'
      ? idempotencyKeyFactory
      : () => globalThis.crypto?.randomUUID?.() || '';
    function ensureActor() {
      if (!actor) throw new Error('É necessária uma sessão autenticada para operar o aprovisionamento.');
      if (!polo) throw new Error('O polo da Recepção tem de estar identificado.');
    }
    async function invoke(name, args) {
      ensureActor();
      if (typeof db.rpc !== 'function') throw new Error('RPC do aprovisionamento indisponível.');
      const result = await db.rpc(name, args);
      if (result?.error) throw result.error;
      if (!result?.data) throw new Error('O servidor não confirmou a operação de aprovisionamento.');
      return result.data;
    }
    function newKey() {
      const key = clean(makeKey(), 128);
      if (key.length < 8) throw new Error('Não foi possível gerar uma chave idempotente para esta operação.');
      return key;
    }
    return Object.freeze({
      async registerStockExit(input = {}) {
        ensureActor();
        const validation = validateReceptionStockExitInput({ ...input, actorId: actor });
        if (!validation.valid) throw new Error(validation.errors.join(' '));
        const value = validation.value;
        return invoke('reception_register_stock_exit', {
          p_exit_mode: value.mode,
          p_item_id: value.itemId,
          p_warehouse_id: value.warehouseId,
          p_quantity: value.quantity,
          p_request_id: value.requestId,
          p_request_line_id: value.requestLineId,
          p_justification: value.justification,
          p_reference: value.reference,
          p_idempotency_key: newKey(),
          p_polo_code: polo
        });
      },
      async receivePurchaseGoods(input = {}) {
        ensureActor();
        const validation = validateReceptionGoodsInput({ ...input, actorId: actor });
        if (!validation.valid) throw new Error(validation.errors.join(' '));
        const value = validation.value;
        return invoke('reception_receive_purchase_goods', {
          p_request_id: value.requestId,
          p_warehouse_id: value.warehouseId,
          p_delivery_reference: value.deliveryReference,
          p_delivery_date: value.deliveryDate,
          p_notes: value.notes,
          p_idempotency_key: newKey(),
          p_polo_code: polo,
          p_lines: value.lines.map(line => ({
            request_line_id: line.requestLineId,
            received_quantity: line.receivedQuantity,
            accepted_quantity: line.acceptedQuantity,
            damaged_quantity: line.damagedQuantity,
            returned_quantity: line.returnedQuantity,
            unit_cost: line.unitCost,
            lot_code: line.lotCode,
            notes: line.notes
          }))
        });
      }
    });
  }

  function validateVisitorInput(input = {}) {
    const errors = [];
    const displayName = clean(input.displayName, 120);
    const purpose = clean(input.purpose, 160);
    const hostDepartment = clean(input.hostDepartment, 100);
    const poloCode = input.poloCode;

    if (displayName.length < 2) errors.push('Indique o nome do visitante.');
    if (purpose.length < 2) errors.push('Indique a finalidade da visita.');
    if (hostDepartment.length < 2) errors.push('Indique o serviço de destino.');
    if (!POLOS.includes(poloCode)) errors.push('Seleccione um polo CIADI válido.');

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      value: Object.freeze({ displayName, purpose, hostDepartment, poloCode })
    });
  }

  function summarizeReception(rows = []) {
    const result = {
      total: 0, waiting: 0, inService: 0, referred: 0,
      completed: 0, noShow: 0, cancelled: 0, averageWaitMinutes: 0
    };
    let waitTotal = 0;
    let waitCount = 0;

    for (const row of Array.isArray(rows) ? rows : []) {
      result.total += 1;
      if (row.status === 'waiting') result.waiting += 1;
      else if (row.status === 'in_service') result.inService += 1;
      else if (row.status === 'referred') result.referred += 1;
      else if (row.status === 'completed') result.completed += 1;
      else if (row.status === 'no_show') result.noShow += 1;
      else if (row.status === 'cancelled') result.cancelled += 1;

      if (row.created_at && row.service_started_at) {
        const start = Date.parse(row.created_at);
        const service = Date.parse(row.service_started_at);
        if (Number.isFinite(start) && Number.isFinite(service) && service >= start) {
          waitTotal += (service - start) / 60000;
          waitCount += 1;
        }
      }
    }

    result.averageWaitMinutes = waitCount ? Math.round(waitTotal / waitCount) : 0;
    return Object.freeze(result);
  }


  function selectNextWaitingVisit(rows = []) {
    return (Array.isArray(rows) ? rows : [])
      .filter(row => row && row.status === 'waiting')
      .slice()
      .sort((a, b) => {
        const aTime = Date.parse(a.arrived_at || '');
        const bTime = Date.parse(b.arrived_at || '');
        const timeOrder = (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
        if (timeOrder !== 0) return timeOrder;
        return Number(a.ticket_number || 0) - Number(b.ticket_number || 0);
      })[0] || null;
  }

  function buildPublicCallPanelModel(rows = []) {
    const safeTicket = row => {
      const poloCode = POLOS.includes(row?.polo_code) ? row.polo_code : null;
      if (!poloCode || !Number.isInteger(Number(row?.ticket_number)) || Number(row.ticket_number) < 1) return null;
      return Object.freeze({
        ticketLabel: `${poloCode === 'talatona' ? 'TAL' : 'JDR'} #${String(Number(row.ticket_number)).padStart(3, '0')}`,
        poloLabel: POLO_LABELS[poloCode],
        destination: clean(row.destination_service, 80) || 'Atendimento'
      });
    };
    const validRows = Array.isArray(rows) ? rows : [];
    const called = validRows
      .filter(row => row?.status === 'in_service')
      .slice()
      .sort((a, b) => {
        const aTime = Date.parse(a.service_started_at || '');
        const bTime = Date.parse(b.service_started_at || '');
        return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
      })
      .map(safeTicket)
      .filter(Boolean);
    const next = safeTicket(selectNextWaitingVisit(validRows));
    return Object.freeze({ called: Object.freeze(called), next });
  }

  function createReceptionBusinessRepository({ supabase } = {}) {
    if (!supabase || typeof supabase.from !== 'function' || typeof supabase.schema !== 'function') {
      throw new Error('A ligação aos motores financeiros e de aprovisionamento não está disponível.');
    }

    async function rows(query) {
      const { data, error } = await query;
      if (error) throw error;
      return Object.freeze(Array.isArray(data) ? data : []);
    }

    function requireCompany(companyId) {
      const id = clean(companyId, 128);
      if (!id) throw new Error('É obrigatório identificar a empresa para consultar dados financeiros.');
      return id;
    }

    return Object.freeze({
      async getActiveServices(companyId) {
        const id = requireCompany(companyId);
        return rows(supabase.from('finance_servicos')
          .select('id,codigo,nome,categoria,unidade,preco_base,taxa_imposto,codigo_imposto')
          .eq('empresa_id', id)
          .eq('ativo', true)
          .order('nome', { ascending: true })
          .limit(100));
      },
      async getActiveClients(companyId) {
        const id = requireCompany(companyId);
        return rows(supabase.from('finance_clientes')
          .select('id,nome,nome_comercial,nif,email,telefone,tipo,empresa_id')
          .eq('empresa_id', id)
          .eq('ativo', true)
          .order('nome', { ascending: true })
          .limit(100));
      },
      async getActiveDocumentTypes() {
        return rows(supabase.from('finance_tipos_documento')
          .select('id,codigo,nome,natureza,exige_cliente,exige_linhas,afeta_contabilidade,afeta_saldos_cliente')
          .eq('ativo', true)
          .order('nome', { ascending: true })
          .limit(50));
      },
      async getActiveSeries(companyId, documentType) {
        const id = requireCompany(companyId);
        const type = clean(documentType, 32);
        if (!type) throw new Error('Seleccione o tipo de documento para consultar as séries.');
        return rows(supabase.from('finance_series')
          .select('id,codigo,nome,tipo_documento,ano,proximo_numero,ativa,estado,empresa_id')
          .eq('empresa_id', id)
          .eq('tipo_documento', type)
          .eq('ativa', true)
          .eq('estado', 'ativa')
          .order('ano', { ascending: false })
          .limit(20));
      },
      async getCashboxes(companyId) {
        const id = requireCompany(companyId);
        return rows(supabase.from('finance_caixas')
          .select('id,codigo,nome,localizacao,estado,moeda,empresa_id')
          .eq('empresa_id', id)
          .order('nome', { ascending: true })
          .limit(50));
      },
      async getRecentDocuments(companyId) {
        const id = requireCompany(companyId);
        return rows(supabase.from('finance_documentos')
          .select('id,document_no,tipo_documento,document_status,data_emissao,total,estado_pagamento,fiscal_status,empresa_id')
          .eq('empresa_id', id)
          .order('data_emissao', { ascending: false })
          .limit(10));
      },
      async getOpenCashboxShifts() {
        return rows(supabase.from('finance_caixa_turnos')
          .select('id,caixa_id,operador_id,aberto_em,saldo_inicial,estado')
          .eq('estado', 'aberto')
          .order('aberto_em', { ascending: false })
          .limit(20));
      },
      async getStockBalances() {
        return rows(supabase.schema('ciadi_ti').from('stock_balances')
          .select('item_id,sku,item_name,unit_of_measure,minimum_stock,warehouse_id,warehouse_code,warehouse_name,quantity_on_hand,below_minimum')
          .order('item_name', { ascending: true })
          .limit(100));
      },
      async getPurchaseRequests() {
        return rows(supabase.schema('ciadi_ti').from('purchase_requests')
          .select('id,request_number,status,justification,estimated_total,finance_decision_at,finance_decision_note,created_at')
          .order('created_at', { ascending: false })
          .limit(20));
      }
    });
  }

  function createReceptionFinanceRepository({ supabase } = {}) {
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('A ligação ao motor financeiro central não está disponível.');
    }

    async function call(name, args) {
      const { data, error } = await supabase.rpc(name, args);
      if (error) throw error;
      return data;
    }

    function requiredId(value, label) {
      const id = clean(value, 128);
      if (!id) throw new Error(label + ' é obrigatório.');
      return id;
    }

    function positiveAmount(value, label) {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error(label + ' deve ser superior a zero.');
      return amount;
    }

    function nonNegativeAmount(value, label) {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount < 0) throw new Error(label + ' não pode ser negativo.');
      return amount;
    }

    return Object.freeze({
      async createInvoice(input = {}) {
        const companyId = requiredId(input.companyId, 'Empresa');
        const documentType = requiredId(input.documentType, 'Tipo de documento');
        const seriesId = requiredId(input.seriesId, 'Série');
        const clientId = requiredId(input.clientId, 'Cliente');
        if (!Array.isArray(input.lines) || input.lines.length === 0) {
          throw new Error('O documento precisa de pelo menos uma linha.');
        }
        const lines = input.lines.map((line, index) => {
          const quantity = positiveAmount(line?.quantity, 'Quantidade da linha ' + (index + 1));
          const serviceId = clean(line?.serviceId, 128);
          const code = clean(line?.code, 80);
          const description = clean(line?.description, 240);
          const unitPrice = line?.unitPrice === undefined ? undefined : nonNegativeAmount(line.unitPrice, 'Preço unitário');
          const discount = line?.discount === undefined ? 0 : nonNegativeAmount(line.discount, 'Desconto');
          const taxRate = line?.taxRate === undefined ? undefined : nonNegativeAmount(line.taxRate, 'Taxa de imposto');
          if (!serviceId && (!code || !description || unitPrice === undefined)) {
            throw new Error('Cada linha deve indicar um serviço existente ou código, descrição e preço unitário.');
          }
          if (discount > 0 && unitPrice !== undefined && discount > quantity * unitPrice) {
            throw new Error('O desconto da linha não pode exceder o valor bruto.');
          }
          return {
            ...(serviceId ? { servico_id: serviceId } : {}),
            ...(code ? { codigo: code } : {}),
            ...(description ? { descricao: description } : {}),
            quantidade: quantity,
            ...(clean(line?.unit, 16) ? { unidade: clean(line.unit, 16) } : {}),
            ...(unitPrice !== undefined ? { preco_unitario: unitPrice } : {}),
            desconto: discount,
            ...(taxRate !== undefined ? { taxa_imposto: taxRate } : {}),
            ...(clean(line?.revenueAccount, 80) ? { conta_receita: clean(line.revenueAccount, 80) } : {})
          };
        });
        return call('ciadi_faturacao_criar_documento', {
          p_empresa_id: companyId,
          p_tipo_documento: documentType,
          p_serie_id: seriesId,
          p_cliente_id: clientId,
          p_paciente_id: clean(input.patientId, 128) || null,
          p_agendamento_id: clean(input.appointmentId, 128) || null,
          p_data_emissao: input.issueDate || new Date().toISOString(),
          p_data_vencimento: input.dueDate || null,
          p_observacoes: clean(input.observations, 1000) || null,
          p_linhas: lines
        });
      },
      async calculateInvoice(documentId) {
        return call('ciadi_faturacao_calcular_documento', {
          p_documento_id: requiredId(documentId, 'Documento')
        });
      },
      async issueInvoice(documentId) {
        return call('ciadi_faturacao_emitir_documento', {
          p_documento_id: requiredId(documentId, 'Documento')
        });
      },
      async registerPayment(input = {}) {
        const documentId = requiredId(input.documentId, 'Documento');
        const amount = positiveAmount(input.amount, 'Valor do pagamento');
        const method = requiredId(input.method, 'Método de pagamento');
        return call('finance_registar_pagamento', {
          p_documento_id: documentId,
          p_valor: amount,
          p_metodo: method,
          p_referencia: clean(input.reference, 120) || null,
          p_caixa_id: clean(input.cashboxId, 128) || null,
          p_observacoes: clean(input.notes, 1000) || null
        });
      },
      async openCashbox(input = {}) {
        return call('ciadi_abrir_caixa', {
          p_caixa_id: requiredId(input.cashboxId, 'Caixa'),
          p_saldo_inicial: nonNegativeAmount(input.openingBalance, 'Saldo inicial')
        });
      },
      async closeCashbox(input = {}) {
        return call('ciadi_fechar_caixa', {
          p_turno_id: requiredId(input.shiftId, 'Turno de caixa'),
          p_saldo_contado: nonNegativeAmount(input.countedBalance, 'Saldo contado'),
          p_justificacao: clean(input.justification, 1000) || null
        });
      },
      async registerCashMovement(input = {}) {
        const movementType = clean(input.type, 32);
        if (!['entrada', 'saida', 'receita', 'recebimento', 'despesa'].includes(movementType)) {
          throw new Error('Tipo de movimento de caixa inválido.');
        }
        return call('ciadi_registar_movimento_caixa', {
          p_caixa_id: requiredId(input.cashboxId, 'Caixa'),
          p_tipo: movementType,
          p_valor: positiveAmount(input.amount, 'Valor do movimento'),
          p_metodo_pagamento: clean(input.paymentMethod, 40) || null,
          p_descricao: clean(input.description, 500) || null,
          p_documento_id: clean(input.documentId, 128) || null,
          p_pagamento_id: clean(input.paymentId, 128) || null,
          p_categoria: clean(input.category, 80) || null
        });
      }
    });
  }

  function renderReceptionDocumentHeader({ identity = globalThis.CIADI_INSTITUTIONAL_IDENTITY, title, reference = '', date = '' } = {}) {
    if (!identity || typeof identity.getBrand !== 'function' || typeof identity.renderDocumentHeader !== 'function') {
      throw new Error('O serviço central de identidade documental CIADI não está disponível.');
    }
    const brand = identity.getBrand();
    if (!brand?.logoDataUrl || !/^data:image\/(png|jpeg|jpg);base64,/i.test(brand.logoDataUrl)) {
      throw new Error('O logótipo oficial CIADI incorporado não está disponível.');
    }
    return identity.renderDocumentHeader({ title, reference, date, logoUrl: brand.logoDataUrl });
  }


  function receptionMoney(value) {
    const amount = Number(value || 0);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' Kz'
      : '—';
  }

  function receptionRelation(value) {
    return Array.isArray(value) ? (value[0] || {}) : (value || {});
  }

  function buildReceptionInvoiceHtml({ document, lines = [], emitter = {}, identity } = {}) {
    const brandService = identity || globalThis.CIADI_INSTITUTIONAL_IDENTITY;
    if (!brandService || typeof brandService.getBrand !== 'function') {
      throw new Error('A identidade institucional CIADI não está disponível para compor a factura.');
    }
    const brand = brandService.getBrand();
    if (!brand?.logoDataUrl || !/^data:image\/(png|jpeg|jpg);base64,/i.test(brand.logoDataUrl)) {
      throw new Error('O logótipo oficial CIADI não está disponível para o documento.');
    }
    if (!document?.id || !document.document_no) {
      throw new Error('A factura não contém identificador e número documental.');
    }
    const client = receptionRelation(document.finance_clientes || document.cliente);
    const series = receptionRelation(document.finance_series || document.serie);
    const rows = (Array.isArray(lines) ? lines : []).map((line, index) => {
      const quantity = Number(line.quantidade || line.quantity || 0);
      const unitPrice = Number(line.preco_unitario || line.unit_price || 0);
      const discount = Number(line.desconto || line.discount || 0);
      const taxRate = Number(line.taxa_imposto || line.tax_rate || 0);
      const base = Math.max(0, quantity * unitPrice - discount);
      const tax = Number.isFinite(Number(line.imposto)) ? Number(line.imposto) : Math.round(base * taxRate) / 100;
      const total = Number.isFinite(Number(line.total_linha)) ? Number(line.total_linha) : base + tax;
      return '<tr><td>' + (index + 1) + '</td><td>' + esc(line.codigo || line.code || '') + '</td><td>' +
        esc(line.descricao || line.description || line.nome || 'Artigo/serviço') + '</td><td class="num">' +
        esc(quantity) + ' ' + esc(line.unidade || line.unit || 'UN') + '</td><td class="num">' +
        esc(receptionMoney(unitPrice)) + '</td><td class="num">' + esc(receptionMoney(discount)) +
        '</td><td class="num">' + esc(receptionMoney(total)) + '</td></tr>';
    }).join('');
    if (!rows) throw new Error('A factura não tem linhas para pré-visualizar.');
    const qrDataUrl = document.qr_data_url || document.verification_qr_data_url || document.agt_qr_data_url || null;
    const qr = typeof qrDataUrl === 'string' && /^data:image\//i.test(qrDataUrl)
      ? '<img alt="QR Code de autenticação" src="' + esc(qrDataUrl) + '" style="width:92px;height:92px;object-fit:contain"><small>Autenticação documental</small>'
      : '<div class="qr-pending"><strong>QR DE AUTENTICAÇÃO NÃO DISPONÍVEL</strong><span>O motor central ainda não devolveu um código verificável. Esta cópia não substitui o PDF oficial autenticado.</span></div>';
    const status = document.document_status === 'emitido' && document.fiscal_status === 'emitido'
      ? 'Emitido no motor financeiro central'
      : 'RASCUNHO — NÃO EMITIDO';
    return '<!doctype html><html lang="pt-AO"><head><meta charset="utf-8"><title>' + esc(document.document_no) +
      ' · CIADI</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#6f351f;font-size:10px;margin:0}.sheet{max-width:182mm;margin:auto}.head{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:4px solid #f58200;padding-bottom:12px}.logo{max-width:128px;max-height:66px;object-fit:contain}.issuer{font-size:9px;line-height:1.5}.docbox{border:1px solid #cbd5e1;padding:10px;text-align:right;min-width:175px}.docbox strong{display:block;font-size:17px;color:#6f351f;margin:4px 0}.status{font-size:8px;color:#64748b}.parties{display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;margin:14px 0}.parties b{display:block;color:#f58200;font-size:8px;text-transform:uppercase;margin-bottom:5px}.parties div{line-height:1.5}table{width:100%;border-collapse:collapse;font-size:9px}th,td{padding:7px 5px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#fff0df;color:#6f351f}.num{text-align:right;white-space:nowrap}.totals{width:280px;margin:14px 0 14px auto}.totals div{display:flex;justify-content:space-between;padding:5px;border-bottom:1px solid #e2e8f0}.grand{font-size:15px;font-weight:bold;border-top:2px solid #6f351f}.notes{border:1px solid #e2e8f0;padding:9px;margin-top:14px;white-space:pre-wrap}.foot{display:flex;justify-content:space-between;align-items:end;border-top:1px solid #cbd5e1;margin-top:22px;padding-top:10px;font-size:8px;color:#64748b}.qr-pending{width:135px;border:1px dashed #d97706;padding:8px;color:#92400e;text-align:center}.qr-pending strong{display:block;font-size:8px}.qr-pending span{display:block;font-size:7px;margin-top:5px}.copy-warning{background:#fff7ed;border:1px solid #fed7aa;padding:8px;margin:12px 0;font-size:8px;color:#9a3412}</style></head><body><main class="sheet">' +
      '<header class="head"><img class="logo" alt="Logótipo CIADI" src="' + esc(brand.logoDataUrl) + '"><div class="issuer"><b>' +
      esc(emitter.razao_social || brand.name || 'CENTRO INTEGRADO DE APOIO E DESENVOLVIMENTO INDIVIDUAL') + '</b><br>' +
      esc([emitter.morada, emitter.municipio, emitter.provincia].filter(Boolean).join(' · ')) + '<br>NIF: ' +
      esc(emitter.nif || '—') + ' · ' + esc(emitter.telefone || '') + '<br>' + esc(emitter.email || '') +
      '</div><div class="docbox"><span>' + esc(document.tipo_documento || 'Documento') + '</span><strong>' +
      esc(document.document_no) + '</strong><span>Emissão: ' + esc(document.data_emissao || '—') +
      '</span><span class="status">' + esc(status) + '</span></div></header>' +
      '<div class="copy-warning">Documento reproduzido a partir dos registos do motor financeiro CIADI. A autenticação QR e o arquivo digital central só podem ser confirmados quando o servidor disponibilizar o respectivo serviço.</div>' +
      '<section class="parties"><div><b>Cliente</b>' + esc(client.nome || client.nome_comercial || '—') +
      '<br>NIF: ' + esc(client.nif || '—') + '<br>' + esc(client.endereco || client.morada || '') +
      '<br>' + esc(client.email || '') + ' · ' + esc(client.telefone || '') + '</div><div><b>Dados do documento</b>' +
      'Série: ' + esc(series.codigo || document.documento_serie || '—') + '<br>Data de vencimento: ' +
      esc(document.data_vencimento || '—') + '<br>Estado fiscal: ' + esc(document.fiscal_status || 'pendente') +
      '<br>Estado do documento: ' + esc(document.document_status || '—') + '</div></section>' +
      '<table><thead><tr><th>#</th><th>Código</th><th>Descrição</th><th class="num">Qtd.</th><th class="num">Preço unit.</th><th class="num">Desconto</th><th class="num">Total</th></tr></thead><tbody>' +
      rows + '</tbody></table><section class="totals"><div><span>Subtotal</span><b>' + esc(receptionMoney(document.subtotal)) +
      '</b></div><div><span>Impostos</span><b>' + esc(receptionMoney(document.imposto)) +
      '</b></div><div class="grand"><span>Total</span><b>' + esc(receptionMoney(document.total)) +
      '</b></div></section>' + (document.observacoes ? '<section class="notes"><b>Observações</b><br>' + esc(document.observacoes) + '</section>' : '') +
      '<footer class="foot"><div>CIADI · Documento administrativo<br>Emitido/consultado através do sistema institucional.</div><div>' +
      qr + '</div></footer></main></body></html>';
  }

  function createReceptionInvoicePdfService({ supabase, desktop = globalThis.ciadiDesktop, identity = globalThis.CIADI_INSTITUTIONAL_IDENTITY } = {}) {
    if (typeof supabase?.from !== 'function') throw new Error('Ligação ao arquivo financeiro indisponível.');
    async function load(documentId, { requireIssued = false } = {}) {
      const id = clean(documentId, 128);
      if (!id) throw new Error('Identificador da factura obrigatório.');
      const [documentResult, linesResult, emitterResult] = await Promise.all([
        supabase.from('finance_documentos')
          .select('*,finance_clientes(nome,nif,email,telefone,endereco,cidade,provincia,pais),finance_series(codigo,nome)')
          .eq('id', id).single(),
        supabase.from('finance_documento_linhas').select('*').eq('documento_id', id).order('created_at'),
        supabase.from('finance_emitente_config').select('*').eq('ativo', true)
          .order('updated_at', { ascending: false }).limit(1).maybeSingle()
      ]);
      if (documentResult?.error) throw documentResult.error;
      if (linesResult?.error) throw linesResult.error;
      if (emitterResult?.error) throw emitterResult.error;
      if (!documentResult?.data) throw new Error('Factura não encontrada no arquivo financeiro.');
      const document = documentResult.data;
      if (requireIssued && (document.document_status !== 'emitido' || document.fiscal_status !== 'emitido')) {
        throw new Error('Só é possível exportar PDF de uma factura emitida e validada pelo motor central.');
      }
      const html = buildReceptionInvoiceHtml({
        document,
        lines: Array.isArray(linesResult?.data) ? linesResult.data : [],
        emitter: emitterResult?.data || {},
        identity
      });
      return Object.freeze({ document, html, lines: Object.freeze(linesResult?.data || []), emitter: emitterResult?.data || {} });
    }
    async function preview(documentId) {
      return load(documentId);
    }
    async function exportIssuedPdf(documentId) {
      const loaded = await load(documentId, { requireIssued: true });
      const { document, html } = loaded;
      if (typeof desktop?.documents?.renderPdf !== 'function' || typeof desktop?.documents?.exportIssuedPdf !== 'function') {
        throw new Error('A geração e exportação de PDF real exige a aplicação CIADI Desktop actualizada.');
      }
      const rendered = await desktop.documents.renderPdf({ html });
      const bytes = rendered instanceof Uint8Array ? rendered
        : Array.isArray(rendered) ? Uint8Array.from(rendered)
        : rendered?.data && Array.isArray(rendered.data) ? Uint8Array.from(rendered.data)
        : null;
      if (!bytes || bytes.length < 5 || bytes.length > 10485760 ||
          BufferSafePdfSignature(bytes) !== '%PDF-') {
        throw new Error('O serviço Desktop não devolveu bytes PDF válidos.');
      }
      const safeNumber = String(document.document_no || document.id).replace(/[^A-Za-z0-9_-]/g, '_');
      return desktop.documents.exportIssuedPdf({
        document: { id: document.id, status: 'issued', number: document.document_no },
        bytes,
        mimeType: 'application/pdf',
        filename: safeNumber + '.pdf'
      });
    }
    return Object.freeze({ preview, exportIssuedPdf });
  }

  function BufferSafePdfSignature(bytes) {
    return String.fromCharCode(...Array.from(bytes.slice(0, 5)));
  }

  function createReceptionRepository({ supabase } = {}) {
    if (!supabase || typeof supabase.schema !== 'function') {
      throw new Error('A ligação ao serviço de Recepção não está disponível.');
    }
    const db = supabase.schema('ciadi_reception');
    if (!db || typeof db.rpc !== 'function') {
      throw new Error('O serviço de Recepção CIADI não está exposto nesta ligação.');
    }

    async function call(name, args) {
      const { data, error } = await db.rpc(name, args);
      if (error) throw error;
      return data;
    }

    return Object.freeze({
      async searchAppointments({ term, dateFrom, dateTo } = {}) {
        const needle = clean(term, 80).replace(/[%,_(),\\]/g, ' ').replace(/\s+/g, ' ').trim();
        if (needle.length < 2) throw new Error('Introduza pelo menos dois caracteres para pesquisar o utente.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom || '') || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo || '')) {
          throw new Error('Seleccione um intervalo de datas válido.');
        }
        if (dateFrom > dateTo) throw new Error('A data inicial não pode ser posterior à data final.');
        const { data, error } = await db.rpc('reception_search_appointments', {
          p_search_term: needle,
          p_date_from: dateFrom,
          p_date_to: dateTo
        });
        if (error) throw error;
        return Object.freeze(Array.isArray(data) ? data : []);
      },
      async getDashboard(poloCode) {
        if (poloCode && !POLOS.includes(poloCode)) throw new Error('Polo inválido.');
        return call('reception_get_dashboard', { p_polo_code: poloCode || null });
      },
      async getDestinations() {
        const rows = await call('reception_get_destinations', {});
        return Object.freeze((Array.isArray(rows) ? rows : []).filter(row =>
          row && clean(row.id, 128) && clean(row.name, 80)
        ).map(row => Object.freeze({ id: clean(row.id, 128), name: clean(row.name, 80) })));
      },
      async routeVisit(visitId, specialtyId, actorId) {
        if (!clean(visitId, 128) || !clean(specialtyId, 128) || !clean(actorId, 128)) {
          throw new Error('Atendimento, destino e sessão autenticada são obrigatórios.');
        }
        return call('reception_route_visit', {
          p_visit_id: clean(visitId, 128),
          p_destination_specialty_id: clean(specialtyId, 128),
          p_actor_id: clean(actorId, 128)
        });
      },
      async confirmReferral(visitId, actorId) {
        if (!clean(visitId, 128) || !clean(actorId, 128)) {
          throw new Error('Atendimento e sessão autenticada são obrigatórios.');
        }
        return call('reception_confirm_referral', {
          p_visit_id: clean(visitId, 128),
          p_actor_id: clean(actorId, 128)
        });
      },
      async returnReferral(visitId, reason, actorId) {
        const note = clean(reason, 240);
        if (!clean(visitId, 128) || !clean(actorId, 128)) {
          throw new Error('Atendimento e sessão autenticada são obrigatórios.');
        }
        if (note.length < 3) throw new Error('Indique o motivo da devolução do encaminhamento.');
        return call('reception_return_referral', {
          p_visit_id: clean(visitId, 128),
          p_reason: note,
          p_actor_id: clean(actorId, 128)
        });
      },
      async registerArrival(input, actorId) {
        const checked = validateVisitInput(input);
        if (!checked.valid) throw new Error(checked.errors.join(' '));
        if (!clean(actorId, 128)) throw new Error('Sessão autenticada necessária.');
        const v = checked.value;
        return call('reception_register_arrival', {
          p_visit_type: v.visitType,
          p_appointment_id: v.appointmentId,
          p_patient_id: v.patientId,
          p_display_name: v.displayName,
          p_purpose: v.purpose,
          p_polo_code: v.poloCode,
          p_actor_id: clean(actorId, 128)
        });
      },
      async transitionVisit(visitId, current, next, actorId) {
        const checked = transitionVisitStatus(current, next);
        if (!checked.valid) throw new Error(checked.errors.join(' '));
        if (!clean(visitId, 128) || !clean(actorId, 128)) throw new Error('Identificador do atendimento e sessão autenticada são obrigatórios.');
        return call('reception_transition_visit', {
          p_visit_id: clean(visitId, 128),
          p_from_status: current,
          p_to_status: next,
          p_actor_id: clean(actorId, 128)
        });
      },
      async registerVisitor(input, actorId) {
        const checked = validateVisitorInput(input);
        if (!checked.valid) throw new Error(checked.errors.join(' '));
        if (!clean(actorId, 128)) throw new Error('Sessão autenticada necessária.');
        return call('reception_register_visitor', {
          p_display_name: checked.value.displayName,
          p_purpose: checked.value.purpose,
          p_host_department: checked.value.hostDepartment,
          p_polo_code: checked.value.poloCode,
          p_actor_id: clean(actorId, 128)
        });
      },
      async closeVisitor(visitorId, actorId) {
        if (!clean(visitorId, 128) || !clean(actorId, 128)) throw new Error('Identificador do visitante e sessão autenticada são obrigatórios.');
        return call('reception_close_visitor', {
          p_visitor_id: clean(visitorId, 128),
          p_actor_id: clean(actorId, 128)
        });
      }
    });
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function renderBusinessPanel(snapshot = {}) {
    const cards = [
      { key: 'services', title: 'Serviços e preços', render: rows => rows.slice(0, 5).map(row => '<div class="flex justify-between gap-2 py-1 border-b text-sm"><span>' + esc(row.nome) + '</span><strong>' + esc(row.preco_base) + ' Kz</strong></div>').join('') },
      { key: 'cashboxes', title: 'Caixas', render: rows => rows.slice(0, 5).map(row => '<div class="flex justify-between gap-2 py-1 border-b text-sm"><span>' + esc(row.nome || row.codigo) + '</span><strong>' + esc(row.estado || '—') + '</strong></div>').join('') },
      { key: 'documents', title: 'Documentos recentes', render: rows => rows.slice(0, 5).map(row => '<div class="flex justify-between gap-2 py-1 border-b text-sm"><span>' + esc(row.document_no || row.tipo_documento) + '</span><strong>' + esc(row.document_status || '—') + '</strong></div>').join('') },
      { key: 'stock', title: 'Stock e inventário', render: rows => rows.slice(0, 5).map(row => '<div class="flex justify-between gap-2 py-1 border-b text-sm"><span>' + esc(row.item_name) + ' <small class="text-slate-500">' + esc(row.warehouse_name) + '</small></span><strong class="' + (row.below_minimum ? 'text-red-700' : '') + '">' + esc(row.quantity_on_hand) + ' ' + esc(row.unit_of_measure) + '</strong></div>').join('') },
      { key: 'requests', title: 'Requisições de compra', render: rows => rows.slice(0, 5).map(row => '<div class="flex justify-between gap-2 py-1 border-b text-sm"><span>' + esc(row.request_number || row.id) + '</span><strong>' + esc(row.status) + '</strong></div>').join('') }
    ];
    return '<section class="card p-5 space-y-4" data-reception-business-integration>' +
      '<div><h3 class="font-black text-lg">Facturação, caixa e aprovisionamento</h3><p class="text-xs text-slate-500">Consulta das estruturas centrais existentes. As operações financeiras têm formulários próprios e continuam sujeitas às autorizações e validações dos respectivos motores.</p></div>' +
      '<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">' +
      cards.map(card => {
        const result = snapshot[card.key];
        let content = '<p class="text-xs text-slate-500">A carregar dados…</p>';
        if (result && result.error) content = '<p class="text-xs text-amber-700">Sem acesso autorizado ou serviço indisponível.</p>';
        else if (result && result.rows.length) content = card.render(result.rows);
        else if (result) content = '<p class="text-xs text-slate-500">Sem registos disponíveis.</p>';
        return '<article class="rounded-xl border p-3"><h4 class="font-bold text-sm mb-2">' + card.title + '</h4>' + content + '</article>';
      }).join('') +
      '</div></section>';
  }

  function renderReceptionFinancePanel(snapshot = {}) {
    const list = key => Array.isArray(snapshot[key]) ? snapshot[key] : [];
    const clients = list('clients');
    const types = list('documentTypes');
    const series = list('series');
    const services = list('services');
    const cashboxes = list('cashboxes');
    const documents = list('documents');
    const shifts = list('shifts');
    const option = (value, label) => '<option value="' + esc(value) + '">' + esc(label) + '</option>';
    const issuedDocuments = documents.filter(row => row.fiscal_status === 'emitido' && row.document_status === 'emitido');
    const editableDocuments = documents.filter(row => ['em_edicao', 'rascunho', 'draft'].includes(row.document_status));
    const brand = globalThis.CIADI_INSTITUTIONAL_IDENTITY?.getBrand?.() || null;
    const logo = brand?.logoDataUrl ? '<img src="' + esc(brand.logoDataUrl) + '" alt="Logótipo CIADI" class="h-10 w-auto object-contain">' : '<strong class="text-orange">CIADI</strong>';
    return '<section class="card p-5 space-y-4" data-reception-finance-operations>' +
      '<header class="flex items-center gap-3">' + logo + '<div><h3 class="font-black text-lg">Operações de facturação e caixa</h3><p class="text-xs text-slate-500">Formulários ligados aos motores financeiros centrais; todas as decisões são validadas pelo servidor.</p></div></header>' +
      '<div class="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><strong>Controlo de acesso:</strong> a Recepção ainda não tem capacidade financeira homologada. As operações protegidas serão recusadas pelo servidor até à fase própria de permissões. Não existe qualquer autorização local ou contorno de RLS.</div>' +
      '<div class="grid xl:grid-cols-2 gap-4">' +
      '<form data-reception-invoice-form class="rounded-xl border p-4 space-y-3">' +
        '<h4 class="font-bold">Criar documento em edição</h4>' +
        '<label class="block text-xs font-semibold">Cliente<select name="clientId" required class="mt-1 w-full border rounded-lg p-2">' + option('', 'Seleccione o cliente') + clients.map(row => option(row.id, row.nome_comercial || row.nome || row.nif || row.id)).join('') + '</select></label>' +
        '<div class="grid grid-cols-2 gap-2"><label class="block text-xs font-semibold">Tipo de documento<select name="documentType" data-invoice-document-type required class="mt-1 w-full border rounded-lg p-2">' + option('', 'Seleccione') + types.map(row => option(row.codigo, row.nome + ' (' + row.codigo + ')')).join('') + '</select></label>' +
        '<label class="block text-xs font-semibold">Série<select name="seriesId" data-invoice-series required class="mt-1 w-full border rounded-lg p-2">' + option('', 'Seleccione o tipo primeiro') + series.map(row => option(row.id, row.codigo + ' · ' + (row.nome || row.ano || ''))).join('') + '</select></label></div>' +
        '<label class="block text-xs font-semibold">Serviço<select name="serviceId" required class="mt-1 w-full border rounded-lg p-2">' + option('', 'Seleccione o serviço') + services.map(row => option(row.id, row.nome + ' · ' + Number(row.preco_base || 0).toLocaleString('pt-PT') + ' Kz')).join('') + '</select></label>' +
        '<div class="grid grid-cols-2 gap-2"><label class="block text-xs font-semibold">Quantidade<input name="quantity" type="number" min="0.001" step="0.001" value="1" required class="mt-1 w-full border rounded-lg p-2"></label><label class="block text-xs font-semibold">Vencimento<input name="dueDate" type="date" class="mt-1 w-full border rounded-lg p-2"></label></div>' +
        '<label class="block text-xs font-semibold">Observações<textarea name="observations" maxlength="1000" rows="2" class="mt-1 w-full border rounded-lg p-2"></textarea></label>' +
        '<p data-reception-message role="status" class="text-xs text-amber-800"></p><button type="submit" class="rounded-lg bg-orange text-white font-bold px-4 py-2">Criar rascunho</button>' +
      '</form>' +
      '<div class="space-y-3">' +
        '<form data-reception-cashbox-open class="rounded-xl border p-4 space-y-3"><h4 class="font-bold">Abertura de caixa</h4><label class="block text-xs font-semibold">Caixa<select name="cashboxId" required class="mt-1 w-full border rounded-lg p-2">' + option('', 'Seleccione o caixa') + cashboxes.map(row => option(row.id, (row.codigo || '') + ' · ' + (row.nome || row.id) + ' (' + (row.estado || 'estado não indicado') + ')')).join('') + '</select></label><label class="block text-xs font-semibold">Saldo inicial (Kz)<input name="openingBalance" type="number" min="0" step="0.01" required value="0" class="mt-1 w-full border rounded-lg p-2"></label><p data-reception-message role="status" class="text-xs text-amber-800"></p><button type="submit" class="rounded-lg border px-4 py-2 font-bold">Abrir caixa</button></form>' +
        '<form data-reception-cashbox-close class="rounded-xl border p-4 space-y-3"><h4 class="font-bold">Fecho de caixa</h4><label class="block text-xs font-semibold">Turno aberto<select name="shiftId" required class="mt-1 w-full border rounded-lg p-2">' + option('', 'Seleccione o turno') + shifts.map(row => option(row.id, 'Turno ' + row.id.slice(0, 8) + ' · ' + row.aberto_em)).join('') + '</select></label><label class="block text-xs font-semibold">Saldo contado (Kz)<input name="countedBalance" type="number" min="0" step="0.01" required class="mt-1 w-full border rounded-lg p-2"></label><label class="block text-xs font-semibold">Justificação de diferença<textarea name="justification" maxlength="1000" rows="2" class="mt-1 w-full border rounded-lg p-2"></textarea></label><p data-reception-message role="status" class="text-xs text-amber-800"></p><button type="submit" class="rounded-lg border px-4 py-2 font-bold" ' + (shifts.length ? '' : 'disabled') + '>Fechar turno</button></form>' +
      '</div></div>' +
      '<form data-reception-payment-form class="rounded-xl border p-4 space-y-3"><h4 class="font-bold">Registo de recebimento</h4><p class="text-xs text-amber-800">Temporariamente bloqueado: a função central de pagamentos exige document_status = N, enquanto a função de emissão actualmente grava document_status = emitido. Esta incompatibilidade deve ser corrigida e validada no motor central antes de activar recebimentos.</p><fieldset disabled class="grid md:grid-cols-4 gap-2 opacity-60"><select name="documentId" required class="border rounded-lg p-2">' + option('', 'Documento emitido') + issuedDocuments.map(row => option(row.id, row.document_no + ' · ' + row.total + ' Kz')).join('') + '</select><input name="amount" type="number" min="0.01" step="0.01" placeholder="Valor (Kz)" class="border rounded-lg p-2"><select name="method" class="border rounded-lg p-2">' + ['numerario','transferencia','tpa','deposito','multicaixa'].map(x => option(x, x)).join('') + '</select><select name="cashboxId" class="border rounded-lg p-2">' + option('', 'Caixa (opcional)') + cashboxes.map(row => option(row.id, row.nome || row.codigo || row.id)).join('') + '</select></fieldset><button type="submit" disabled class="rounded-lg border px-4 py-2 font-bold opacity-50">Registar pagamento — bloqueado</button></form>' +
      '<div class="rounded-xl border p-4"><h4 class="font-bold mb-2">Documentos em edição</h4>' + (editableDocuments.length ? editableDocuments.map(row => '<div class="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"><span>' + esc(row.document_no || row.id) + ' · ' + esc(row.tipo_documento) + '</span><div class="flex gap-2"><button type="button" data-invoice-preview="' + esc(row.id) + '" class="border rounded-lg px-3 py-1">Pré-visualizar</button><button type="button" data-invoice-calculate="' + esc(row.id) + '" class="border rounded-lg px-3 py-1">Calcular</button><button type="button" disabled title="A emissão oficial depende do QR e do arquivo documental central." class="rounded-lg border px-3 py-1 opacity-50 cursor-not-allowed">Emitir — pendente de autenticação</button></div></div>').join('') : '<p class="text-xs text-slate-500">Não existem documentos em edição visíveis.</p>') + '</div>' +
      '<div class="rounded-xl border p-4"><h4 class="font-bold mb-2">Documentos emitidos — PDF</h4>' + (issuedDocuments.length ? issuedDocuments.map(row => '<div class="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"><span>' + esc(row.document_no || row.id) + ' · ' + esc(row.tipo_documento) + ' · ' + esc(receptionMoney(row.total)) + '</span><div class="flex gap-2"><button type="button" data-invoice-preview="' + esc(row.id) + '" class="border rounded-lg px-3 py-1">Pré-visualizar A4</button><button type="button" data-invoice-pdf-export="' + esc(row.id) + '" class="rounded-lg bg-orange text-white px-3 py-1">Guardar PDF</button></div></div>').join('') : '<p class="text-xs text-slate-500">Não existem facturas emitidas e validadas visíveis.</p>') + '<p class="text-xs text-amber-800 mt-3">A pré-visualização é composta com os dados reais do motor financeiro. A exportação gera PDF A4 no CIADI Desktop e guarda-o no computador. O QR oficial e o arquivo digital central continuam dependentes da integração do servidor.</p></div>' +
      '<section data-invoice-preview-host class="hidden"></section>' +
      '</section>';
  }

  function create({ root: container, navigate, notify = () => {}, supabase, actorId, poloCode, companyId: configuredCompanyId } = {}) {
    if (!container || typeof navigate !== 'function') {
      throw new Error('O módulo Recepção necessita do contentor e da navegação do Dashboard.');
    }

    let repository = null;
    let dashboard = null;
    let destinations = [];
    let activePolo = POLOS.includes(poloCode) ? poloCode : null;
    let businessRepository = null;
    let financeRepository = null;
    let activeCompanyId = clean(configuredCompanyId, 128) || null;
    let businessSnapshot = { services: null, clients: null, documentTypes: null, series: null, cashboxes: null, documents: null, shifts: null, stock: null, requests: null };

    function renderUnavailable(error) {
      container.innerHTML = `
        <section class="card p-6 space-y-3">
          <span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Recepção</span>
          <h2 class="text-2xl font-black">Serviço de Recepção</h2>
          <p class="text-slate-600">O motor está preparado, mas a ligação ao serviço de dados ainda não está homologada.</p>
          <p class="text-sm text-amber-700">${esc(error?.message || 'Serviço indisponível.')}</p>
          <p class="text-xs text-slate-500">Nenhum atendimento ou visitante foi registado. A activação depende da proposta de base de dados e da fase de permissões.</p>
          <button type="button" data-reception-retry class="bg-orange text-white rounded-xl px-4 py-2 font-bold">Tentar novamente</button>
        </section>`;
    }

    function renderDashboard() {
      const data = dashboard || {};
      const visits = Array.isArray(data.visits) ? data.visits : [];
      const visitors = Array.isArray(data.visitors) ? data.visitors : [];
      const summary = data.summary || summarizeReception(visits);
      const brand = globalThis.CIADI_INSTITUTIONAL_IDENTITY?.getBrand?.() || null;
      container.innerHTML = `
        <section class="space-y-5">
          <header class="card p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div class="flex items-center gap-3">${brand?.logoDataUrl ? `<img src="${esc(brand.logoDataUrl)}" alt="Logótipo CIADI" class="h-14 w-auto object-contain">` : ""}<div><span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Atendimento institucional</span>
                <h2 class="text-2xl font-black mt-1">Acolhimento e Recepção</h2></div></div>
                <p class="text-sm text-slate-500 mt-2">Gestão de chegadas, fila de espera, visitantes e encaminhamentos.</p>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button type="button" data-reception-form="arrival" class="bg-orange text-white rounded-xl px-4 py-2 font-bold">Registar chegada</button>
                <button type="button" data-reception-form="visitor" class="border rounded-xl px-4 py-2 font-bold">Registar visitante</button>
                <button type="button" data-reception-refresh class="border rounded-xl px-4 py-2">Actualizar</button>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <span class="font-semibold">Polo:</span>
              <select data-reception-polo class="border rounded-lg px-3 py-2">
                <option value="">Todos os polos</option>
                ${POLOS.map(code => `<option value="${code}" ${activePolo === code ? 'selected' : ''}>${POLO_LABELS[code]}</option>`).join('')}
              </select>
            </div>
          </header>
          <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
            ${[
              ['Atendimentos', summary.total || 0],
              ['Em espera', summary.waiting || 0],
              ['Em atendimento', summary.inService || 0],
              ['Tempo médio de espera', (summary.averageWaitMinutes || 0) + ' min']
            ].map(([label, value]) => `<article class="card p-4"><p class="text-sm text-slate-500">${label}</p><p class="text-2xl font-black mt-1">${esc(value)}</p></article>`).join('')}
          </div>
          ${renderBusinessPanel(businessSnapshot)}
          ${renderReceptionFinancePanel({
            clients: businessSnapshot.clients?.rows,
            documentTypes: businessSnapshot.documentTypes?.rows,
            series: businessSnapshot.series?.rows,
            services: businessSnapshot.services?.rows,
            cashboxes: businessSnapshot.cashboxes?.rows,
            documents: businessSnapshot.documents?.rows,
            shifts: businessSnapshot.shifts?.rows
          })}
          <section class="card p-5" data-reception-call-panel>
            <div class="flex items-center justify-between gap-3 mb-3">
              <div><h3 class="font-black text-lg">Painel de chamadas</h3><p class="text-xs text-slate-500">Pré-visualização pública: apenas senhas, polo e destino.</p></div>
              <span class="text-xs text-slate-500">Sem dados pessoais</span>
            </div>
            ${(() => {
              const panel = buildPublicCallPanelModel(visits);
              return `<div class="grid md:grid-cols-2 gap-3">
                <div class="rounded-xl bg-slate-50 border p-4">
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Em chamada</p>
                  ${panel.called.length ? panel.called.map(ticket => `<div class="flex items-center justify-between gap-2 py-2 border-b last:border-0"><strong class="text-2xl text-orange">${esc(ticket.ticketLabel)}</strong><span class="text-sm text-slate-600">${esc(ticket.poloLabel)} · ${esc(ticket.destination)}</span></div>`).join('') : '<p class="text-sm text-slate-500">Nenhuma senha chamada.</p>'}
                </div>
                <div class="rounded-xl bg-slate-50 border p-4">
                  <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Próxima senha</p>
                  ${panel.next ? `<strong class="text-3xl text-orange">${esc(panel.next.ticketLabel)}</strong><p class="text-sm text-slate-600 mt-1">${esc(panel.next.poloLabel)} · ${esc(panel.next.destination)}</p>` : '<p class="text-sm text-slate-500">Sem utentes em espera.</p>'}
                </div>
              </div>`;
            })()}
          </section>
          <section class="card p-5">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div><h3 class="font-black text-lg">Fila de atendimento</h3><p class="text-xs text-slate-500">Registos operacionais do dia, sem exposição de notas clínicas.</p></div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-500">${visits.length} registo(s)</span>
                ${visits.some(row => row.status === 'waiting') ? '<button type="button" data-reception-call-next class="bg-orange text-white rounded-lg px-3 py-2 text-xs font-bold">Chamar próximo</button>' : ''}
              </div>
            </div>
            ${visits.length ? `
              <div class="overflow-x-auto"><table class="w-full text-sm">
                <thead><tr class="text-left border-b"><th class="py-2">Senha</th><th>Hora</th><th>Responsável</th><th>Finalidade</th><th>Polo</th><th>Estado</th><th>Destino do serviço</th><th>Acção</th></tr></thead>
                <tbody>${visits.map(visit => `
                  <tr class="border-b">
                    <td class="py-3 font-black text-orange">${esc(visit.polo_code === 'talatona' ? 'TAL' : 'JDR')} #${esc(String(visit.ticket_number || '—').padStart(3, '0'))}</td><td>${esc(visit.arrived_at ? new Date(visit.arrived_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—')}</td>
                    <td class="font-semibold">${esc(visit.display_name)}</td>
                    <td>${esc(visit.purpose)}</td>
                    <td>${esc(POLO_LABELS[visit.polo_code] || visit.polo_code || '—')}</td>
                    <td><span>${esc(STATUS_LABELS[visit.status] || visit.status)}</span>${visit.referral_status ? `<span class="block text-xs mt-1 ${visit.referral_status === 'accepted' ? 'text-green-700' : visit.referral_status === 'returned' ? 'text-red-700' : 'text-amber-700'}">Encaminhamento: ${visit.referral_status === 'pending' ? 'Pendente de confirmação' : visit.referral_status === 'accepted' ? 'Recebido pelo serviço' : 'Devolvido'}</span>` : ''}</td>
                    <td>
                      ${['waiting', 'in_service'].includes(visit.status) ? `<div class="flex flex-wrap items-center gap-2">
                        <select data-route-destination="${esc(visit.id)}" class="border rounded-lg px-2 py-1 text-xs" aria-label="Destino de atendimento">
                          <option value="">Seleccionar serviço</option>
                          ${destinations.map(item => `<option value="${esc(item.id)}" ${visit.destination_specialty_id === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
                        </select>
                        <button type="button" data-visit-route="${esc(visit.id)}" class="text-orange font-bold text-xs">Encaminhar</button>
                      </div>` : esc(visit.destination_service || '—')}
                    </td>
                    <td class="space-y-2">
                      ${visit.status === 'waiting' ? `<button data-visit-action="in_service" data-visit-id="${esc(visit.id)}" class="text-orange font-bold">Iniciar</button>` : visit.status === 'in_service' ? `<button data-visit-action="completed" data-visit-id="${esc(visit.id)}" class="text-orange font-bold">Concluir</button>` : ''}
                      ${visit.referral_status === 'pending' ? `<div class="flex flex-col gap-2 min-w-40">
                        <button type="button" data-referral-confirm="${esc(visit.id)}" class="rounded-lg bg-green-700 text-white px-3 py-2 text-xs font-bold">Confirmar recepção</button>
                        <label class="text-xs text-slate-600">Motivo da devolução
                          <input data-referral-return-reason="${esc(visit.id)}" maxlength="240" minlength="3" class="border rounded-lg px-2 py-1 w-full mt-1" placeholder="Indique o motivo">
                        </label>
                        <button type="button" data-referral-return="${esc(visit.id)}" class="rounded-lg border border-red-300 text-red-700 px-3 py-2 text-xs font-bold">Devolver encaminhamento</button>
                      </div>` : ''}
                      ${visit.status !== 'waiting' && visit.status !== 'in_service' && visit.referral_status !== 'pending' ? '—' : ''}
                    </td>
                  </tr>`).join('')}</tbody>
              </table></div>` : '<p class="text-sm text-slate-500 py-5">Não existem chegadas registadas para o filtro seleccionado.</p>'}
          </section>
          <section class="card p-5">
            <h3 class="font-black text-lg mb-3">Áreas institucionais integradas</h3>
            <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
              ${ROUTES.map(route => `<button type="button" data-reception-route="${route.id}" class="border rounded-xl p-3 text-left font-semibold hover:border-orange-400">${route.label}<span class="block text-xs font-normal text-slate-500 mt-1">Abrir área autorizada</span></button>`).join('')}
            </div>
          </section>
          <section class="card p-5">
            <h3 class="font-black text-lg mb-3">Visitantes no centro</h3>
            ${visitors.length ? `
              <div class="overflow-x-auto"><table class="w-full text-sm">
                <thead><tr class="text-left border-b"><th class="py-2">Entrada</th><th>Visitante</th><th>Destino</th><th>Finalidade</th><th>Polo</th><th>Acção</th></tr></thead>
                <tbody>${visitors.map(visitor => `
                  <tr class="border-b"><td class="py-3">${esc(visitor.entered_at ? new Date(visitor.entered_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—')}</td>
                  <td class="font-semibold">${esc(visitor.display_name)}</td><td>${esc(visitor.host_department)}</td><td>${esc(visitor.purpose)}</td>
                  <td>${esc(POLO_LABELS[visitor.polo_code] || visitor.polo_code || '—')}</td>
                  <td><button data-visitor-exit="${esc(visitor.id)}" class="text-orange font-bold">Registar saída</button></td></tr>`).join('')}</tbody>
              </table></div>` : '<p class="text-sm text-slate-500 py-4">Não existem visitantes dentro do centro neste momento.</p>'}
          </section>
        </section>`;
    }

    let appointmentResults = [];
    let selectedAppointment = null;
    let appointmentSearch = { term: '', dateFrom: '', dateTo: '' };

    function renderArrivalForm() {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Luanda' });
      const dateFrom = appointmentSearch.dateFrom || today;
      const dateTo = appointmentSearch.dateTo || today;
      container.innerHTML = `
        <section class="card p-6 space-y-5">
          <div class="flex items-center justify-between gap-3"><div><span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Recepção</span><h2 class="text-2xl font-black">Registar chegada</h2></div><button data-reception-home class="border rounded-lg px-3 py-2">Voltar</button></div>
          <section class="rounded-xl border p-4 space-y-3">
            <h3 class="font-bold">Localizar marcação existente</h3>
            <form data-reception-appointment-search class="grid md:grid-cols-4 gap-3">
              <label class="text-sm font-semibold md:col-span-2">Nome ou código do utente<input name="term" required minlength="2" maxlength="80" value="${esc(appointmentSearch.term)}" class="block w-full border rounded-lg p-2 mt-1" placeholder="Pesquisar nome ou código"></label>
              <label class="text-sm font-semibold">Data inicial<input name="dateFrom" type="date" required value="${esc(dateFrom)}" class="block w-full border rounded-lg p-2 mt-1"></label>
              <label class="text-sm font-semibold">Data final<input name="dateTo" type="date" required value="${esc(dateTo)}" class="block w-full border rounded-lg p-2 mt-1"></label>
              <div class="md:col-span-4"><button type="submit" class="border border-orange text-orange rounded-lg px-4 py-2 font-bold">Pesquisar agenda</button></div>
            </form>
            <div data-reception-appointment-results aria-live="polite">
              ${appointmentResults.length ? appointmentResults.map(row => `<button type="button" data-appointment-select="${esc(row.id)}" class="w-full text-left border rounded-lg p-3 mt-2 hover:border-orange-400">
                <span class="font-bold">${esc(row.patient_name)}</span><span class="block text-sm text-slate-600">${esc(row.responsible_name || 'Responsável não indicado')} • ${esc(new Date(row.data_hora).toLocaleString('pt-PT'))}</span>
                <span class="block text-xs text-slate-500">${esc(row.estado)} • ${esc(row.tipo)} • ${esc(row.id === selectedAppointment?.id ? 'Seleccionada' : 'Seleccionar marcação')}</span>
              </button>`).join('') : '<p class="text-sm text-slate-500">Pesquise para localizar uma marcação. Não é necessário introduzir identificadores manualmente.</p>'}
            </div>
          </section>
          ${selectedAppointment ? `<div class="rounded-xl bg-orange-50 border border-orange-200 p-3 text-sm"><strong>Marcação seleccionada:</strong> ${esc(selectedAppointment.patient_name)} — ${esc(new Date(selectedAppointment.data_hora).toLocaleString('pt-PT'))}</div>` : ''}
          <form data-reception-arrival-form class="grid md:grid-cols-2 gap-4">
            <label class="text-sm font-semibold">Tipo de chegada<select name="visitType" required class="block w-full border rounded-xl p-3 mt-1"><option value="appointment" ${selectedAppointment ? 'selected' : ''}>Com marcação</option><option value="walk_in">Sem marcação</option></select></label>
            <label class="text-sm font-semibold">Polo<select name="poloCode" required class="block w-full border rounded-xl p-3 mt-1">${POLOS.map(code => `<option value="${code}" ${activePolo === code ? 'selected' : ''}>${POLO_LABELS[code]}</option>`).join('')}</select></label>
            <input type="hidden" name="appointmentId" value="${esc(selectedAppointment?.id || '')}">
            <input type="hidden" name="patientId" value="${esc(selectedAppointment?.paciente_id || '')}">
            <label class="text-sm font-semibold">Nome do responsável presente<input name="displayName" required maxlength="120" value="${esc(selectedAppointment?.responsible_name || '')}" class="block w-full border rounded-xl p-3 mt-1"></label>
            <label class="text-sm font-semibold">Finalidade<input name="purpose" required maxlength="160" value="${esc(selectedAppointment ? 'Atendimento agendado' : '')}" class="block w-full border rounded-xl p-3 mt-1" placeholder="Ex.: consulta agendada, pedido de informação"></label>
            <p class="md:col-span-2 text-xs text-slate-500">A recepção consulta apenas os dados necessários à identificação da marcação. Não introduza notas clínicas.</p>
            <div class="md:col-span-2 flex items-center gap-3"><button class="bg-orange text-white rounded-xl px-4 py-2 font-bold" type="submit">Confirmar chegada</button><span data-reception-message class="text-sm text-slate-500"></span></div>
          </form>
        </section>`;
    }

    function renderVisitorForm() {
      container.innerHTML = `
        <section class="card p-6">
          <div class="flex items-center justify-between gap-3"><div><span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Controlo de entradas</span><h2 class="text-2xl font-black">Registar visitante</h2></div><button data-reception-home class="border rounded-lg px-3 py-2">Voltar</button></div>
          <form data-reception-visitor-form class="grid md:grid-cols-2 gap-4 mt-5">
            <label class="text-sm font-semibold">Nome do visitante<input name="displayName" required maxlength="120" class="block w-full border rounded-xl p-3 mt-1"></label>
            <label class="text-sm font-semibold">Polo<select name="poloCode" required class="block w-full border rounded-xl p-3 mt-1">${POLOS.map(code => `<option value="${code}" ${activePolo === code ? 'selected' : ''}>${POLO_LABELS[code]}</option>`).join('')}</select></label>
            <label class="text-sm font-semibold">Serviço de destino<input name="hostDepartment" required maxlength="100" class="block w-full border rounded-xl p-3 mt-1" placeholder="Ex.: Administração"></label>
            <label class="text-sm font-semibold">Finalidade<input name="purpose" required maxlength="160" class="block w-full border rounded-xl p-3 mt-1"></label>
            <p class="md:col-span-2 text-xs text-slate-500">O módulo não recolhe número de Bilhete de Identidade ou outros identificadores documentais nesta fase.</p>
            <div class="md:col-span-2 flex items-center gap-3"><button class="bg-orange text-white rounded-xl px-4 py-2 font-bold" type="submit">Registar entrada</button><span data-reception-message class="text-sm text-slate-500"></span></div>
          </form>
        </section>`;
    }

    async function loadBusinessSnapshot() {
      if (!businessRepository) businessRepository = createReceptionBusinessRepository({ supabase });
      let company = clean(configuredCompanyId, 128);
      if (!company) {
        try {
          const { data, error } = await supabase.from('finance_empresas')
            .select('id')
            .eq('ativo', true)
            .eq('empresa_principal', true)
            .maybeSingle();
          if (error) throw error;
          company = clean(data?.id, 128);
        } catch (error) {
          businessSnapshot.services = { rows: [], error };
          businessSnapshot.cashboxes = { rows: [], error };
          businessSnapshot.documents = { rows: [], error };
        }
      }
      activeCompanyId = company || null;
      if (!company && !businessSnapshot.services?.error) {
        const missingCompany = new Error('Empresa principal não identificada; consulta financeira bloqueada.');
        for (const key of ['services', 'clients', 'cashboxes', 'documents', 'series']) businessSnapshot[key] = { rows: [], error: missingCompany };
      }
      const tasks = [
        ['services', () => company ? businessRepository.getActiveServices(company) : Promise.resolve([])],
        ['clients', () => company ? businessRepository.getActiveClients(company) : Promise.resolve([])],
        ['documentTypes', () => businessRepository.getActiveDocumentTypes()],
        ['cashboxes', () => company ? businessRepository.getCashboxes(company) : Promise.resolve([])],
        ['documents', () => company ? businessRepository.getRecentDocuments(company) : Promise.resolve([])],
        ['shifts', () => businessRepository.getOpenCashboxShifts()],
        ['stock', () => businessRepository.getStockBalances()],
        ['requests', () => businessRepository.getPurchaseRequests()]
      ];
      const results = await Promise.all(tasks.map(async ([key, load]) => {
        if (businessSnapshot[key]?.error && ['services', 'clients', 'cashboxes', 'documents'].includes(key) && !company) return [key, businessSnapshot[key]];
        try { return [key, { rows: await load(), error: null }]; }
        catch (error) { return [key, { rows: [], error }]; }
      }));
      businessSnapshot = Object.fromEntries(results);
      const documentTypes = businessSnapshot.documentTypes?.rows || [];
      if (company && documentTypes.length) {
        try {
          const seriesRows = await Promise.all(documentTypes.map(row => businessRepository.getActiveSeries(company, row.codigo)));
          businessSnapshot.series = { rows: seriesRows.flat(), error: null };
        } catch (error) {
          businessSnapshot.series = { rows: [], error };
        }
      } else {
        businessSnapshot.series = { rows: [], error: null };
      }
    }

    async function refresh() {
      if (!repository) repository = createReceptionRepository({ supabase });
      const [nextDashboard, nextDestinations] = await Promise.all([
        repository.getDashboard(activePolo),
        repository.getDestinations()
      ]);
      dashboard = nextDashboard;
      destinations = nextDestinations;
      await loadBusinessSnapshot();
      renderDashboard();
    }

    async function renderHome() {
      try {
        if (!supabase) throw new Error('A sessão do Supabase não foi fornecida ao módulo.');
        if (!actorId) throw new Error('Não foi possível identificar a sessão autenticada.');
        repository = createReceptionRepository({ supabase });
        await refresh();
      } catch (error) {
        renderUnavailable(error);
      }
    }

    if (!container.__ciadiReceptionBound) {
      container.__ciadiReceptionBound = true;
      container.addEventListener('click', async event => {
        const button = event.target.closest('button');
        if (!button) return;
        try {
          if (button.hasAttribute('data-invoice-preview-close')) {
            const host = container.querySelector('[data-invoice-preview-host]');
            if (host) { host.innerHTML = ''; host.classList.add('hidden'); }
            return;
          }
          if (button.hasAttribute('data-invoice-preview')) {
            const service = createReceptionInvoicePdfService({ supabase });
            const result = await service.preview(button.getAttribute('data-invoice-preview'));
            const host = container.querySelector('[data-invoice-preview-host]');
            if (!host) throw new Error('Área de pré-visualização documental indisponível.');
            host.classList.remove('hidden');
            host.innerHTML = '<section class="card p-4 space-y-3"><div class="flex items-center justify-between gap-2"><div><h3 class="font-bold">Pré-visualização A4 CIADI</h3><p class="text-xs text-slate-500">' + esc(result.document.document_no || result.document.id) + ' · ' + esc(result.document.document_status || 'rascunho') + '</p></div><button type="button" data-invoice-preview-close class="border rounded-lg px-3 py-2">Fechar</button></div><iframe title="Pré-visualização da factura CIADI" sandbox="allow-same-origin" srcdoc="' + esc(result.html) + '" class="w-full border rounded-lg bg-white" style="height:900px"></iframe></section>';
            host.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
          if (button.hasAttribute('data-invoice-pdf-export')) {
            button.disabled = true;
            try {
              const service = createReceptionInvoicePdfService({ supabase });
              const result = await service.exportIssuedPdf(button.getAttribute('data-invoice-pdf-export'));
              notify(result?.saved ? 'PDF A4 guardado no computador: ' + (result.filePath || '') : 'Exportação PDF cancelada.');
            } finally { button.disabled = false; }
            return;
          }
          if (button.hasAttribute('data-invoice-calculate')) {
            if (!financeRepository) financeRepository = createReceptionFinanceRepository({ supabase });
            const result = await financeRepository.calculateInvoice(button.getAttribute('data-invoice-calculate'));
            notify('Cálculo devolvido pelo motor central: ' + JSON.stringify(result));
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
            return;
          }
          if (button.hasAttribute('data-reception-route')) {
            const route = ROUTES.find(item => item.id === button.getAttribute('data-reception-route'));
            if (route) navigate(route.id);
            return;
          }
          if (button.hasAttribute('data-reception-retry')) return renderHome();
          if (button.hasAttribute('data-reception-home')) return renderHome();
          if (button.hasAttribute('data-reception-refresh')) return refresh();
          if (button.hasAttribute('data-reception-form')) {
            selectedAppointment = null;
            appointmentResults = [];
            appointmentSearch = { term: '', dateFrom: '', dateTo: '' };
            return button.getAttribute('data-reception-form') === 'arrival' ? renderArrivalForm() : renderVisitorForm();
          }
          if (button.hasAttribute('data-appointment-select')) {
            selectedAppointment = appointmentResults.find(row => String(row.id) === button.getAttribute('data-appointment-select')) || null;
            if (!selectedAppointment) throw new Error('A marcação seleccionada já não está disponível.');
            return renderArrivalForm();
          }
          if (button.hasAttribute('data-reception-call-next')) {
            const nextVisit = selectNextWaitingVisit(dashboard?.visits || []);
            if (!nextVisit) throw new Error('Não existem utentes em espera.');
            await repository.transitionVisit(nextVisit.id, 'waiting', 'in_service', actorId);
            notify(`Senha ${nextVisit.polo_code === 'talatona' ? 'TAL' : 'JDR'} #${String(nextVisit.ticket_number || '').padStart(3, '0')} chamada para atendimento.`);
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
            return;
          }
          if (button.hasAttribute('data-visit-route')) {
            const visitId = button.getAttribute('data-visit-route');
            const selector = Array.from(container.querySelectorAll('[data-route-destination]')).find(item => item.getAttribute('data-route-destination') === visitId);
            const specialtyId = selector?.value || '';
            if (!specialtyId) throw new Error('Seleccione o serviço de destino antes de encaminhar.');
            await repository.routeVisit(visitId, specialtyId, actorId);
            notify('Encaminhamento registado no histórico do atendimento.');
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
            return;
          }
          if (button.hasAttribute('data-referral-confirm')) {
            const visitId = button.getAttribute('data-referral-confirm');
            await repository.confirmReferral(visitId, actorId);
            notify('O serviço de destino confirmou a recepção do encaminhamento.');
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
            return;
          }
          if (button.hasAttribute('data-referral-return')) {
            const visitId = button.getAttribute('data-referral-return');
            const reasonInput = Array.from(container.querySelectorAll('[data-referral-return-reason]'))
              .find(input => input.getAttribute('data-referral-return-reason') === visitId);
            await repository.returnReferral(visitId, reasonInput?.value || '', actorId);
            notify('Encaminhamento devolvido e motivo registado no histórico.');
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
            return;
          }
          if (button.hasAttribute('data-visit-action')) {
            const visit = (dashboard?.visits || []).find(row => String(row.id) === button.getAttribute('data-visit-id'));
            if (!visit) throw new Error('O atendimento seleccionado já não está disponível.');
            await repository.transitionVisit(visit.id, visit.status, button.getAttribute('data-visit-action'), actorId);
            notify('Estado do atendimento actualizado.');
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
            return;
          }
          if (button.hasAttribute('data-visitor-exit')) {
            await repository.closeVisitor(button.getAttribute('data-visitor-exit'), actorId);
            notify('Saída do visitante registada.');
            return refresh();
          }
        } catch (error) { notify(error.message || 'Não foi possível concluir a operação.'); }
      });

      container.addEventListener('change', async event => {
        if (event.target.matches('[data-invoice-document-type]')) {
          const typeCode = clean(event.target.value, 32);
          try {
            if (!activeCompanyId) throw new Error('Empresa principal não identificada.');
            if (!businessRepository) businessRepository = createReceptionBusinessRepository({ supabase });
            const rows = typeCode ? await businessRepository.getActiveSeries(activeCompanyId, typeCode) : [];
            businessSnapshot.series = { rows, error: null };
            const seriesSelect = container.querySelector('[data-invoice-series]');
            if (seriesSelect) {
              seriesSelect.innerHTML = '<option value="">Seleccione a série</option>' +
                rows.map(row => '<option value="' + esc(row.id) + '">' + esc(row.codigo + ' · ' + (row.nome || row.ano || '')) + '</option>').join('');
            }
          } catch (error) {
            businessSnapshot.series = { rows: [], error };
            const seriesSelect = container.querySelector('[data-invoice-series]');
            if (seriesSelect) seriesSelect.innerHTML = '<option value="">Séries indisponíveis</option>';
            notify(error.message || 'Não foi possível carregar as séries documentais.');
          }
          return;
        }
        if (event.target.matches('[data-reception-polo]')) {
          activePolo = event.target.value || null;
          try { await refresh(); } catch (error) { renderUnavailable(error); }
        }
      });

      container.addEventListener('submit', async event => {
        const form = event.target;
        if (form.matches('[data-reception-invoice-form]')) {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(form).entries());
          const message = form.querySelector('[data-reception-message]');
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          try {
            if (!financeRepository) financeRepository = createReceptionFinanceRepository({ supabase });
            if (!activeCompanyId) throw new Error('Empresa principal não identificada; não foi criado qualquer documento.');
            const created = await financeRepository.createInvoice({
              companyId: activeCompanyId,
              documentType: values.documentType,
              seriesId: values.seriesId,
              clientId: values.clientId,
              dueDate: values.dueDate || null,
              observations: values.observations || '',
              lines: [{ serviceId: values.serviceId, quantity: values.quantity }]
            });
            const documentId = created?.documento_id || created?.id;
            if (!documentId) throw new Error('O motor não devolveu o identificador do documento. Consulte o arquivo documental antes de repetir para evitar duplicação.');
            notify('Rascunho criado pelo motor central: ' + documentId);
            try {
              const calculation = await financeRepository.calculateInvoice(documentId);
              notify('Rascunho criado e cálculo confirmado pelo motor central. ' + JSON.stringify(calculation));
            } catch (calculationError) {
              message.textContent = 'O rascunho ' + documentId + ' foi criado, mas o cálculo não foi confirmado: ' + (calculationError.message || 'erro do motor').toString() + '. Não volte a criar o documento; consulte-o no arquivo.';
            }
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
          } catch (error) {
            button.disabled = false;
            message.textContent = error.message || 'Não foi possível criar o rascunho.';
          }
          return;
        }
        if (form.matches('[data-reception-cashbox-open]')) {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(form).entries());
          const message = form.querySelector('[data-reception-message]');
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          try {
            if (!financeRepository) financeRepository = createReceptionFinanceRepository({ supabase });
            const shiftId = await financeRepository.openCashbox({ cashboxId: values.cashboxId, openingBalance: values.openingBalance });
            if (!shiftId) throw new Error('O motor não confirmou o identificador do turno de caixa.');
            notify('Turno de caixa aberto pelo motor central: ' + shiftId);
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
          } catch (error) {
            button.disabled = false;
            message.textContent = error.message || 'Não foi possível abrir o caixa.';
          }
          return;
        }
        if (form.matches('[data-reception-cashbox-close]')) {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(form).entries());
          const message = form.querySelector('[data-reception-message]');
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          try {
            if (!financeRepository) financeRepository = createReceptionFinanceRepository({ supabase });
            const result = await financeRepository.closeCashbox({
              shiftId: values.shiftId,
              countedBalance: values.countedBalance,
              justification: values.justification
            });
            notify('Resultado do fecho devolvido pelo motor central: ' + JSON.stringify(result));
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
          } catch (error) {
            button.disabled = false;
            message.textContent = error.message || 'Não foi possível fechar o turno.';
          }
          return;
        }
        if (form.matches('[data-reception-appointment-search]')) {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(form).entries());
          appointmentSearch = { term: values.term, dateFrom: values.dateFrom, dateTo: values.dateTo };
          const results = form.parentElement.querySelector('[data-reception-appointment-results]');
          results.textContent = 'A pesquisar agenda...';
          try {
            appointmentResults = await repository.searchAppointments(appointmentSearch);
            selectedAppointment = null;
            renderArrivalForm();
            const output = container.querySelector('[data-reception-appointment-results]');
            if (!appointmentResults.length) output.innerHTML = '<p class="text-sm text-slate-500">Não foram encontradas marcações para os critérios indicados.</p>';
          } catch (error) {
            results.textContent = error.message || 'Não foi possível pesquisar a agenda.';
          }
          return;
        }
        if (form.matches('[data-reception-arrival-form]')) {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(form).entries());
          const message = form.querySelector('[data-reception-message]');
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          try {
            await repository.registerArrival(values, actorId);
            notify('Chegada registada.');
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
          } catch (error) {
            button.disabled = false;
            message.textContent = error.message || 'Não foi possível registar a chegada.';
          }
        }
        if (form.matches('[data-reception-visitor-form]')) {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(form).entries());
          const message = form.querySelector('[data-reception-message]');
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          try {
            await repository.registerVisitor(values, actorId);
            notify('Entrada do visitante registada.');
            try { await refresh(); } catch (refreshError) { renderUnavailable(refreshError); }
          } catch (error) {
            button.disabled = false;
            message.textContent = error.message || 'Não foi possível registar o visitante.';
          }
        }
      });
    }

    return Object.freeze({ renderHome, refresh });
  }

  return Object.freeze({
    POLOS, VISIT_TYPES, VISIT_STATUSES, VISITOR_STATUSES, STATUS_LABELS, ROUTES,
    validateVisitInput, transitionVisitStatus, validateVisitorInput, validatePurchaseReceiptInput,
    validateReceptionStockExitInput, validateReceptionGoodsInput, createReceptionProcurementService,
    buildReceptionInvoiceHtml, createReceptionInvoicePdfService,
    summarizeReception, selectNextWaitingVisit, buildPublicCallPanelModel, createReceptionRepository, createReceptionBusinessRepository, createReceptionFinanceRepository, renderReceptionFinancePanel, renderReceptionDocumentHeader, create
  });
});
