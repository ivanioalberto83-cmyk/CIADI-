(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_HR_MODULE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const TABLES = Object.freeze({
    employees: 'ciadi_funcionarios',
    attendance: 'ciadi_funcionario_assiduidade',
    contracts: 'ciadi_funcionario_contratos',
    leave: 'ciadi_funcionario_ferias_licencas',
    documents: 'ciadi_funcionario_documentos',
    confidential: 'ciadi_funcionario_confidencial',
    payroll: 'ciadi_folhas_salariais',
    payrollLines: 'ciadi_folha_salarial_linhas'
  });

  const VIEWS = Object.freeze([
    ['home', 'Resumo'],
    ['employees', 'Funcionários'],
    ['attendance', 'Assiduidade'],
    ['contracts', 'Contratos'],
    ['leave', 'Férias e licenças'],
    ['documents', 'Documentos'],
    ['payroll', 'Folha salarial']
  ]);

  const FIELDS = Object.freeze({
    employees: 'id,profissional_id,codigo_funcionario,estado,tipo_vinculo,cargo,departamento,unidade_local,data_admissao,data_inicio_funcoes,data_fim_vinculo,data_saida,email_corporativo,telefone_corporativo,centro_custo,created_at',
    attendance: 'id,funcionario_id,data,entrada,saida_intervalo,retorno_intervalo,saida,horas_trabalhadas,estado,origem,observacoes,created_at',
    contracts: 'id,funcionario_id,tipo_contrato,numero_contrato,data_inicio,data_fim,renovacao_automatica,salario_referencia,moeda,estado,observacoes,created_at',
    leave: 'id,funcionario_id,tipo,data_inicio,data_fim,dias,estado,motivo,aprovado_em,observacoes,created_at',
    documents: 'id,funcionario_id,tipo_documento,titulo,nome_ficheiro,mime_type,tamanho_bytes,data_documento,validade_ate,estado,verificado,verificado_em,created_at',
    payroll: 'id,empresa_id,centro_custo_id,periodo_ano,periodo_mes,estado,moeda,data_pagamento,total_bruto,total_descontos,total_liquido,observacoes,aprovado_em,created_at',
    payrollLines: 'id,folha_id,funcionario_id,salario_base,total_subsidios,horas_extra,valor_horas_extra,irt,inss,inss_entidade,outros_descontos,deducao_faltas,total_bruto,total_descontos,total_liquido,numero_recibo,created_at'
  });

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value + (String(value).length === 10 ? 'T00:00:00' : ''));
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-PT').format(date);
  }

  function formatMoney(value, currency = 'AOA') {
    if (value === null || value === undefined || value === '') return '—';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(Number(value));
  }

  function create({ supabase, profile, root: container, notify = () => {}, audit = async () => {} }) {
    if (!supabase || !container) throw new Error('O módulo RH necessita do Supabase e do contentor de apresentação.');
    const canManagePayroll = profile && (profile.tipo === 'admin' || profile.tipo === 'gestor');
    let currentView = 'home';

    function shell(title, body) {
      container.innerHTML = `
        <section class="space-y-5">
          <header class="card p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div><span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Recursos Humanos</span>
                <h2 class="text-2xl font-black mt-1">${esc(title)}</h2>
                <p class="text-sm text-slate-500 mt-1">Gestão de colaboradores e informação laboral institucional.</p>
              </div>
              <span class="rounded-full bg-orange-50 text-orange-700 px-3 py-2 text-xs font-bold">Estação RH</span>
            </div>
            <nav class="flex flex-wrap gap-2 mt-5">${VIEWS.map(([id,label]) =>
              `<button type="button" data-rh-view="${id}" class="border rounded-xl px-3 py-2 text-sm font-semibold ${currentView===id?'bg-orange text-white border-orange':''}">${label}</button>`
            ).join('')}</nav>
          </header>
          ${body}
        </section>`;
    }

    async function queryRows(table, fields, order = 'created_at') {
      const { data, error } = await supabase.from(table).select(fields).order(order, { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    }

    function errorPanel(error, label) {
      shell(label, `<div class="card p-5 border border-red-200"><h3 class="font-bold text-red-800">Não foi possível carregar ${esc(label.toLowerCase())}.</h3><p class="text-sm text-red-700 mt-2">${esc(error.message || error)}</p><p class="text-xs text-slate-500 mt-3">O acesso é controlado pelas políticas de segurança do Supabase. Não foi contornada nenhuma restrição.</p></div>`);
    }

    function emptyPanel(label) {
      return `<div class="card p-6 text-center text-slate-500">Ainda não existem registos de ${esc(label)}.</div>`;
    }

    function tablePanel(headers, rows) {
      if (!rows.length) return emptyPanel('dados nesta área');
      return `<div class="card p-4 overflow-x-auto"><table class="w-full text-sm"><thead><tr>${headers.map(h=>`<th class="text-left p-2 border-b">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td class="p-2 border-b align-top">${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }

    async function renderHome() {
      currentView = 'home';
      try {
        const checks = await Promise.all([
          supabase.from(TABLES.employees).select('id', { count: 'exact', head: true }),
          supabase.from(TABLES.attendance).select('id', { count: 'exact', head: true }),
          supabase.from(TABLES.contracts).select('id', { count: 'exact', head: true }),
          supabase.from(TABLES.leave).select('id', { count: 'exact', head: true }),
          supabase.from(TABLES.documents).select('id', { count: 'exact', head: true })
        ]);
        const failed = checks.find(result => result.error);
        if (failed) throw failed.error;
        const labels = ['Funcionários','Registos de assiduidade','Contratos','Pedidos de férias/licenças','Documentos'];
        const cards = checks.map((result,index)=>`<article class="card p-5"><p class="text-sm text-slate-500">${labels[index]}</p><p class="text-3xl font-black mt-2">${result.count ?? 0}</p></article>`).join('');
        const payrollCard = canManagePayroll
          ? '<button type="button" data-rh-view="payroll" class="card p-5 text-left"><p class="text-sm text-slate-500">Folha salarial</p><p class="font-bold mt-2">Consultar processamento e recibos</p></button>'
          : '<article class="card p-5"><p class="text-sm font-bold">Folha salarial</p><p class="text-xs text-slate-500 mt-2">Acesso reservado à Administração e Gestão.</p></article>';
        shell('Resumo de Recursos Humanos', `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${cards}${payrollCard}</div><div class="card p-5"><h3 class="font-bold">Protecção de dados laborais</h3><p class="text-sm text-slate-500 mt-2">Os dados confidenciais e salariais permanecem sujeitos às políticas RLS actuais. A escolha da estação RH não concede permissões adicionais.</p></div>`);
      } catch (error) { errorPanel(error, 'Resumo de Recursos Humanos'); }
    }

    async function renderEmployees() {
      currentView = 'employees';
      try {
        const rows = await queryRows(TABLES.employees, FIELDS.employees);
        const professionalIds = [...new Set(rows.map(row=>row.profissional_id).filter(Boolean))];
        let people = [];
        if (professionalIds.length) {
          const result = await supabase.from('profissionais').select('id,nome_completo,email_profissional,telefone_profissional').in('id', professionalIds);
          if (result.error) throw result.error;
          people = result.data || [];
        }
        const byId = new Map(people.map(person=>[person.id,person]));
        let confidential = [];
        if (canManagePayroll && rows.length) {
          const result = await supabase.from(TABLES.confidential).select('funcionario_id,salario_base').in('funcionario_id', rows.map(row=>row.id));
          if (result.error) throw result.error;
          confidential = result.data || [];
        }
        const salaryByEmployee = new Map(confidential.map(row=>[row.funcionario_id,row.salario_base]));
        const data = rows.map(row=>{
          const person = byId.get(row.profissional_id) || {};
          const cells = [
            person.nome_completo || 'Nome por associar',
            row.codigo_funcionario || '—',
            row.cargo || '—',
            row.departamento || '—',
            row.estado || '—',
            formatDate(row.data_admissao)
          ];
          if (canManagePayroll) cells.push(formatMoney(salaryByEmployee.get(row.id)));
          return cells;
        });
        const headers = ['Colaborador','Código','Cargo','Departamento','Estado','Admissão'];
        if (canManagePayroll) headers.push('Salário base');
        shell('Funcionários', tablePanel(headers, data));
      } catch (error) { errorPanel(error, 'Funcionários'); }
    }

    async function renderAttendance() {
      currentView = 'attendance';
      try {
        const rows = await queryRows(TABLES.attendance, FIELDS.attendance, 'data');
        const data = rows.map(row=>[row.funcionario_id,row.data, row.entrada ? formatDate(row.entrada) : '—', row.saida ? formatDate(row.saida) : '—', row.horas_trabalhadas ?? '—', row.estado, row.origem || '—']);
        shell('Assiduidade', tablePanel(['ID do funcionário','Data','Entrada','Saída','Horas','Estado','Origem'],data));
      } catch (error) { errorPanel(error, 'Assiduidade'); }
    }

    async function renderContracts() {
      currentView = 'contracts';
      try {
        const contractFields = canManagePayroll ? FIELDS.contracts : FIELDS.contracts.replace(',salario_referencia', '');
        const rows = await queryRows(TABLES.contracts, contractFields);
        const data = rows.map(row=>[row.funcionario_id,row.tipo_contrato,row.numero_contrato || '—',formatDate(row.data_inicio),formatDate(row.data_fim),row.estado,canManagePayroll?formatMoney(row.salario_referencia,row.moeda||'AOA'):'Reservado']);
        shell('Contratos',tablePanel(['ID do funcionário','Tipo','N.º contrato','Início','Fim','Estado','Salário de referência'],data));
      } catch (error) { errorPanel(error, 'Contratos'); }
    }

    async function renderLeave() {
      currentView = 'leave';
      try {
        const rows = await queryRows(TABLES.leave, FIELDS.leave);
        const data = rows.map(row=>[row.funcionario_id,row.tipo,formatDate(row.data_inicio),formatDate(row.data_fim),row.dias ?? '—',row.estado,row.motivo || '—']);
        shell('Férias e licenças',tablePanel(['ID do funcionário','Tipo','Início','Fim','Dias','Estado','Motivo'],data));
      } catch (error) { errorPanel(error, 'Férias e licenças'); }
    }

    async function renderDocuments() {
      currentView = 'documents';
      try {
        const rows = await queryRows(TABLES.documents, FIELDS.documents);
        const data = rows.map(row=>[row.funcionario_id,row.tipo_documento,row.titulo,row.nome_ficheiro || '—',formatDate(row.data_documento),formatDate(row.validade_ate),row.estado,row.verificado?'Verificado':'Por verificar']);
        shell('Documentos dos funcionários',tablePanel(['ID do funcionário','Tipo','Título','Ficheiro','Data','Validade','Estado','Verificação'],data));
      } catch (error) { errorPanel(error, 'Documentos dos funcionários'); }
    }

    async function renderPayroll() {
      currentView = 'payroll';
      if (!canManagePayroll) {
        shell('Folha salarial', '<div class="card p-6"><h3 class="font-bold">Acesso reservado à Administração e Gestão.</h3><p class="text-sm text-slate-500 mt-2">As políticas RLS actuais não autorizam este perfil a consultar dados salariais.</p></div>');
        return;
      }
      try {
        const rows = await queryRows(TABLES.payroll, FIELDS.payroll);
        const data = rows.map(row=>[String(row.periodo_mes).padStart(2,'0')+'/'+row.periodo_ano,row.estado,row.moeda,formatMoney(row.total_bruto,row.moeda||'AOA'),formatMoney(row.total_descontos,row.moeda||'AOA'),formatMoney(row.total_liquido,row.moeda||'AOA'),formatDate(row.data_pagamento)]);
        shell('Folha salarial', tablePanel(['Período','Estado','Moeda','Bruto','Descontos','Líquido','Pagamento'],data));
      } catch (error) { errorPanel(error, 'Folha salarial'); }
    }

    const renderers = { home: renderHome, employees: renderEmployees, attendance: renderAttendance, contracts: renderContracts, leave: renderLeave, documents: renderDocuments, payroll: renderPayroll };
    async function navigate(view) {
      if (!renderers[view]) return notify('Área de Recursos Humanos não reconhecida.');
      await renderers[view]();
      if (view !== 'home') await audit('RH_VIEW', TABLES[view] || 'ciadi_funcionarios', null, { view });
    }

    if (!container.__ciadiHrClickBound) {
      container.__ciadiHrClickBound = true;
      container.addEventListener('click', event => {
        const button = event.target.closest('[data-rh-view]');
        if (button) navigate(button.getAttribute('data-rh-view'));
      });
    }

    return Object.freeze({
      renderHome,
      renderEmployees,
      renderAttendance,
      renderContracts,
      renderLeave,
      renderDocuments,
      renderPayroll,
      navigate
    });
  }

  return Object.freeze({ create, TABLES, FIELDS });
});
