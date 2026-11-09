(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_MODULE_REGISTRY = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const navigationEntries = [
    ['overview', 'Visão geral'],
    ['sos', '🚨 Alertas SOS'],
    ['pedidos_site', 'Pedidos de triagem (site)'],
    ['agendamentos', 'Agendamentos Clínicos'],
    ['financeiro', '💰 Financeiro'],
    ['faturacao', '🧾 Faturação'],
    ['caixa', '💵 Caixa & Tesouraria'],
    ['contabilidade', '📊 Contabilidade'],
    ['saft', '📦 SAF-T(AO)'],
    ['especialidades', 'Especialidades'],
    ['triagens', 'Triagens'],
    ['pacientes', 'Pacientes & famílias'],
    ['profissionais', 'Profissionais'],
    ['documentos', 'Documentos & Formulários Clínicos'],
    ['familias', 'Portal & famílias'],
    ['conteudos', 'Conteúdos do site'],
    ['multimedia', 'Conteúdos Multimédia'],
    ['marketing', 'Marketing Digital'],
    ['janeth', 'Janeth'],
    ['utilizadores', 'Utilizadores'],
    ['instituicao', 'Instituição & redes'],
    ['empresas', '🏢 Empresas & Emitente'],
    ['clinica', 'Clínica virtual'],
    ['auditoria', 'Auditoria'],
    ['acompanhantes_at', 'Acompanhantes Terapêuticos (A.T.)']
  ].map(([id, label]) => Object.freeze({
    id,
    label,
    route: id,
    moduleId: id,
    status: 'legacy'
  }));

  return Object.freeze({
    listNavigationEntries() {
      return navigationEntries.map(entry => ({ ...entry }));
    }
  });
});
