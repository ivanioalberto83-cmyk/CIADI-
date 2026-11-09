# CIADI — Execução gratuita dos testes P0 de catálogo

**Estado:** script de regressão preparado; ainda não executado contra PostgreSQL/Supabase.  
**Finalidade:** detectar regressões nos metadados de políticas, grants e funções que originaram os achados P0.  
**Segurança:** o script abre uma transacção `READ ONLY`, não altera objectos nem dados e termina com `ROLLBACK`.

## Ficheiro
`supabase/tests/ciadi_p0_security_catalog.sql`

## O que verifica
1. A política SELECT de `public.ciadi_conhecimentos` não pode permitir leitura anónima sem filtrar classificação pública e estado activo; também aceita o encerramento completo do acesso anónimo.
2. `anon` não pode ter INSERT em `estado`, `codigo_candidatura`, `cv_storage_path`, `email_enviado_at` ou `email_erro` em `recrutamento_candidaturas`.
3. Não pode existir política genérica baseada em `is_staff()` para o bucket privado `documentos`.
4. Não pode existir política genérica `is_staff()` para INSERT/UPDATE em `ciadi-app-updates`.
5. A função `ciadi_faturacao_emitir_documento` não pode continuar a usar a verificação genérica `is_staff()`. A autorização financeira específica tem de ser revista separadamente.

## Execução
Executar apenas numa base local ou num projecto/branch de desenvolvimento isolado, com o esquema CIADI e as migrações correspondentes:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/ciadi_p0_security_catalog.sql
```

O script deve terminar sem excepções. Uma mensagem `P0 FAIL` significa que o achado continua presente. A mensagem `E REVIEW` exige confirmar se a função foi renomeada ou se a migração de teste não a instalou.

## Limitações
- Não testa SELECT de linhas reais nem o comportamento de RLS com JWTs de utilizadores fictícios.
- Não testa uploads/downloads reais no Storage, Edge Functions, rate limiting ou fluxos de recrutamento.
- Não substitui os testes positivos/negativos da matriz `CIADI-PLANO-TESTES-SEGURANCA-P0-2026-10-30.md`.
- Não executar contra produção como substituto de um ambiente isolado.
- Não inclui correcções/migrações; apenas detecta se as condições inseguras auditadas ainda existem.

## Opção sem custo
O script pode ser executado num computador próprio com PostgreSQL/Supabase CLI/Docker já disponível, sem criar uma branch Supabase paga. Se o ambiente local não tiver esses componentes, manter o script preparado até existir equipamento/ambiente gratuito apropriado.
