# CIADI — plano de remediação específico (sem executar em produção)

Data da verificação: 2026-10-25. Fonte: definições atuais obtidas por consulta SQL read-only ao projeto Supabase CIADI.

## Riscos confirmados no código consultado

1. `ciadi_registrar_acesso_validacao(text)` é SECURITY DEFINER com `search_path=public`, acessível publicamente segundo o advisor. Faz update de contador/último acesso e devolve código e hash.
2. `ciadi_registrar_triagem_publica(...)` é SECURITY DEFINER e aceita chamadas públicas. Valida alguns campos obrigatórios e consentimento, mas não contém no corpo inspecionado rate limit, limites de comprimento nem validação explícita de data futura/idade. Insere dados pessoais e informação de saúde de criança em `ciadi_triagens.dados_json`.
3. `ciadi_registrar_validacao_documento(text)` é SECURITY DEFINER e devolve dados do documento clínico, nome/registro profissional, hashes e QR payload para quem possuir o código. Necessário confirmar que código é de alta entropia, não enumerável, e que o payload público foi concebido para expor exatamente estes campos.
4. As duas views sinalizadas pelo advisor continuam com finding `security_definer_view`: `v_ciadi_at_pacientes_atribuidos`, `v_ciadi_calendario_aniversarios`.

## Alterações propostas — ainda NÃO aplicadas

- Não revogar EXECUTE de funções públicas sem identificar os formulários, QR codes e integrações que as chamam.
- Triagem pública: manter consentimento explícito, adicionar limites de comprimento/tamanho, validação de data, normalização, rate limit robusto por IP/telefone/email (preferencialmente gateway/Edge Function com proteção contra abuso), e retorno sem dados clínicos desnecessários. Não confiar apenas num rate limit baseado em parâmetro fornecido pelo cliente.
- Validação de documento: separar uma resposta pública mínima da consulta autenticada interna; não expor QR payload ou identificadores internos sem necessidade. Garantir código aleatório com entropia adequada em novos registos e respostas uniformes para inválido/inativo. Rever compatibilidade dos QR já emitidos.
- Views: avaliar migração para SECURITY INVOKER após testes de RLS e compatibilidade. Não mudar para invoker antes de confirmar policies, roles, e consumidores.
- Definir `search_path` seguro por função (schema explícito e `pg_catalog`/schemas necessários) e qualificar referências; aplicar grants EXECUTE mínimos por função.
- Manter `finance_bloquear_alteracao_fiscal()` fora de alterações até teste fiscal e revisão do trigger que a invoca.

## Critérios de aceitação

1. anon não consegue ler tabelas clínicas diretamente.
2. formulário público pode criar triagem apenas com consentimento verdadeiro, dados válidos e dentro de limites; chamadas em excesso são limitadas.
3. QR público devolve apenas campos explicitamente aprovados e não permite enumeração prática.
4. profissional/paciente/responsável continuam a ver apenas dados autorizados por RLS.
5. testes de regressão da Clínica Virtual, portal familiar, validação de documentos e faturação passam.
6. plano de rollback contém definições anteriores e procedimento verificado em homologação.

## Bloqueios antes de uma migration executável

- Confirmar consumidores no frontend/Edge Functions e policies/grants reais.
- Confirmar a localização versionada das migrations e reconciliar o histórico local com `supabase_migrations.schema_migrations`.
- Preparar testes em projeto/branch de homologação; não alterar produção neste passo.
