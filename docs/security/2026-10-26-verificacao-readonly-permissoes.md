# CIADI — verificação read-only de permissões (26/10/2026)

## Âmbito e segurança da execução

Consulta efetuada em modo exclusivamente de leitura ao projeto Supabase `egpkkttbcaukqnnxyhjv` em 2026-10-26 14:10 UTC. Foram consultados catálogos PostgreSQL e privilégios efetivos; não foi executado DDL/DML, não foram alterados grants, políticas, dados, configurações Auth ou funções. Este registo contém metadados técnicos, não dados de pacientes.

## Resultados confirmados

### Vistas de dados pessoais

| Vista | Proprietário | `anon SELECT` | `authenticated SELECT` | `security_invoker=true` | RLS nas tabelas base |
|---|---|---:|---:|---:|---|
| `public.v_ciadi_at_pacientes_atribuidos` | postgres | Sim | Sim | Não | Ativo em `ciadi_atribuicoes_at`, `pacientes`, `profissionais`; não forçado |
| `public.v_ciadi_calendario_aniversarios` | postgres | Sim | Sim | Não | Ativo em `ciadi_aniversarios`; não forçado |

A primeira vista inclui IDs de paciente/profissional, datas da atribuição, permissões e nomes completos. A segunda inclui nome de exibição, data de nascimento e opções de visibilidade. Como ambas são vistas SECURITY DEFINER e não têm a opção `security_invoker=true`, a presença de RLS nas tabelas base não garante que a consulta da vista respeite as políticas do utilizador chamador. Tratar como prioridade alta e testar com contas fictícias de cada papel.

### Função de imutabilidade fiscal

- Assinatura: `public.finance_bloquear_alteracao_fiscal()`
- Retorno: `trigger`; `SECURITY DEFINER`; `search_path=public`
- Privilégios efetivos: `anon EXECUTE = true`; `authenticated EXECUTE = true`.
- O corpo impede alterações/eliminações de documentos fiscais emitidos e devolve OLD/NEW conforme a operação do trigger.

É uma função trigger, não uma RPC de aplicação normal. O privilégio EXECUTE exposto deve ser corrigido após confirmar a forma de invocação e os triggers associados. Não revogar sem testar a operação legítima dos triggers em homologação.

### RPCs SECURITY DEFINER expostas a anon

O Security Advisor reporta quatro funções executáveis por `anon`:
- `ciadi_registrar_acesso_validacao(text)`
- `ciadi_registrar_triagem_publica(...)`
- `ciadi_registrar_validacao_documento(text)`
- `finance_bloquear_alteracao_fiscal()`

A triagem pública poderá ser intencional e deve continuar funcional se o formulário público depender dela. As duas funções de validação precisam de revisão do conteúdo retornado, limitação de abuso e minimização de dados; não revogar indiscriminadamente.

O advisor também reporta 79 funções SECURITY DEFINER executáveis por `authenticated`. Este total é um sinal para revisão por função e papel, não prova individual de vulnerabilidade. Cada função deve ser associada ao consumidor real, verificar autorização internamente e testar chamadas com utilizador sem permissão, antes de restringir EXECUTE.

### Configuração Auth

O Security Advisor continua a reportar a proteção contra palavras-passe comprometidas desativada. Ativar apenas depois de confirmar a opção na configuração Auth e testar inscrição/alteração de palavra-passe em homologação; não foi alterada nesta auditoria.

## Plano de homologação obrigatório

1. Criar/usar ambiente de homologação sem copiar dados pessoais reais.
2. Registar a definição completa das vistas, grants e políticas antes de qualquer mudança.
3. Para cada papel (anon, responsável/família, profissional, operador, gestor e admin), testar acesso permitido e negado com registos fictícios.
4. Para as vistas, comparar resultado atual com uma implementação usando `security_invoker=true`; não aplicar `REVOKE` até confirmar os consumidores legítimos e as permissões necessárias.
5. Para a função fiscal, confirmar triggers associados e testar INSERT/UPDATE/DELETE legítimos, bem como a imutabilidade após emissão.
6. Para RPCs públicas, validar contrato funcional, dados devolvidos, autorização, abuso/rate limiting e logs.
7. Guardar SQL de estado anterior, plano de rollback e resultados de regressão; solicitar autorização explícita antes de qualquer aplicação em produção.

## Estado

**Risco confirmado; mitigação ainda não aplicada.** Este ficheiro regista evidência de leitura e um plano de teste. Não constitui aprovação de conformidade nem autorização para alterar produção.
