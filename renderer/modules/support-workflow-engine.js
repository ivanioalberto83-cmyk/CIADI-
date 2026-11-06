(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_SUPPORT_WORKFLOW_ENGINE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const REQUEST_STATES = Object.freeze([
    'rascunho', 'submetida', 'em_validacao_tecnica',
    'pendente_aprovacao_administracao', 'aprovada', 'rejeitada',
    'em_aquisicao', 'recebida_parcialmente', 'recebida',
    'entregue', 'encerrada', 'cancelada'
  ]);

  const TRANSITIONS = Object.freeze({
    rascunho: ['submetida', 'cancelada'],
    submetida: ['em_validacao_tecnica', 'cancelada'],
    em_validacao_tecnica: ['pendente_aprovacao_administracao', 'submetida', 'cancelada'],
    pendente_aprovacao_administracao: ['aprovada', 'rejeitada', 'em_validacao_tecnica'],
    aprovada: ['em_aquisicao', 'cancelada'],
    rejeitada: [],
    em_aquisicao: ['recebida_parcialmente', 'recebida'],
    recebida_parcialmente: ['recebida'],
    recebida: ['entregue'],
    entregue: ['encerrada'],
    encerrada: [],
    cancelada: []
  });

  function clean(value) {
    return String(value ?? '').trim();
  }

  function validateTemplate(template) {
    const errors = [];
    if (!template || !/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(clean(template.code))) errors.push('Código do modelo inválido.');
    if (!Number.isInteger(template?.version) || template.version < 1) errors.push('Versão do modelo inválida.');
    if (!Array.isArray(template?.fields) || template.fields.length === 0) errors.push('O modelo deve definir pelo menos um campo.');
    const seen = new Set();
    for (const field of template?.fields || []) {
      if (!field || !/^[a-z][a-z0-9_]{1,39}$/.test(clean(field.key))) errors.push('Identificador de campo inválido.');
      else if (seen.has(field.key)) errors.push('Existem identificadores de campo repetidos.');
      else seen.add(field.key);
      if (field && !['text', 'textarea', 'date', 'number', 'select', 'checkbox'].includes(field.type || 'text')) {
        errors.push('Tipo de campo não suportado: ' + clean(field.key));
      }
    }
    return Object.freeze({ valid: errors.length === 0, errors });
  }

  function validateValues(template, values) {
    const model = validateTemplate(template);
    const errors = [...model.errors];
    if (!values || typeof values !== 'object' || Array.isArray(values)) errors.push('Os valores do documento são inválidos.');
    for (const field of template?.fields || []) {
      const value = values && values[field.key];
      if (field.required && (value === undefined || value === null || clean(value) === '')) {
        errors.push('Campo obrigatório: ' + (field.label || field.key));
      }
      if (field.type === 'number' && value !== undefined && value !== '' && !Number.isFinite(Number(value))) {
        errors.push('Valor numérico inválido: ' + (field.label || field.key));
      }
    }
    return Object.freeze({ valid: errors.length === 0, errors });
  }

  function makeDocumentNumber(prefix, sequence, year) {
    if (!/^[A-Z0-9-]{2,12}$/.test(clean(prefix))) throw new Error('Prefixo documental inválido.');
    if (!Number.isInteger(sequence) || sequence < 1) throw new Error('Sequência documental inválida.');
    if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new Error('Ano documental inválido.');
    return prefix + '/' + year + '/' + String(sequence).padStart(5, '0');
  }

  function createDraft({ template, values, actorId, number, now }) {
    const validation = validateValues(template, values);
    if (!validation.valid) return Object.freeze({ ok: false, errors: validation.errors });
    if (!clean(actorId)) return Object.freeze({ ok: false, errors: ['Autor obrigatório.'] });
    if (!clean(number)) return Object.freeze({ ok: false, errors: ['Número documental obrigatório.'] });
    const createdAt = now || new Date().toISOString();
    const document = {
      number: clean(number),
      templateCode: template.code,
      templateVersion: template.version,
      values: Object.freeze({ ...values }),
      status: 'rascunho',
      createdBy: clean(actorId),
      createdAt,
      issuedAt: null,
      issuedBy: null,
      history: Object.freeze([{ event: 'draft_created', actorId: clean(actorId), at: createdAt }])
    };
    return Object.freeze({ ok: true, document: Object.freeze(document) });
  }

  function issueDocument(document, actorId, now) {
    if (!document || document.status !== 'rascunho') return Object.freeze({ ok: false, error: 'Apenas documentos em rascunho podem ser emitidos.' });
    if (!clean(actorId)) return Object.freeze({ ok: false, error: 'Autor da emissão obrigatório.' });
    const at = now || new Date().toISOString();
    const issued = {
      ...document,
      status: 'emitido',
      issuedAt: at,
      issuedBy: clean(actorId),
      history: Object.freeze([...(document.history || []), { event: 'document_issued', actorId: clean(actorId), at }])
    };
    return Object.freeze({ ok: true, document: Object.freeze(issued) });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function renderPreview(template, values, metadata = {}) {
    const validation = validateValues(template, values);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    const rows = template.fields.map(field =>
      '<div class="document-field"><strong>' + escapeHtml(field.label || field.key) +
      '</strong><p>' + escapeHtml(values[field.key]) + '</p></div>'
    ).join('');
    return '<article class="ciadi-it-document"><header><h1>' + escapeHtml(template.title || template.code) +
      '</h1><p>' + escapeHtml(metadata.number || 'Pré-visualização') + '</p></header>' + rows +
      '<footer>Modelo ' + escapeHtml(template.code) + ' · Versão ' + template.version +
      (metadata.createdAt ? ' · ' + escapeHtml(metadata.createdAt) : '') + '</footer></article>';
  }

  function canTransition({ from, to, actorRole }) {
    if (!REQUEST_STATES.includes(from) || !TRANSITIONS[from]?.includes(to)) return false;
    if (to === 'aprovada' || to === 'rejeitada') return actorRole === 'admin' || actorRole === 'gestor';
    if (['submetida', 'em_validacao_tecnica', 'pendente_aprovacao_administracao',
      'em_aquisicao', 'recebida_parcialmente', 'recebida', 'entregue', 'encerrada'].includes(to)) {
      return actorRole === 'suporte_informatica' || actorRole === 'admin' || actorRole === 'gestor';
    }
    return actorRole === 'admin' || actorRole === 'gestor' || actorRole === 'suporte_informatica';
  }

  function transitionRequest(request, to, actor) {
    if (!request || !clean(actor?.id)) return Object.freeze({ ok: false, error: 'Pedido e autor são obrigatórios.' });
    if (!canTransition({ from: request.status, to, actorRole: actor.role })) {
      return Object.freeze({ ok: false, error: 'Transição não autorizada para este perfil ou estado.' });
    }
    const at = actor.at || new Date().toISOString();
    const next = {
      ...request,
      status: to,
      updatedAt: at,
      history: Object.freeze([...(request.history || []), {
        from: request.status, to, actorId: clean(actor.id), actorRole: actor.role, at,
        note: clean(actor.note)
      }])
    };
    return Object.freeze({ ok: true, request: Object.freeze(next) });
  }

  return Object.freeze({
    REQUEST_STATES, validateTemplate, validateValues, makeDocumentNumber,
    createDraft, issueDocument, renderPreview, canTransition, transitionRequest
  });
});
