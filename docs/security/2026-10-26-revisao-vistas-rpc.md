# CIADI — revisão de segurança das vistas e funções RPC

**Estado: proposta para revisão; NÃO executar em produção sem aprovação, backup e teste em homologação.**

Data da auditoria: 2026-10-26  
Projeto analisado: `egpkkttbcaukqnnxyhjv`

## Evidência observada

A verificação de segurança do Supabase sinalizou:
- `public.v_ciadi_at_pacientes_atribuidos`: vista SECURITY DEFINER; SELECT permitido a `anon` e `authenticated`. A vista devolve nomes de assistidos e profissionais e relações de atribuição.
- `public.v_ciadi_calendario_aniversarios`: vista SECURITY DEFINER; SELECT permitido a `anon` e `authenticated`. Inclui nome de exibição e data de nascimento.
- `public.finance_bloquear_alteracao_fiscal()`: função SECURITY DEFINER com EXECUTE permitido a `anon` e `authenticated`, embora a definição observada seja de trigger.
- `public.ciadi_registrar_triagem_publica(...)`: RPC pública que insere pedidos de triagem. Pode ser intencional para o site; não revogar automaticamente.
- `public.ciadi_registrar_acesso_validacao(text)` e `public.ciadi_registrar_validacao_documento(text)`: RPCs de validação documental. Rever os campos expostos e confirmar a necessidade de acesso público antes de alterar permissões.

A existência de uma permissão não prova por si só uma exploração. É necessária validação funcional com os responsáveis pelos módulos.

## SQL proposto para homologação

Este SQL é uma proposta de alteração, não foi aplicado à base de dados. A opção `security_invoker` requer uma versão PostgreSQL compatível e faz com que a vista use as permissões e políticas do utilizador que consulta. Antes de aplicar, confirmar as permissões SELECT necessárias nas tabelas base e testar com utilizadores de cada perfil.

```sql
begin;

alter view public.v_ciadi_at_pacientes_atribuidos
  set (security_invoker = true);
alter view public.v_ciadi_calendario_aniversarios
  set (security_invoker = true);

revoke all on table public.v_ciadi_at_pacientes_atribuidos from anon;
revoke all on table public.v_ciadi_calendario_aniversarios from anon;

-- Esta função é um trigger. A execução de triggers não exige que
-- o utilizador da aplicação tenha EXECUTE direto na função.
revoke execute on function public.finance_bloquear_alteracao_fiscal()
  from public, anon, authenticated;

commit;
```

**Não executar o bloco acima em produção sem validação.** Se o Dashboard depender de permissões de vista que deixem de funcionar, corrigir os grants e as políticas numa migração revista, sem abrir acesso a dados pessoais.

## Testes obrigatórios em homologação

1. Utilizador anónimo: não consegue ler nenhuma das duas vistas.
2. Paciente/responsável: não consegue consultar dados de outros assistidos.
3. Profissional: só vê assistidos que lhe estão atribuídos, segundo as políticas aprovadas.
4. Gestor/admin: acesso conforme o papel e as políticas documentadas.
5. Calendário: apenas os dados autorizados são apresentados; validar consentimento/visibilidade de aniversários.
6. Documentos fiscais: inserção/alteração/anulação continua a seguir as regras de imutabilidade.
7. RPC pública de triagem: continua a funcionar no site com validação de consentimento e limites antiabuso.
8. RPCs de validação documental: confirmar que só devolvem os dados estritamente necessários.
9. Rever os logs de erro e executar testes de regressão do Dashboard.
10. Confirmar backup e procedimento de rollback antes da aprovação de produção.

## Rollback proposto (apenas se necessário e após análise)

Repor as opções originais das vistas e os grants anteriores, que devem ser capturados e registados antes da migração. Não usar um rollback genérico sem guardar o estado real anterior; os grants anteriores devem ser obtidos a partir do catálogo do PostgreSQL e anexados ao registo de mudança.

## Decisão pendente

- Confirmar com o responsável do CIADI se a consulta pública de aniversários é uma função pretendida.
- Confirmar o contrato público de validação documental/QR e os campos que podem ser expostos.
- Aprovar os testes de homologação e a janela de manutenção antes de aplicar a migração.
