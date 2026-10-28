# CIADI — Agenda de homologação do Dashboard
**Data:** 28-10-2026  
**Branch:** `agent/ciadi-dashboard-20261028`  
**Escopo:** Dashboard, separação lógica de polos/áreas e próximo Setup Windows. O requisito é manter **um único instalador e uma única aplicação CIADI**, mas apresentar áreas e acessos separados por perfil/polo após autenticação; não criar um instalador independente por área.

## Regras de trabalho
- Não integrar na `main`, publicar ou alterar produção durante esta homologação.
- Não aplicar DDL/DML, migrations ou alterações de RLS nesta fase.
- Preservar dados, identidade CIADI, funcionalidades existentes e os ficheiros de entrada sincronizados.
- O agente de execução só pode ser usado pelo Suporte Informático; a interface atual é apenas uma área reservada e ainda não executa comandos.
- ADM e Suporte Informático precisam de acesso global aos módulos e polos; o ADM não deve selecionar um polo como limite de acesso.

## Alterações de interface registadas nesta branch
- Incorporada a proposta existente de navegação por áreas e perfis (ADM, Suporte Informático, RH e Receção).
- RH passa a apresentar apenas o módulo RH na navegação.
- Receção passa a ter acesso de interface a agendamentos, triagens, pacientes, profissionais, documentos clínicos, clientes, faturação e caixa; não vê contabilidade, folha salarial ou administração global.
- Faturação: a lista de clientes é carregada de `finance_clientes`, em vez de usar IDs de pacientes como IDs de clientes. A validação passa a aceitar um cliente sem ficha clínica, conforme a função de faturação já permite `p_paciente_id` nulo.
- `index.html` e `CIADI_DASHBOARD_FINANCEIRO.html` devem permanecer byte-a-byte idênticos.

## Confirmações read-only do esquema
- `public.perfis.tipo` aceita atualmente: `admin`, `gestor`, `profissional`, `paciente`, `responsavel` e `operador`. Os tipos `suporte_informatica`, `rh` e `rececao` ainda não estão permitidos pelo constraint atual.
- Existem tabelas de RH, incluindo `ciadi_funcionarios`, `ciadi_funcionario_contratos`, `ciadi_funcionario_documentos`, `ciadi_funcionario_assiduidade`, `ciadi_funcionario_ferias_licencas`, `ciadi_funcionario_avaliacoes`, `ciadi_folhas_salariais` e `ciadi_folha_salarial_linhas`.
- Não foi encontrada a tabela `finance_fornecedores`. A página não deve fingir que grava fornecedores; a tabela e as políticas correspondentes exigem proposta de migração revista.
- As políticas de RH e finanças existentes usam funções/condições de staff e gestão; adicionar nomes de perfil no frontend não concede autorização server-side.

## Bloqueios antes de homologar os novos perfis
1. Preparar migração revisada para os tipos de perfil necessários, sem a aplicar à produção.
2. Rever funções de autorização e políticas RLS por tabela para ADM, Suporte Informático, RH e Receção; não alargar acesso por conveniência.
3. Preparar e rever a estrutura de fornecedores e as respetivas políticas RLS.
4. Confirmar a matriz de acessos por polo no servidor; o Setup não substitui autorização no Supabase.
5. Executar testes com dados fictícios: login, navegação direta por URL/ID, gravação/leitura de clientes, emissão de fatura com e sem paciente, PDF, caixa, RH, e negação de acesso a contabilidade/folha salarial para Receção.
6. Executar o workflow de validação do Dashboard e rever resultados antes de tirar o Draft PR.

## Estado honesto
Esta branch é uma proposta de homologação. A navegação e o fluxo de seleção de clientes foram alterados no código, mas ainda não estão comprovados no Dashboard real. Os novos perfis não ficam funcionais até resolver o constraint e as regras server-side. Nenhuma alteração à base de dados ou às políticas RLS foi aplicada. Não se declara homologação, certificação AGT/APD nem prontidão para produção.

## Complemento da auditoria de permissões — 28-10-2026
Foi criada a matriz detalhada em `docs/auditoria/CIADI_MATRIZ_PERMISSOES_E_BLOQUEIOS_2026-10-28.md`.

Novos bloqueios confirmados em leitura do esquema e das funções:
- `is_staff()` é usado pelas políticas das tabelas RH e inclui profissionais A.T. activos; deve ser substituído, nas tabelas laborais, por autorização RH específica, para evitar acesso laboral transversal.
- `ciadi_finance_staff()` e `ciadi_finance_is_staff()` autorizam apenas `admin`/`gestor`; menus da Receção não concedem acesso real.
- As RPCs de criação/emissão fiscal verificam `is_staff()`. Não alargar essa função a Receção, pois é usada noutros módulos. A faturação necessita de uma autorização RPC própria e estreita.
- O formulário de cliente consulta `finance_empresas`; o fluxo de Receção precisa de atribuição segura da empresa emitente.
- Caixa depende de `ciadi_finance_can()` e de um operador activo com permissões específicas.
- O gerador A4 passou a usar o nome de campo `cliente_id` para o selector de `finance_clientes`; a mensagem de validação foi corrigida. A associação clínica continua opcional.
- Nenhuma alteração de esquema, RLS, dados ou produção foi aplicada.


## Atualização RH — 28-10-2026
- A página inicial do RH foi expandida com atalhos para colaboradores, contratos, documentos individuais e remunerações, além de catálogos de regulamentos internos, procedimentos, assiduidade/férias, formação/avaliação, recrutamento, saúde e segurança, disciplina/confidencialidade, arquivo/modelos, declarações/recibos e saída do colaborador.
- Os catálogos indicam expressamente que são listas de referência para preparar/reunir documentos; não afirmam que os ficheiros já existem, estão aprovados ou foram guardados.
- A biblioteca institucional persistente ainda não foi implementada: falta confirmar/criar uma estrutura de metadados, armazenamento privado, controlo de versões, aprovação e políticas de acesso. Não se deve carregar documentos sensíveis em armazenamento público.
- O inventário de documentos clínicos continua como tarefa separada do RH. A navegação clínica existente não foi removida nem substituída por esta alteração.
- Validação GitHub Actions para o commit `d6d4e4deccbf84bc9cb98e54ce753c603fed6947`: workflow `Validate CIADI dashboard integration`, execução `40700674964`, resultado **success**; verificou sincronização dos dois HTML, sintaxe JavaScript inline e pontos de integração/segurança da chave pública.
- O PR #18 continua **Draft**, sem merge e sem publicação. As alterações permanecem na branch de homologação; não foram feitas alterações à base de dados, RLS ou Setup Windows.


## Atualização de documentos clínicos, RH e Receção — 28-10-2026
- O menu clínico passou a identificar a entrada como **Documentos Clínicos** para facilitar a localização. A central clínica mantém os atalhos para documentos/receitas, formulários, avaliações e modelos.
- O RH ganhou um atalho **Biblioteca institucional**, ligado em modo de consulta à tabela já existente `ciadi_documentos_institucionais`. A consulta apresenta código, título, categoria, versão, estado, público e referência ao ficheiro, sem criar ou alterar registos.
- Inventário read-only de `ciadi_documentos_institucionais`: foram encontrados 2 registos de regulamentos em rascunho (um de público `todos` e outro de público `at`). Não foi confirmada a existência de ficheiros associados nem aprovação/publicação.
- Foi adicionado um painel de entrada **Receção — Operações**, com atalhos para pedidos do site, agendamentos, pré-atendimento/triagens, assistidos/famílias, documentos clínicos conforme autorização, profissionais, clientes, faturação, caixa e um catálogo de referência de atas, registos e procedimentos administrativos.
- O catálogo da Receção inclui atas de reunião operacional, passagem de turno, ocorrências administrativas, entrega/receção de documentos, encaminhamentos, reclamações, confirmações de agenda, declarações de comparência sujeitas a validação e procedimentos de atendimento. Estes itens são uma lista de modelos a reunir, não ficheiros persistidos ou aprovados.
- O acesso da Receção aos pedidos de triagem do site foi incluído no controlo da interface. A autorização final continua dependente de RLS/RPCs; o constraint `perfis.tipo` ainda não permite o perfil `rececao`, pelo que o perfil novo não está pronto para utilização real.
- Validação GitHub Actions para o commit `27682717470305b2298d0a14957a658856a5fe4c`: execução `40701402669`, workflow `Validate CIADI dashboard integration`; a verificação de sincronização HTML, sintaxe JavaScript e segurança da chave pública concluiu com sucesso nos passos de teste. A execução foi consultada enquanto a tarefa de finalização do job ainda estava em curso.
- O PR #18 permanece Draft. Não foram executadas gravações na base de dados, alterações RLS, uploads ou publicação. A biblioteca ainda necessita de validação das políticas de Storage e de fluxos seguros de upload, revisão e aprovação.


## Centro de Suporte Informático — primeira implementação — 28-10-2026
- Adicionado ao Dashboard o menu **Centro de Suporte Técnico** e painel read-only de indicadores para nove fontes existentes: agendamentos, pacientes, profissionais, clientes, RH, alertas SOS, fila de email, biblioteca institucional e auditoria.
- O painel mostra contagens com consulta autorizada, até oito eventos de auditoria (apenas ação/tabela/data), hora da consulta e opção de imprimir/guardar em PDF pelo navegador. Não expõe detalhes de auditoria potencialmente sensíveis.
- Falhas/negações de acesso são apresentadas como “Sem confirmação de acesso”, não como zero. O painel não contorna RLS e não executa gravações, reparações ou comandos do agente.
- Criado o relatório `docs/auditoria/CIADI_DIAGNOSTICO_CENTRO_SUPORTE_2026-10-28.md` com fontes verificadas, bloqueios, limites e critérios de aceitação.
- Consulta read-only confirmou que `perfis.tipo` ainda não permite `suporte_informatica`, `rh` nem `rececao`. Confirmou também RLS sem políticas em `ciadi_automation_token_hashes` e `ciadi_email_notificacoes_fila`; estas não devem ser alteradas até se compreenderem os fluxos de serviço.
- O Security Advisor reporta funções `SECURITY DEFINER` com EXECUTE acessível a papéis de API; requer revisão função a função, sem revogações em lote.
- **Pendente:** workflow após estes commits, comparação byte-a-byte dos dois HTML, teste autenticado por perfil, monitorização programada, qualidade relacional de dados, backups/restauro e executor seguro do agente.
- Sem alterações à base de dados, dados, RLS, Setup Windows ou produção. PR #18 continua em Draft e não foi integrado.


## Plano de Gestão de Marketing CIADI — 28-10-2026
- Criado o plano `docs/marketing/CIADI_PLANO_GESTAO_MARKETING_2026-2027.md`, com ciclo inicial de 90 dias (novembro 2026–janeiro 2027), públicos, pilares editoriais, calendário de referência, KPIs, governação, privacidade, orçamento e relatório mensal.
- Adicionado ao módulo Marketing Digital o ecrã **Plano de Marketing CIADI**, com objectivos, fases de execução, calendário editorial, indicadores, responsabilidades e regras de privacidade. Inclui opção de imprimir/guardar como PDF pelo navegador.
- A gestão operacional do módulo fica atribuída ao Suporte Informático; a Direção mantém a aprovação da estratégia, orçamento, campanhas pagas e mensagens institucionais. Conteúdo clínico exige revisão por responsável designado.
- O plano não inventa orçamento nem métricas históricas; metas finais e custos dependem de dados reais e aprovação. O calendário é uma proposta, não uma declaração de campanhas agendadas.
- A interface e o documento foram adicionados apenas à branch de homologação. Sem publicação de campanhas, envios de email, despesas, alterações de dados/RLS ou deploy.


## Polos e Acessos — requisitos e primeira interface — 28-10-2026
- A área `Polos e acessos` foi ampliada para mostrar metadados de perfis visíveis à sessão (nome, email, perfil, estado e último acesso), sem expor tokens, palavras-passe ou dados clínicos.
- Foram acrescentados pontos de entrada para criar utilizador, conceder/alterar acesso, suspender/cancelar, enviar convite seguro, associar polos e consultar histórico.
- As operações de escrita permanecem bloqueadas com indicação explícita do bloqueio; nenhum botão simula sucesso ou altera Auth/RLS/dados. A implementação real exige endpoints server-side autenticados, auditoria e testes por perfil.
- Credenciais: usar convite ou ligação de definição/reposição de palavra-passe; nunca enviar palavras-passe em texto simples.
- Bloqueios confirmados a resolver: constraint de `perfis.tipo` não aceita `suporte_informatica`, `rh`, `rececao`; atribuição explícita por polo e políticas server-side ainda não aplicadas.
- Próximas tarefas: preparar proposta de migration sem aplicar em produção; desenhar tabela de associação utilizador-polo e regras de acesso; implementar funções seguras de convite, alteração de perfil/polo e suspensão/revogação de sessões; testar acesso permitido e negado com contas fictícias; rever logs e políticas antes de activar os botões.
- A Direção/ADM mantém aprovação de alterações privilegiadas; o Suporte Informático executa operações autorizadas e auditadas. O ADM e o Suporte mantêm visão global dos polos, sem depender do polo seleccionado no instalador.


## Marketing — campanhas reais e integração social em tempo real — 28-10-2026
- Implementado no ramo de homologação um painel de desempenho que lê campanhas, envios e eventos das tabelas existentes do Supabase e subscreve alterações Realtime no cliente.
- O painel mostra campanhas, enviados, falhas, entregas, aberturas, cliques e eventos conforme os dados registados. Falhas de leitura são expostas como indisponibilidade, não como zero.
- Confirmado por consulta ao esquema que as tabelas existentes `ciadi_campanhas_marketing`, `ciadi_envios_marketing` e `ciadi_eventos_marketing` cobrem campanhas e eventos de email, mas não constituem um livro de custos nem um conector de métricas sociais.
- Pendentes: testar Realtime e RLS; configurar webhook real do fornecedor de email com validação de assinatura e deduplicação; criar gestão de orçamento/custos; desenvolver integrações OAuth/API de Meta, TikTok, LinkedIn e YouTube; criar sincronização server-side e relatórios planeado vs executado.
- Nenhuma credencial externa foi configurada, nenhuma publicação social foi feita e nenhuma alteração de esquema/RLS foi aplicada à base de produção. A conclusão depende de credenciais oficiais, permissões das contas e homologação de segurança.


## Próxima implementação técnica — marketing integrado — 28-10-2026
- Criada proposta de implementação segura em `docs/marketing/CIADI_INTEGRACOES_MARKETING_IMPLEMENTACAO.md`.
- Define o modelo proposto para custos, integrações, publicações, métricas e logs de sincronização, além das regras de acesso e plano de homologação.
- Trata-se de proposta documental; não foi aplicada migração SQL, não foram criadas tabelas e não foram configuradas credenciais externas.
- Próxima execução: inspeccionar novamente o esquema existente, validar o modelo contra as tabelas actuais, preparar SQL para revisão, implementar funções server-side e testar com dados fictícios antes de pedir autorização para qualquer alteração de produção.


## Pesquisa de redes sociais institucionais — 28-10-2026
- LinkedIn institucional encontrado: https://www.linkedin.com/company/ciadi-luanda (confirmado por resultados públicos que identificam o CIADI - Centro Integrado de Apoio e Desenvolvimento Individual).
- Facebook: referência candidata https://www.facebook.com/105203032611427 identificada através de listagem pública que replica conteúdos do CIADI; a propriedade/controlo institucional da página ainda precisa de confirmação pela Direcção.
- Instagram, TikTok e YouTube: não foi possível confirmar URLs oficiais com evidência suficiente; não foram inventados endereços.
- O painel de marketing foi actualizado para mostrar os links e o respectivo grau de confirmação. Isto não liga APIs nem autoriza acesso às contas.
- Nota importante para o rastreio seguinte: a página inicial do site público apresentou muitos links externos não relacionados com o CIADI no conteúdo indexado. É necessário auditar a integridade do site, links injectados, CMS/plugins e registos de acesso antes de qualquer publicação/actualização do site.
- Próximo passo: rastreio de homologação por módulos, corrigir erros priorizados, confirmar o setup.exe actual e só depois preparar novo instalador. Nenhum setup foi gerado nesta etapa.


## Auditoria ampliada — resultados de 28-10-2026
- Supabase read-only: 134 tabelas públicas, RLS activa em todas as tabelas públicas identificadas; 4 funções SECURITY DEFINER executáveis por anon, 79 por authenticated; protecção contra palavras-passe comprometidas desactivada; 65 alertas de políticas permissivas sobrepostas.
- Bloqueios funcionais: tipos de perfil não aceitam suporte_informatica/rh/rececao; a interface trata suporte_informatica como administrador global; o preload Electron não expõe installProfile, pelo que o agente fica inacessível; o Dashboard consulta finance_fornecedores, tabela inexistente.
- Dados consultados: finance_clientes=0, finance_documentos=0, finance_lancamentos=0; campanhas de marketing=2, envios=0, eventos=0; as três tabelas de marketing não estão na publicação supabase_realtime.
- Windows Setup: workflow usa o dashboard financeiro como fonte; não existe package-lock.json na pasta ciadi-windows e o workflow usa npm install; não foi gerado nem validado um novo Setup.exe; a lista de releases consultada estava vazia.
- A validação automática do HTML passou, mas é limitada a sincronização, sintaxe JS e verificações estáticas; não comprova testes de ponta a ponta.
- Ver relatório completo: `docs/auditoria/CIADI_DIAGNOSTICO_CENTRO_SUPORTE_2026-10-28.md`.
- Nenhuma alteração de produção executada. Próxima fase deve corrigir primeiro a autorização do Suporte, os endpoints privilegiados e a tabela de fornecedores, depois configurar Realtime e executar testes do instalador em ambiente Windows.


## Correcções de homologação em curso — 28-10-2026
- Corrigido o escopo de Suporte Informático na interface: não é administrador global e não vê a central SOS.
- O agente fica restrito a contas de suporte no runtime desktop Electron.
- A área Fornecedores consulta a tabela existente de despesas em modo leitura, em vez de chamar a tabela inexistente; o cadastro mestre continua bloqueado até migration/RLS revista.
- Setup Windows actualizado para versão 1.0.1, dependências directas fixadas e workflow com `npm ci` e artefacto de homologação no ramo de trabalho.
- Novos testes de regressão para escopo de suporte e consulta de fornecedores.
- Migration de perfis preparada em `supabase/migrations/20261028150000_expand_ciadi_profile_types.sql`, mas não aplicada a produção.
- O Setup.exe só deve ser entregue depois do workflow Windows concluir com sucesso e o artefacto actual ser confirmado.

## Requisito prioritário revisto — um único Setup, áreas e polos separados — 28-10-2026

### Decisão confirmada
- Manter um único instalador CIADI-Setup.exe (Electron + NSIS), identidade visual, ícone, atalhos, opção de diretório, persistência de dados e ligação ao Supabase.
- A separação deve ocorrer dentro da aplicação instalada: após login, a navegação apresenta o painel e os módulos autorizados ao perfil e ao contexto operacional do utilizador.
- Não gerar um Setup separado para cada polo ou área. A versão 1.0.1 compilada anteriormente não comprova esta separação funcional; é necessário implementar e testar antes de gerar a próxima versão.

### Estrutura funcional esperada
1. **Painel central ADM:** visão global de todos os polos e áreas. O ADM não pode ficar preso a um polo seleccionado; pode consultar/gerir o contexto de qualquer polo autorizado.
2. **Polos:** cada polo deve ter identificação própria e associação explícita dos registos operacionais ao polo, sem misturar dados entre polos.
3. **Áreas/módulos repartidos:** cada área (por exemplo, Gestão Clínica/Receção, Financeiro/Faturação, RH, Aprovisionamento e Suporte Informático) deve ter entrada identificável no mesmo programa, com funções e permissões próprias. A lista final de áreas deve ser reconciliada com os módulos realmente existentes no repositório, sem apresentar atalhos demonstrativos como funcionalidades concluídas.
4. **Utilizadores de polo/área:** recebem apenas os módulos e dados permitidos pela matriz de acesso; a seleção do polo não é uma medida de segurança por si só.
5. **Suporte Informático:** acesso ao módulo de suporte autorizado, sem herdar privilégios de ADM. O agente só pode executar operações quando existir um executor seguro, autorizado e auditado.
6. **Dados e segurança:** preservar dados existentes, RLS e políticas actuais; qualquer mudança de esquema, associações de polo, RPC ou RLS deve ser preparada e revista separadamente, sem aplicação automática em produção.

### Trabalho obrigatório antes do próximo Setup
- [ ] Inventariar os polos reais, as áreas/módulos existentes e a forma actual de associação dos registos a um polo.
- [ ] Definir matriz de acesso por perfil × área × polo, incluindo ADM global e Suporte Informático restrito.
- [ ] Rever o código de autenticação e navegação; identificar por que razão o utilizador vê apenas o painel ADM e não a separação operacional esperada.
- [ ] Rever esquema Supabase, chaves estrangeiras, RLS e RPCs em modo read-only; documentar lacunas antes de propor migrações.
- [ ] Implementar a separação na branch de homologação, sem alterar produção.
- [ ] Testar com contas e dados fictícios: ADM vê todos os polos; utilizador de polo não vê dados de outro polo; módulos não autorizados são negados mesmo por URL/chamada directa; Suporte não recebe permissões globais.
- [ ] Confirmar que index.html e CIADI_DASHBOARD_FINANCEIRO.html continuam byte-a-byte idênticos e que o pacote Electron inclui a versão correcta.
- [ ] Executar testes automatizados e construir o próximo Setup Windows; verificar instalação/actualização em Windows, login, menus, persistência e ligação ao Supabase.
- [ ] Só declarar a versão pronta após teste funcional em Windows e revisão dos resultados; manter PR em Draft e não publicar/alterar produção sem aprovação.

### Critério de aceitação
O requisito só fica satisfeito quando o mesmo Setup instala uma aplicação em que, depois do login, o painel e os módulos são apresentados de acordo com perfil e polo; o ADM mantém visão global, os dados ficam segregados por polo conforme a autorização server-side, e os testes de acesso permitido/negado passam. A compilação ou a mera presença de menus não basta.

### Estado nesta revisão
- Confirmado pelo relato de instalação: o utilizador instalou o Setup e observou apenas o painel ADM, sem a repartição esperada de polos/áreas.
- O código revisto nesta branch apresenta uma área “Polos e acessos” centrada em metadados de perfis; isso, por si só, não implementa uma estrutura completa de polos/áreas.
- A agenda fica actualizada para corrigir a separação no mesmo instalador, e não para criar múltiplos instaladores.
- A separação funcional completa, a matriz de permissões server-side e os testes em Windows continuam pendentes. Não declarar homologação.

## Repriorização confirmada pelo utilizador — painéis existem, operações não funcionam — 28-10-2026

### Clarificação do requisito
O utilizador confirmou que as áreas **ADM, Suporte Informático, RH e Receção já estão separadas**. O problema reportado não é a falta de quatro painéis nem a necessidade de quatro instaladores: os painéis/módulos apresentados são, em parte, apenas de leitura e os fluxos de operação/gravação não funcionam como esperado.

### Objectivo agora
**Manter os quatro painéis e o mesmo Setup Windows. Corrigir as funções existentes até que os fluxos autorizados funcionem de ponta a ponta**, sem simular gravações, sem remover funcionalidades e sem atribuir permissões excessivas.

### Plano funcional prioritário
1. **Inventário dos botões e operações:** classificar cada botão como consulta, criação, edição, suspensão, emissão, exportação ou acção técnica; confirmar se tem handler real e qual tabela/RPC/serviço utiliza.
2. **RH:** testar primeiro listagem, criar colaborador, editar, contrato, documentos e remunerações. Confirmar esquema, campos obrigatórios, RLS e armazenamento privado. Os catálogos informativos não contam como operações concluídas.
3. **Receção:** testar criar/editar cliente, marcar e reagendar consulta, pré-atendimento, registo administrativo autorizado, emissão de factura e operações de caixa autorizadas. Confirmar erros de rede/permissão e que o registo persiste após recarregar.
4. **ADM:** validar gestão global de polos e perfis, e que os botões de administração executam apenas acções apoiadas por endpoints/RPC seguros; distinguir os botões que estão deliberadamente bloqueados dos que falham inesperadamente.
5. **Suporte Informático:** validar diagnóstico, alertas, logs e operações de manutenção autorizadas. Não activar comandos do agente nem executar alterações de produção até existir executor seguro, autorização explícita, registo de auditoria e possibilidade de reversão.
6. **Integração e segurança:** cada gravação deve verificar a resposta do Supabase/servidor, mostrar erros compreensíveis, confirmar persistência após nova leitura e respeitar a matriz de acesso. Não resolver falhas alargando RLS indiscriminadamente.
7. **Testes de regressão:** usar ambiente de teste e dados fictícios; testar permissões positivas e negativas por perfil, navegação directa, erros de validação, duplicados, actualização, reload e PDF/exportação quando aplicável.
8. **Novo Setup:** só depois dos fluxos prioritários passarem, sincronizar os dois HTML, executar workflow, compilar e testar o Setup no Windows. Não reutilizar a versão 1.0.1 como prova de funcionamento completo.

### Primeira sequência de homologação
- [ ] RH — criar colaborador fictício, editar, recarregar a página e confirmar persistência.
- [ ] Receção — criar cliente fictício e confirmar que aparece após recarregar.
- [ ] Receção/Financeiro — emitir documento de teste apenas em ambiente autorizado, confirmar dados completos do cliente, PDF e ligação aos registos correctos.
- [ ] RH — testar contratos/documentos com armazenamento privado e permissões correctas.
- [ ] ADM — testar operações de gestão e visão global dos polos.
- [ ] Suporte Informático — testar diagnóstico e registo de incidentes sem executar comandos privilegiados.

### Evidência obrigatória por operação
Para cada teste registar: perfil utilizado, módulo, acção, tabela/RPC/serviço chamado, resultado da gravação, resultado da leitura posterior, mensagem de erro (se houver) e verificação de acesso negado num perfil sem autorização. Não registar dados clínicos reais em relatórios de teste.

### Estado honesto
- A revisão estática identificou painéis com botões que chamam funções existentes, incluindo `hrDashboard()`, `receptionDashboard()` e fluxos de clientes financeiros. A existência de handlers no código não prova que a operação funcione com o esquema e as políticas do Supabase.
- A auditoria anterior confirmou que `finance_clientes`, `finance_documentos` e `finance_lancamentos` estavam sem registos no momento da consulta; não há evidência suficiente de um ciclo de factura completo validado.
- As áreas RH e Receção incluem também catálogos de referência/consulta que são explicitamente demonstrativos; não devem ser confundidos com gestão persistente de documentos.
- Nenhuma alteração de produção, dados, esquema ou RLS é autorizada por esta actualização da agenda. A implementação funcional deverá ocorrer na branch de homologação, com revisão de cada fluxo antes de propor qualquer alteração ao backend.

## Causa raiz confirmada — políticas do Supabase bloqueiam os perfis funcionais — 28-10-2026

Consulta read-only ao esquema e às políticas de produção confirmou bloqueios adicionais. Não foram feitas alterações na base de dados.

### Recursos Humanos
- As políticas de `ciadi_funcionarios`, `ciadi_funcionario_contratos`, `ciadi_funcionario_documentos`, `ciadi_funcionario_assiduidade`, `ciadi_funcionario_avaliacoes`, `ciadi_funcionario_ferias_licencas`, `ciadi_funcionario_formacoes`, `ciadi_funcionario_historico` e `ciadi_funcionario_competencias` dependem de `is_staff()`.
- A função `is_staff()` permite actualmente `admin`, `gestor` ou profissional A.T. activo; não inclui o perfil `rh`. Assim, a interface pode apresentar formulários de RH, mas o Supabase pode recusar gravações.
- As políticas de `ciadi_folhas_salariais` e `ciadi_folha_salarial_linhas` estão limitadas a `admin`/`gestor`. A gestão salarial pelo RH requer decisão e autorização explícitas, sem alargar a função genérica `is_staff()`.
- `ciadi_funcionario_beneficios` e `ciadi_funcionario_confidencial` têm restrições explícitas de administração/gestão; não as alargar automaticamente ao RH.

### Receção, clientes e faturação
- A política de `finance_clientes` usa `ciadi_finance_staff()`, que permite apenas `admin`/`gestor`.
- A política de `finance_empresas` usa `ciadi_finance_is_staff()`, também limitada a `admin`/`gestor`. O formulário de cliente tenta consultar esta tabela antes de abrir; uma recusa pode impedir que a Receção sequer abra o formulário.
- As RPCs de criação/emissão/cálculo fiscal, incluindo `ciadi_faturacao_criar_documento`, verificam `is_staff()`. Dar acesso visual à Receção não lhe dá permissão real para facturar.
- Caixa tem um mecanismo separado em `ciadi_finance_can()` e `finance_operadores`; a Receção precisa de operador activo e permissões de caixa explicitamente configuradas. Não deve receber acesso à contabilidade, fecho contabilístico, estornos ou administração fiscal global.

### Perfis
- O constraint de `perfis.tipo` em produção ainda não permite `suporte_informatica`, `rh` ou `rececao`; a migration existente que propõe estes tipos continua por aplicar.
- Adicionar apenas os tipos ao constraint não basta. São necessárias políticas/RPCs específicas e testes de autorização para cada módulo.

### Próximos passos seguros
1. Preparar uma proposta de políticas/RPCs por módulo e perfil, sem a aplicar em produção.
2. Para RH, permitir operações laborais necessárias sem incluir automaticamente benefícios, dados confidenciais ou permissões de ADM.
3. Para Receção, criar uma via de leitura mínima dos dados da empresa emitente e autorizações estreitas para cadastro de clientes, criação/emissão de documentos e caixa; evitar conceder acesso genérico à contabilidade.
4. Testar operações permitidas e negadas com perfis fictícios num ambiente de homologação.
5. Só pedir autorização para migração/deploy depois da revisão da proposta e da confirmação de backups/restauro.

### Código do Dashboard — correcção pequena aplicada
- No formulário de RH, a consulta da empresa emitente passou a ser necessária apenas quando o salário de referência é superior a zero. O registo laboral sem salário deixa de depender de uma consulta financeira desnecessária.
- `index.html` e `CIADI_DASHBOARD_FINANCEIRO.html` foram sincronizados.
- Workflow `Validate CIADI dashboard integration`, execução `40714677233`: **success** (sincronização, sintaxe JavaScript e verificações estáticas).
- Esta correcção não contorna nem altera RLS; a gravação por perfil RH continua bloqueada até se preparar, rever e autorizar a solução de permissões.

## Implementação em curso — cadastro RH e abertura do formulário de cliente — 28-10-2026

- O cadastro RH foi ajustado para só consultar a empresa emitente quando o utilizador preenche salário de referência; salário inválido/negativo é recusado antes de gravar. Isto remove uma dependência financeira desnecessária do registo laboral sem salário.
- O formulário de cliente passou a chamar `ciadi_recepcao_empresas_ativas()` para o perfil Receção, em vez de consultar directamente todos os dados da tabela `finance_empresas`.
- Foi criada a proposta SQL `docs/auditoria/propostas/CIADI_PROPOSTA_PERMISSOES_RH_RECECAO_2026-10-28.sql` com políticas limitadas para RH e Receção e uma RPC de leitura mínima da empresa emitente. É um documento de proposta, não foi aplicado à produção.
- Os dois HTML foram sincronizados após as alterações.
- Bloqueio que permanece: a RLS de produção continua a recusar gravações aos novos perfis, porque as políticas actuais dependem de `is_staff()`/funções financeiras limitadas a `admin`/`gestor`. A RPC proposta também ainda não existe na base de dados de produção.
- Próximo passo: rever a proposta SQL, preparar testes de autorização positivos/negativos em homologação e só depois pedir autorização separada para aplicar a migração. Até lá, não afirmar que RH ou Receção já gravam no Supabase.

