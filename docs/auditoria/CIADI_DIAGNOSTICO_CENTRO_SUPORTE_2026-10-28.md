# CIADI — Diagnóstico inicial do Centro de Suporte Informático
**Data:** 28-10-2026  
**Projeto Supabase:** `egpkkttbcaukqnnxyhjv`  
**Branch:** `agent/ciadi-dashboard-20261028`  
**Modo de auditoria:** consulta read-only; sem alterações ao esquema, dados ou RLS.

## 1. Resultado desta etapa
Foi acrescentado ao Dashboard um painel inicial **Centro de Suporte Informático**, com indicadores obtidos por consultas de contagem às tabelas existentes e uma lista limitada da auditoria recente. O painel é informativo e não executa reparações. Deve ser validado no ambiente autenticado depois da integração da branch.

## 2. Fontes existentes confirmadas
A consulta read-only confirmou a existência destas fontes:
- `auditoria`: histórico de ações, tabela, utilizador, detalhes e data.
- `ciadi_sos_alertas`: alertas SOS e estados.
- `ciadi_email_notificacoes_fila`: estado, tentativas e erros da fila de email.
- `ciadi_documentos_institucionais`: metadados da biblioteca institucional.
- `finance_clientes`: clientes de faturação.
- `ciadi_funcionarios`: registos RH.
- `agendamentos`, `pacientes`, `profissionais`: fontes operacionais clínicas.

O painel mostra contagens para estas fontes, mas não apresenta nomes, contactos, conteúdo clínico, detalhes de erros nem payloads sensíveis. Se uma consulta for recusada, mostra “Sem confirmação de acesso”, não zero.

## 3. Bloqueios de segurança confirmados
- O constraint de `public.perfis.tipo` aceita apenas `admin`, `gestor`, `profissional`, `paciente`, `responsavel` e `operador`; não aceita ainda `suporte_informatica`, `rh` ou `rececao`.
- O inventário read-only identificou tabelas com RLS ativada e sem políticas: `ciadi_automation_token_hashes` e `ciadi_email_notificacoes_fila`. Não se deve adicionar políticas sem conhecer os consumidores e os fluxos de serviço.
- O Security Advisor reporta funções `SECURITY DEFINER` executáveis por papéis autenticados e, em alguns casos, anónimos. Cada função deve ser revista individualmente, porque algumas podem ser endpoints intencionais; não revogar permissões em lote.
- O acesso de leitura do painel depende das permissões reais do utilizador. O painel não contorna RLS e não é uma prova de que os dados completos estão acessíveis.

## 4. O que o painel já faz
- Consulta contagens de nove tabelas existentes usando `SELECT COUNT` sem carregar linhas completas.
- Consulta até oito eventos recentes da tabela `auditoria`, mostrando apenas ação, tabela e data.
- Mostra a quantidade de fontes consultadas com sucesso, a hora local da consulta e permite imprimir/guardar o relatório em PDF pelo navegador.
- Não altera dados, não grava resultados de auditoria novos, não testa gravações, não executa SQL de reparação e não chama o agente de IA.

## 5. O que ainda não faz
- Monitorização externa de disponibilidade/latência ou verificações programadas.
- Captura centralizada de logs de aplicação, navegador, Windows e Android.
- Testes de qualidade relacional (duplicados, referências órfãs, campos obrigatórios) com regras de negócio aprovadas.
- Relatórios de SLA, MTTR, recorrência e tendências históricas.
- Testes de backup/restauro.
- Executor autenticado e isolado para o agente de IA.
- Alertas automáticos com atribuição, prazos e fecho por evidência.
- Exportação de relatórios históricos com fonte, período, versão e assinatura de auditoria.

## 6. Próximas tarefas prioritárias
1. Executar testes de sintaxe/integração do workflow para os dois HTML e confirmar que permanecem byte-a-byte idênticos.
2. Rever a matriz de acesso e preparar uma migration proposta para os perfis, sem aplicar à produção.
3. Rever uma a uma as políticas RLS e funções privilegiadas; testar permissões positivas e negativas com contas fictícias.
4. Criar testes de qualidade de dados read-only para clientes/faturas, agenda, RH e documentos, sem expor dados pessoais.
5. Definir fontes de monitorização, retenção de logs, limiares de alertas e responsáveis.
6. Ligar o agente apenas depois de existir executor autenticado, permissões mínimas, logs de ações e aprovação para operações sensíveis.
7. Testar restauração de backups num ambiente isolado antes de declarar recuperação validada.

## 7. Critério de aceitação
O Centro de Suporte só será considerado homologado quando os indicadores forem comparados com consultas controladas, as permissões forem testadas por perfil, os dois HTML estiverem sincronizados, os testes forem aprovados e a revisão de segurança não apresentar bloqueios críticos sem plano aceite.

**Estado atual:** primeira interface implementada na branch de homologação; testes de ponta a ponta, permissões de perfis novos, monitorização programada, backups/restauro e executor do agente continuam pendentes. Não é homologação final nem publicação em produção.
