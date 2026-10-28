# CIADI — Agenda de homologação do Dashboard
**Data:** 28-10-2026  
**Branch:** `agent/ciadi-dashboard-20261028`  
**Escopo:** Dashboard web existente. O Setup Windows e a separação dos polos no instalador ficam fora desta alteração.

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
