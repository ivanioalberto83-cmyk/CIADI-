(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CIADI_RECEPTION_MODULE = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const ROUTES = Object.freeze([
    { id: 'pedidos_site', label: 'Pedidos de triagem', description: 'Consultar os pedidos recebidos através do site institucional.' },
    { id: 'agendamentos', label: 'Agendamentos', description: 'Consultar e acompanhar marcações clínicas.' },
    { id: 'pacientes', label: 'Pacientes', description: 'Aceder aos processos administrativos dos pacientes, conforme as permissões da conta.' },
    { id: 'familias', label: 'Famílias', description: 'Acompanhar os contactos e o portal das famílias.' },
    { id: 'triagens', label: 'Triagens', description: 'Acompanhar a entrada e encaminhamento dos pedidos de triagem.' }
  ]);

  function create({ root: container, navigate, notify = () => {} }) {
    if (!container || typeof navigate !== 'function') {
      throw new Error('O módulo Recepção necessita do contentor e da navegação do Dashboard.');
    }

    function renderHome() {
      container.innerHTML = `
        <section class="space-y-5">
          <header class="card p-6">
            <span class="text-xs font-black uppercase tracking-widest text-orange">CIADI • Atendimento</span>
            <h2 class="text-2xl font-black mt-1">Acolhimento e Recepção</h2>
            <p class="text-sm text-slate-500 mt-2">Ponto de entrada para atendimento, pedidos de triagem, pacientes, famílias e agendamentos.</p>
            <p class="text-xs text-slate-400 mt-3">Os dados são carregados pelos módulos institucionais existentes. As permissões continuam a ser verificadas pelo Supabase.</p>
          </header>
          <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            ${ROUTES.map(route => `
              <button type="button" data-reception-route="${route.id}" class="card p-5 text-left hover:border-orange-300">
                <h3 class="font-black">${route.label}</h3>
                <p class="text-sm text-slate-500 mt-2">${route.description}</p>
                <span class="inline-block text-orange text-sm font-bold mt-4">Abrir área →</span>
              </button>`).join('')}
          </div>
        </section>`;
    }

    if (!container.__ciadiReceptionClickBound) {
      container.__ciadiReceptionClickBound = true;
      container.addEventListener('click', event => {
        const button = event.target.closest('[data-reception-route]');
        if (!button) return;
        const route = ROUTES.find(item => item.id === button.getAttribute('data-reception-route'));
        if (!route) return notify('Área de Recepção não reconhecida.');
        navigate(route.id);
      });
    }

    return Object.freeze({ renderHome });
  }

  return Object.freeze({ create, ROUTES });
});
