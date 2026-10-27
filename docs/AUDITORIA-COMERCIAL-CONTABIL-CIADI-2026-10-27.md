# Auditoria comercial, faturação e contabilidade — CIADI
**Data:** 2026-10-27  
**Âmbito:** leitura da estrutura Supabase de produção e inspeção estática do código na branch `feature/ciadi-compras-contabilidade-integrada`.  
**Modo:** somente leitura. Não foram executadas migrações, inserções, atualizações, alterações de políticas, nem emissão de documentos.

## Resumo executivo
**Estado: NÃO APTO para emissão fiscal oficial; apto apenas para continuar preparação e homologação controlada.**

A base consultada tem 129 tabelas públicas (40 com prefixo `finance_`), mas as estruturas existentes não demonstram um circuito comercial-contabilístico validado de ponta a ponta. As tabelas consultadas de documentos, clientes e lançamentos não têm registos operacionais. A matriz interna de conformidade AGT marca transmissão como pendente e várias áreas críticas como parciais.

## Evidência estrutural observada
- Empresa emitente: existe um registo ativo/principal.
- Cadastro comercial `finance_clientes`: 0 registos.
- `finance_documentos`: 0 registos.
- `finance_lancamentos`: 0 registos.
- `finance_servicos`: catálogo inicial com 5 registos.
- `finance_series`: 5 séries FT26, FR26, NC26, ND26 e RC26. O próximo número está em 1 e o último em 0; os códigos de série AGT e as quantidades autorizadas estão por preencher.
- `finance_contas`: 6 contas; `finance_diarios`: 3; `finance_periodos_contabeis`: 2 períodos abertos.
- `finance_regras_contabilizacao`: 1 regra; `finance_regras_faturacao_clinica`: 0 regras.
- `finance_contas_bancarias`: 0 registos; `finance_pagamentos`: 0 registos.
- `finance_saft_exports`: 1 exportação no estado `gerado`; isto não prova validação contra o esquema nem aceitação pela AGT.
- A matriz `finance_agt_conformidade` assinala transmissão como pendente; séries, assinatura, integridade, SAF-T e contabilidade como parciais.

## Achados críticos
### F-01 — A função de emissão valida o número antes de o atribuir
`ciadi_faturacao_emitir_documento(uuid)` chama `ciadi_validar_documento_fiscal(uuid)` antes de incrementar a série. A validação exige `numero_sequencial > 0` e número documental, mas a função de emissão só os atribui depois da validação. O fluxo, tal como está definido, tende a rejeitar um rascunho normal antes de chegar à numeração. Corrigir com validação pré-emissão separada, numeração atómica e validação final dentro da mesma transação — apenas após os controlos AGT estarem definidos.

### F-02 — A emissão não comprova validação/adesão AGT
A função marca `fiscal_status='emitido'`, calcula SHA-256 e grava snapshots, mas a definição consultada não demonstra assinatura fiscal válida, número de validação do software preenchido, autorização ativa da série ou transmissão efetiva/confirmada à AGT. O hash SHA-256 não é, por si só, uma assinatura fiscal nem uma prova de aceitação pela AGT. Manter a emissão oficial bloqueada até existir implementação e evidência verificável.

### F-03 — Incompatibilidade potencial na contabilização de faturas
`ciadi_finance_contabilizar_documento(uuid)` calcula `base = subtotal - retencao`, sem subtrair o desconto, e depois lança crédito de base e imposto contra débito do total. Para documentos com desconto/retenção, os totais podem não equilibrar. Também deve ser verificada a expressão textual usada na descrição do lançamento e a atomicidade da criação/reversão. Testar com casos de desconto, imposto e retenção antes de qualquer ativação.

### F-04 — Segurança das funções RPC
O Security Advisor do Supabase (observado em 2026-10-27) reporta:
- 2 vistas classificadas como SECURITY DEFINER;
- 4 funções SECURITY DEFINER executáveis por `anon`;
- 79 funções SECURITY DEFINER executáveis por `authenticated`.

Estes avisos não significam automaticamente que todas as funções sejam exploráveis: cada função deve ser revista quanto a autorização interna e intenção de exposição. A função trigger `finance_bloquear_alteracao_fiscal()` aparece exposta por RPC apesar de ser uma função de trigger; o privilégio EXECUTE deve ser restringido às funções realmente necessárias. As vistas `v_ciadi_at_pacientes_atribuidos` e `v_ciadi_calendario_aniversarios` devem ser revistas quanto a exposição de dados pessoais e semântica RLS.

### F-05 — Compras não está confirmada em produção
A migração `20261027120000_ciadi_compras_contabilidade.sql` está na branch de desenvolvimento, não foi executada na base de produção consultada. Cria ordens de compra e funções de aprovação/contabilização, mas precisa de testes e revisão de segurança antes de ser aplicada.

### F-06 — Cadastro e operação comercial por demonstrar
Não há clientes nem documentos nas tabelas consultadas. Não foi possível comprovar cadastro completo de particulares/empresas/fornecedores, emissão de rascunho, impressão A4, pagamento, contas a receber, contabilização, SAF-T e reconciliação ponta a ponta.

## Achados adicionais
- `ciadi_validar_documento_fiscal` não verifica, na definição lida, todos os requisitos de emissão oficial (estado de validação do software, autorização de série e transmissão AGT).
- `ciadi_faturacao_criar_documento` cria documentos em edição com número temporário `EM-EDICAO-...` e sequencial 0; isso é apropriado para rascunho, mas exige um fluxo de emissão coerente.
- A regra de faturação clínica está ausente; o vínculo entre serviço clínico, preço, imposto, conta de receita e eventual centro de custo tem de ser definido e testado.
- A configuração SAF-T indica ambiente `producao`, mas a presença desse valor não comprova certificação, validação nem adesão AGT.
- O estado RLS ativo nas tabelas não prova a correção das políticas; faltam testes por perfil e análise completa dos privilégios de cada RPC.

## Plano recomendado
1. Manter produção intacta e emissão fiscal oficial bloqueada.
2. Rever privilégios EXECUTE e as funções/vistas sinalizadas pelo Security Advisor, sem revogações em massa.
3. Definir testes automatizados para criação/edição de rascunho, validação pré-emissão, numeração, imutabilidade, anulação/correção e auditoria.
4. Corrigir e testar o cálculo contabilístico para FT com e sem desconto, imposto e retenção; verificar que débito = crédito e que o lançamento não duplica.
5. Completar cadastro comercial, serviços, taxas, plano de contas, diários, períodos, pagamentos e regras de faturação clínica.
6. Validar exportação SAF-T contra o esquema aplicável e preparar o processo de validação/adesão AGT.
7. Só depois de backup com restauro testado, revisão e autorização explícita, planear migração controlada.

## Limites desta auditoria
É uma auditoria estática/estrutural, não um teste de penetração nem uma certificação jurídica/fiscal. Não foram gerados documentos reais, não foram consumidos números de série e não foi feita qualquer alteração à base de produção. As conclusões devem ser confirmadas por testes em ambiente isolado e por especialista fiscal/AGT antes da emissão oficial.
