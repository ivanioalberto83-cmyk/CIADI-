# CIADI Dashboard — plano de correcção das seis vistas e testes de regressão

**Estado:** preparação estática; NÃO aplicado à base de dados de produção.  
**Restrição:** sem custos adicionais, sem branches Supabase pagos e sem alteração de dados/esquema em produção nesta fase.  
**Project ref:** `egpkkttbcaukqnnxyhjv`

## 1. Constatações confirmadas por consulta read-only

As seis vistas abaixo têm actualmente privilégios SELECT para os papéis `anon` e `authenticated`. As definições consultadas não têm a opção `security_invoker=true`.

- `public.v_ciadi_at_pacientes_atribuidos` — IDs, nomes de pacientes e profissionais, atribuições e permissões.
- `public.v_ciadi_lancamentos_contabeis` — lançamentos, referências, documentos, empresa/período e débitos/créditos.
- `public.v_ciadi_balancete` — contas e saldos.
- `public.v_ciadi_dre` — rendimentos, gastos e resultado.
- `public.v_ciadi_balanco_patrimonial` — saldos por tipo de conta.
- `public.v_ciadi_calendario_aniversarios` — nomes, datas de nascimento e opções de visibilidade.

Isto é uma exposição potencial de dados via API, não prova que tenha ocorrido acesso indevido.

## 2. Sequência segura da correcção

1. Inventariar todas as referências a estas vistas no frontend, Edge Functions e RPCs.
2. Inspeccionar RLS e privilégios das tabelas de origem, incluindo `ciadi_atribuicoes_at`, `pacientes`, `profissionais`, `ciadi_aniversarios`, `finance_contas`, `finance_lancamentos` e `finance_lancamento_linhas`.
3. Preparar uma migração que retire o acesso `anon` às seis vistas.
4. Decidir, vista a vista, entre `security_invoker=true` e uma função/RPC autorizada. Não activar a opção em massa antes de validar privilégios e RLS das tabelas de origem.
5. Conceder acesso apenas aos papéis que realmente necessitam. O papel `authenticated` inclui todos os utilizadores autenticados; por si só, o GRANT a esse papel não separa administrador, gestor, profissional ou paciente.
6. Testar num ambiente isolado já disponível e sem custo adicional. Se não houver ambiente seguro gratuito, manter a alteração preparada e não executar em produção.
7. Só depois de aprovação explícita e plano de recuperação, agendar a aplicação em produção.

**Não executar automaticamente:** o SQL abaixo é uma proposta de primeiro passo para a futura migração, não foi aplicado.

```sql
BEGIN;

REVOKE ALL ON TABLE
  public.v_ciadi_at_pacientes_atribuidos,
  public.v_ciadi_lancamentos_contabeis,
  public.v_ciadi_balancete,
  public.v_ciadi_dre,
  public.v_ciadi_balanco_patrimonial,
  public.v_ciadi_calendario_aniversarios
FROM anon;

COMMIT;
```

Não adicionar ainda um GRANT global a `authenticated` nem revogar o acesso de todos os utilizadores autenticados até o frontend e as políticas RLS terem sido validados.

## 3. Verificações read-only

Executar antes e depois da migração no ambiente de teste:

```sql
SELECT c.relname AS view_name,
       c.reloptions,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname IN (
    'v_ciadi_at_pacientes_atribuidos',
    'v_ciadi_lancamentos_contabeis',
    'v_ciadi_balancete',
    'v_ciadi_dre',
    'v_ciadi_balanco_patrimonial',
    'v_ciadi_calendario_aniversarios'
  )
ORDER BY c.relname;
```

Critério mínimo após a primeira etapa: `anon_select = false` para todas as seis vistas. A coluna `authenticated_select` é informativa, não prova que os dados estejam devidamente filtrados.

## 4. Matriz de testes de regressão

- [ ] Cliente sem sessão: leitura directa das seis vistas recusada.
- [ ] Profissional: consulta apenas os pacientes atribuídos e os campos necessários à função.
- [ ] Paciente/responsável: sem acesso a dados de outros pacientes.
- [ ] Gestor/admin autorizado: relatórios financeiros funcionam conforme a matriz de permissões.
- [ ] Utilizador autenticado sem função financeira: não consegue consultar lançamentos ou saldos financeiros.
- [ ] Calendário: respeita visibilidade, permissões e minimização de dados pessoais.
- [ ] Frontend: sem erros de carregamento nos ecrãs clínicos, financeiros e de calendário.
- [ ] Edge Functions/RPC: operações autorizadas continuam a funcionar; chamadas não autorizadas são recusadas.
- [ ] Relatórios: comparar contagens e totais contabilísticos antes/depois com o mesmo conjunto de dados de teste.
- [ ] Auditoria: registar resultado, data, ambiente e responsável por cada teste.

## 5. Critérios de saída

A correcção só fica concluída quando: (a) nenhum acesso anónimo consegue ler as vistas internas; (b) RLS/privilégios limitam dados por utilizador; (c) os testes clínicos e financeiros passam; (d) o frontend não perde funcionalidades autorizadas; e (e) existe um plano de recuperação testado.

## 6. Comparação funcional CIADI vs. ERP

O CIADI deve manter o foco especializado no percurso clínico: paciente/família → agendamento → profissional → atendimento → documento clínico → facturação → pagamento. Para uma comparação com um ERP como o Primavera, verificar evidência funcional, e não apenas a existência de tabelas, para contabilidade, fecho de períodos, tesouraria, reconciliação bancária, facturação, SAF-T/AGT, auditoria, compras, fornecedores, inventário, RH e salários.

A identificação exacta do produto designado por “SEGID” continua pendente de nome completo, fabricante ou URL oficial. Não se atribuem funcionalidades a esse produto sem essa identificação.
