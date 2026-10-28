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
