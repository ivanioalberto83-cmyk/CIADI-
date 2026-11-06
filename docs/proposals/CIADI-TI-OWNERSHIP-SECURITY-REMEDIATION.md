# CIADI TI — proposta de correcção de ownership e privilégios

**Estado:** proposta técnica para revisão; NÃO aplicada à base de dados.  
**Projecto:** CIADI / schema `ciadi_ti`  
**Base observada:** políticas e privilégios consultados em modo read-only em 2026-11-06.

## 1. Evidência confirmada

A política `ti_support_edit_own_drafts` actualmente instalada em `ciadi_ti.purchase_requests` permite UPDATE quando:
- `ciadi_ti.has_support_access()` é verdadeiro; e
- o estado actual é `draft` ou `returned`.

A política não compara `requested_by` com `auth.uid()`. O `WITH CHECK` permite os estados `draft`, `submitted` e `cancelled`, também sem validar o autor.

A tabela concede `UPDATE` a `authenticated` ao nível da tabela. Por isso, apenas acrescentar uma condição RLS não impede que um utilizador altere colunas de decisão financeira, como `finance_decision_by`, `finance_decision_at` e `finance_decision_note`, mesmo que não consiga definir o estado para `approved` ou `rejected`.

A função `decide_purchase_request(uuid,text,text)` valida `has_finance_approval()`, aceita apenas `approved/rejected` e só decide pedidos em `submitted`. A função `has_finance_approval()` confirma utilizador activo com tipo `admin` ou `gestor`. Esta separação deve ser preservada.

## 2. Objectivo de autorização

- Suporte Informático mantém acesso operacional global ao módulo e leitura institucional dos pedidos.
- O autor pode editar o seu próprio pedido enquanto estiver em `draft` ou `returned`.
- Administração/Gestão pode prestar intervenção operacional nos pedidos em edição, sem substituir o acto formal de decisão.
- Só Administração/Gestão pode aprovar ou rejeitar, através da RPC existente.
- O cliente não pode alterar `requested_by` nem os metadados da decisão financeira.
- Nenhuma permissão é concedida pelo perfil da estação ou por valores enviados pelo renderer; a identidade efectiva é `auth.uid()` e o perfil activo em `public.perfis`.

## 3. SQL proposto — revisão obrigatória antes de migração

O bloco abaixo é uma proposta de desenho, não uma instrução para executar em produção. Antes de o transformar numa migração, confirmar os grants herdados, eventuais políticas adicionais e o comportamento dos formulários existentes.

```sql
begin;

-- Retirar o UPDATE geral e voltar a conceder apenas as colunas operacionais.
-- A coluna requested_by e os campos da decisão financeira ficam fora do grant.
revoke update on table ciadi_ti.purchase_requests from authenticated;

grant update (
  supplier_id,
  status,
  justification,
  estimated_total,
  updated_at
) on table ciadi_ti.purchase_requests to authenticated;

drop policy if exists ti_support_edit_own_drafts
  on ciadi_ti.purchase_requests;

create policy ti_support_edit_own_drafts
on ciadi_ti.purchase_requests
for update
to authenticated
using (
  ciadi_ti.has_support_access()
  and (requested_by = (select auth.uid())
       or ciadi_ti.has_finance_approval())
  and status in ('draft', 'returned')
)
with check (
  ciadi_ti.has_support_access()
  and (requested_by = (select auth.uid())
       or ciadi_ti.has_finance_approval())
  and status in ('draft', 'submitted', 'cancelled')
);

commit;
```

### Limitações deliberadas desta proposta

1. Não permite cancelar um pedido já aprovado através de UPDATE directo. Se esse caso for necessário, deve existir uma RPC específica, com motivo obrigatório, validação do perfil e registo de auditoria.
2. A política de linhas (`purchase_request_lines`) ainda permite a equipa de Suporte alterar linhas de pedidos em `draft/returned`. Deve ser alinhada com a propriedade do pedido, usando uma política correlacionada que confirme o autor ou Administração/Gestão.
3. A política de inventário físico permite transição para `counted`, mas não foi encontrada nesta revisão uma RPC de reconciliação que valide diferenças e produza movimentos de stock. Não permitir que o estado `counted` seja tratado como reconciliação concluída.
4. A política de INSERT de pedidos permite criar directamente em `submitted`. Deve ser avaliado se a submissão precisa de RPC transaccional para validar linhas, total e evento de auditoria.
5. Confirmar se o trigger de auditoria regista alterações e se a função de decisão é a única via de alteração dos campos financeiros.

## 4. Testes obrigatórios antes de qualquer aplicação

Executar em ambiente isolado, com utilizadores e dados sintéticos:
- Autor A actualiza o próprio pedido em `draft`: permitido.
- Autor A actualiza o próprio pedido em `returned`: permitido.
- Autor A actualiza pedido do Autor B: negado.
- Suporte B actualiza pedido do Autor A: negado, salvo intervenção explicitamente aprovada por Administração/Gestão.
- Utilizador tenta mudar `requested_by`: negado por privilégio de coluna.
- Utilizador tenta alterar `finance_decision_by/at/note`: negado por privilégio de coluna.
- Suporte tenta definir estado `approved` ou `rejected`: negado.
- Suporte tenta chamar decisão financeira: negado pela RPC.
- Administração/Gestão decide pedido `submitted`: permitido através da RPC.
- Repetir testes para as linhas do pedido e confirmar que não é possível mover uma linha para outro pedido.

## 5. Critérios de saída

Só considerar a correcção pronta quando:
- A migração tiver sido revista por segundo revisor.
- Todos os testes RLS e RPC acima forem executados em ambiente isolado.
- Os fluxos de criação, edição, submissão e decisão forem testados no Dashboard.
- A auditoria confirmar autor, actor, data e estado antes/depois.
- Existir backup com restauro demonstrado antes de qualquer proposta de aplicação em produção.

**Sem autorização separada, não aplicar esta proposta ao Supabase de produção, não fazer merge e não gerar Setup.**
