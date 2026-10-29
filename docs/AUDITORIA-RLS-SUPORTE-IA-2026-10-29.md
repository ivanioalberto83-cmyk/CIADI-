# CIADI — Auditoria RLS do Centro de Suporte e Agente de IA

Data: 29/10/2026  
Branch: `audit/divisao-acessos-ciadi-2026-10-29`  
Estado: executor de teste read-only acrescentado à migração branch-only; **não aplicado em produção** e não homologado contra uma base Supabase isolada.

## Objetivo e limite

A migração proposta cria quatro tabelas específicas: pedidos de suporte, propostas versionadas, decisões de aprovação/rejeição e registos do executor de teste. Não altera `is_staff()`, `ciadi_finance_staff()`, tabelas financeiras, clínicas ou de RH.

O acesso é limitado a sessão autenticada cujo registo em `public.perfis` corresponda a `auth.uid()`, tenha `tipo = 'suporte_informatica'` e `ativo = true`. O perfil do Setup Windows não concede permissões. Admin, Receção, RH, profissionais, pacientes, responsáveis e utilizadores anónimos não recebem acesso a estas tabelas.

## Objetos propostos

- `public.ciadi_support_requests`: assunto, descrição, impacto, estado e autoria do pedido.
- `public.ciadi_support_proposals`: snapshot JSON, versão, hash, estado e autoria da proposta. O trigger impede alterar o conteúdo ou o hash de uma proposta já criada; uma correção deve gerar nova versão.
- `public.ciadi_support_approvals`: decisão explícita, identidade do técnico, versão e hash exatos aprovados/rejeitados.
- `public.ciadi_support_executions`: resultado da validação de leitura, uma execução por proposta, sem acesso de escrita direto para o cliente.
- `public.ciadi_is_support_technician()`: função auxiliar restrita ao domínio de suporte, com `search_path` fixo; não amplia funções globais de staff.

## Limitações e riscos ainda abertos

1. A integração de IA continua não configurada. Foi acrescentada uma RPC executora limitada a `readonly_validate_proposal`; não executa comandos, SQL arbitrário, migrações, alterações de permissões, deploys ou gravações noutros módulos.
2. `SUPPORT_EXECUTOR_TEST_MODE` permanece `false` até existir uma base de homologação isolada e os testes de runtime terem sido concluídos. A RPC não foi instalada na base partilhada/produção.
3. A RPC executora verifica no servidor a identidade ativa, o tipo de perfil, o pedido, a versão/hash da proposta, a decisão de aprovação e a ação allow-listed. Não confia no hash do browser; recalcula SHA-256 a partir do JSON persistido.
4. A inserção direta de propostas, a atualização direta de pedidos/propostas e a inserção direta de decisões são revogadas para `authenticated`. A função `ciadi_create_support_proposal` cria proposta/versão e atualiza o pedido numa transação; a função `ciadi_decide_support_proposal` executa validação e transições de estado numa única transação; a função usa `SECURITY DEFINER` com `search_path` fixo e exige técnico ativo. As aprovações são append-only para o cliente (sem INSERT/UPDATE/DELETE direto concedido).
5. O hash SHA-256 autoritativo é calculado no servidor sobre a representação `jsonb` persistida. A RPC executora compara novamente o hash, exige uma aprovação correspondente e é idempotente por proposta. A unicidade `(proposal_id, approved_by)` impede duplicar uma decisão pelo mesmo técnico. A unicidade `(proposal_id, approved_by)` impede duplicar uma decisão pelo mesmo técnico. O mesmo técnico pode aprovar o seu próprio pedido; a função transacional bloqueia uma segunda decisão depois de a proposta deixar de estar pendente.
6. Não foram executados testes de integração contra Supabase local ou produção nesta sessão. O SQL deve ser validado em ambiente de teste isolado antes de qualquer proposta de aplicação.
7. A cópia restaurável da base de dados e a cópia separada do Storage continuam por verificar; produção permanece bloqueada.

## Critérios de homologação antes de produção

- Testar acesso permitido para perfil ativo `suporte_informatica` e negação para Admin, RH, Receção, Operador, A.T., Paciente, Responsável e sessão anónima.
- Testar criação de pedido, versionamento de proposta, hash divergente, aprovação/rejeição repetida, tentativa de editar conteúdo/estado diretamente, concorrência entre duas decisões e tentativa de leitura/edição por perfil não técnico. Confirmar que a decisão e as mudanças de estado são atómicas.
- Confirmar que o modo de teste permanece desativado na interface até à configuração de base isolada; nessa base, testar a RPC com aprovação válida, hash/versão divergentes, ação não permitida, utilizador não autorizado e repetição idempotente.
- Confirmar que a auditoria não contém palavras-passe, tokens, segredos, dados clínicos desnecessários ou dados bancários/salariais.
- Verificar backup restaurável da base de dados e backup independente do Storage, com teste de restauro antes de aplicar migração/RLS em produção.
