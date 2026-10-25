# CIADI — reconciliação do histórico de migrações
Data da verificação: 2026-10-25  
Ambiente: Supabase de produção, consulta apenas de leitura.  
Branch de trabalho: `security/remediation-2026-10`.

## Resultado confirmado
- O Supabase reporta **98 migrações aplicadas**.
- Primeira migração listada: `20260911125708_dashboard_conteudos_documentos_v1`.
- Última migração listada: `20261001050745_criar_validacao_pre_saft`.
- A branch `main` do repositório não contém a pasta de migrações SQL correspondente; portanto, o histórico aplicado não pode ser reproduzido fielmente a partir do código versionado atual.
- O projeto Supabase está com estado reportado `ACTIVE_HEALTHY`, PostgreSQL 17.6.1. Isso não constitui certificação de segurança nem validação fiscal.

## Risco e decisão
Não criar uma nova migração executável nem reaplicar scripts inferidos apenas a partir dos nomes das 98 migrações. Isso pode duplicar objetos, alterar políticas RLS, quebrar funções dependentes ou afetar documentos financeiros/fiscais.

## Próxima sequência segura
1. Obter um dump de esquema sem dados, com funções, triggers, views, grants, políticas RLS, extensões e configurações relevantes; guardar fora do repositório e verificar checksum.
2. Recuperar os 98 scripts originais do histórico de desenvolvimento/CI, backups ou artefactos de execução; não reconstruir pelo nome.
3. Comparar o dump atual com o conjunto de scripts recuperados e produzir uma matriz de divergências por objeto.
4. Confirmar backup restaurável antes de preparar qualquer correção; o backup de esquema previamente identificado como 0 bytes não serve como recuperação.
5. Produzir correções pequenas e idempotentes numa branch isolada, com testes positivos/negativos por papel e tenant, revisão de dependências e plano de rollback.
6. Aplicar somente em homologação primeiro. Produção permanece sem alterações até aprovação explícita e validação dos testes.

## Áreas prioritárias de validação
- Duas views SECURITY DEFINER identificadas pelo advisor: `v_ciadi_at_pacientes_atribuidos` e `v_ciadi_calendario_aniversarios`.
- RPCs SECURITY DEFINER expostas a `anon` relacionadas com validação documental, triagem pública e bloqueio fiscal; validar intenção de exposição e respetivos privilégios.
- A proteção contra alteração fiscal deve ser analisada no contexto dos triggers antes de qualquer alteração de EXECUTE.
- A lista de 79 funções SECURITY DEFINER executáveis por `authenticated` é um sinal para revisão por função, não prova isolada de vulnerabilidade. Verificar autorização interna, tenant, efeitos laterais e consumidores antes de restringir privilégios.

## Critérios para desbloquear uma migração
- Origem do SQL e estado inicial/final comprovados.
- Backup restaurado com sucesso num ambiente isolado.
- Testes de autorização para utilizador anónimo, autenticado, profissional, gestor e administrador conforme o objeto.
- Testes de isolamento entre pacientes/tenants, regressão dos fluxos clínicos e financeiros e validação de rollback.
- Diff revisto por pessoa responsável e aprovação antes de produção.

## Limite desta etapa
Esta verificação consultou o inventário de migrações e os avisos de segurança. Não executou DDL, não alterou políticas/privilégios, não publicou funções e não modificou dados.
