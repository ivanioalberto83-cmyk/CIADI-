# CIADI — Separação por centro de custo

## Objetivo confirmado
- `CC-001`: CIADI — Polo Talatona.
- `CC-002`: CIADI — Polo Jardim de Rosas.
- Um utilizador só deve ver e operar nos centros que lhe foram atribuídos no Supabase.
- A seleção no login é contexto de trabalho, não um mecanismo de segurança isolado.

## Estado desta branch
Branch: `feature/ciadi-compras-contabilidade-integrada`

Migração preparatória criada:
`supabase/migrations/20261027070000_ciadi_centros_custo_acesso.sql`

A migração está versionada no GitHub, mas **não foi aplicada ao Supabase**. Cria o catálogo CC-002, tenta normalizar o código histórico CC-001 apenas quando não há duplicados e cria a tabela de atribuição `ciadi_centros_acesso` com RLS. Não atribui automaticamente utilizadores nem registos financeiros.

## Auditoria do esquema financeiro
As tabelas financeiras usam atualmente modelos mistos:
- `finance_clientes`: sem `centro_custo_id`.
- `finance_despesas`: tem `centro_custo` textual, sem FK UUID para o catálogo.
- `finance_documentos`: sem `centro_custo_id`.
- `finance_lancamentos`: tem `centro_custo` textual.
- `finance_lancamento_linhas`, `finance_movimentos_caixa`, `finance_imobilizados` e `finance_regras_contabilizacao`: já têm `centro_custo_id`.
- Outras tabelas (pagamentos, linhas de documentos, caixas/turnos, períodos, séries, configurações SAF-T e auditoria) requerem análise de herança de centro, empresa e documento antes de aplicar filtros.

As políticas RLS atuais consultadas para clientes, despesas e documentos autorizam pessoal de staff, mas não limitam o acesso por centro. Não basta acrescentar um seletor no ecrã: a autorização tem de ser imposta no Supabase.

## Próximas fases obrigatórias
1. Rever todas as políticas RLS financeiras e a definição de `is_staff()`, confirmar a relação `perfis.id = auth.uid()` e validar a autorização administrativa.
2. Definir o modelo de centro para documentos, despesas, clientes, caixas, movimentos, pagamentos, séries e lançamentos.
3. Preparar migração faseada para colunas/FKs, índices, backfill assistido e políticas restritivas; registos históricos sem centro ficam em quarentena administrativa até decisão explícita.
4. Criar interface administrativa para atribuir utilizadores a centros e ecrã de seleção após login, apenas depois de o backend estar pronto.
5. Testar com duas contas de teste: CC-001 não consegue ler/escrever dados CC-002, e vice-versa; testar SELECT/INSERT/UPDATE/DELETE e consultas indiretas (documentos, pagamentos, linhas, exportações).
6. Executar migrações apenas após backup verificado, aprovação explícita e plano de reversão.

## Restrições
- Nenhuma alteração de produção foi executada.
- Nenhum registo financeiro foi reatribuído.
- Nenhuma política existente foi removida ou enfraquecida.
- O seletor de centro ainda não deve ser ativado na aplicação; sem a fase de isolamento das tabelas operacionais, criaria uma falsa sensação de segurança.


## Mapa técnico de módulos comerciais e contabilidade (2026-10-27)
Foi criada a auditoria complementar `docs/CIADI-MAPA-SEPARACAO-POLOS-COMERCIAL-CONTABILIDADE.md`, baseada numa leitura das colunas e policies do Supabase e do `index.html`. O mapa detalha documentos/linhas, clientes e serviços, despesas, compras, pagamentos, caixas/turnos/movimentos, lançamentos, séries e SAF-T. Identifica também que o `index.html` usa `finance_clientes` como cadastro comercial comum e `finance_servicos` como catálogo de serviços, e que o isolamento não pode ser ativado apenas com um seletor.

O novo documento reforça: nenhum dado histórico deve ser classificado por suposição; as policies permissivas existentes precisam ser revistas tabela a tabela; qualquer implementação e testes continuam na branch de desenvolvimento. A migração preparatória permanece sem aplicação em produção.
