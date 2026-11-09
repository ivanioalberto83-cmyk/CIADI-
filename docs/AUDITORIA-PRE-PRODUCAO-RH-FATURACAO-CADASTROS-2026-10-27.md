# Auditoria de pré-produção CIADI — RH, faturação, cadastros e sincronização

**Data:** 2026-10-27  
**Projeto Supabase:** `egpkkttbcaukqnnxyhjv`  
**Branch de código inspecionada:** `feature/ciadi-compras-contabilidade-integrada`  
**Modo:** leitura; não foram alterados dados, tabelas, RLS, políticas ou funções da base de produção.

## Conclusão executiva

**Estado: NÃO APTO para iniciar produção com RH/faturação/compras.** O dashboard tem ecrãs e tabelas de base, mas existem incompatibilidades verificáveis entre o módulo de compras e o esquema, o RH está apenas em consulta e a configuração fiscal/comercial está incompleta. A auditoria não certifica conformidade AGT nem autorização fiscal.

## 1. Dados e configuração encontrados

| Área | Estado observado | Implicação |
|---|---|---|
| Cadastro comercial | `finance_clientes`: 0 registos | Não há clientes/entidades/fornecedores comerciais cadastrados |
| Faturação | `finance_documentos`: 0; linhas: 0; pagamentos: 0 | Não há documentos ou pagamentos registados |
| Séries | 5 séries de 2026: FT26, FR26, NC26, ND26, RC26 | Campos `codigo_serie_agt`, `quantidade_autorizada`, `primeiro_documento_agt`, `ultimo_documento_agt` estão vazios |
| Emitente/empresa | 1 empresa e 1 configuração de emitente | NIF e contacto existem; regime fiscal, código de atividade e logótipo não configurados |
| Software fiscal | 1 registo de software; `software_validation_number` nulo | Não assumir validação/certificação fiscal |
| Serviços | 5 serviços ativos | Todos com preço base 0, taxa de imposto 0 e sem código de imposto/conta de receita |
| RH | `ciadi_funcionarios`: 0; contratos: 0; confidencial: 0; assiduidade: 0 | Não existem colaboradores/contratos RH registados |
| Base profissional | `profissionais`: 5; `perfis`: 9 | Há registos profissionais/perfis, mas não equivalem automaticamente a colaboradores RH |
| Contabilidade | 6 contas; 0 lançamentos; 2 períodos contabilísticos | Não há movimentos contabilísticos para validar o ciclo completo |
| Caixa e centros de custo | 1 caixa; 1 centro de custo `CC-001 ` (espaço final), empresa_id nulo | O centro precisa de normalização controlada; não criar/alterar dados sem plano e autorização |

## 2. Erros confirmados no módulo Aprovisionamento / Compras

O HTML consulta `finance_compras_ordens`, mas essa relação **não existe** na base consultada. As funções RPC seguintes também não existem:

- `finance_compras_criar_ordem`
- `finance_compras_aprovar_ordem`
- `finance_compras_vincular_despesa`
- `finance_aprovar_despesa`
- `finance_postar_despesa`

O módulo consulta ainda em `finance_despesas` os campos `fornecedor_id`, `aprovacao_estado` e `contabilizacao_estado`, mas nenhum destes campos existe no esquema atual. A tabela contém `fornecedor_nome` e `fornecedor_nif`, sem chave estrangeira para o cadastro comercial.

**Impacto:** a consulta inicial do módulo de compras deverá falhar; criação/aprovação/associação de ordens e contabilização de despesas não estão ligadas a uma implementação de backend existente. Não ativar o módulo em produção até alinhar schema, RPCs, políticas e testes.

## 3. RH

O ecrã `ciadiHR()` lê `ciadi_funcionarios`, `profissionais`, `ciadi_funcionario_contratos` e `ciadi_funcionario_assiduidade`. A própria interface declara que é uma vista de leitura. Não há, nesse ecrã, fluxo de criação/edição de funcionário, contrato, documentos confidenciais, férias/licenças, processamento salarial ou recibos.

As tabelas RH existem e têm RLS, mas isso não comprova que as políticas sejam adequadas para todos os casos. Antes de RH em produção, testar permissões por perfil e restringir dados confidenciais (NIF, INSS, IBAN, salário e dados bancários) a funções estritamente autorizadas.

## 4. Faturação e dados comerciais

O cadastro comercial usa `finance_clientes` para cliente, entidade e fornecedor; não existe uma tabela separada `finance_fornecedores`. Esta abordagem unificada pode funcionar, mas requer um modelo explícito de categoria e referências consistentes nas despesas/ordens.

A emissão A4 no HTML declara que guarda **rascunhos de homologação**, apenas FT, sem validade fiscal oficial. A função `ciadi_faturacao_criar_documento` existe; isto não comprova, por si só, que o ciclo fiscal completo esteja validado. Antes de produção é necessário:
- completar os dados fiscais do emitente e validar os dados com a entidade responsável;
- configurar serviços, preços, impostos, códigos e contas de receita;
- validar séries, códigos/autorizações e sequência documental aplicável;
- testar imutabilidade, anulação, pagamentos, notas de crédito/débito, auditoria, SAF-T(AO) e reconciliação;
- executar testes ponta a ponta em ambiente de homologação, com evidência verificável.

## 5. Sincronização / Realtime

A publicação `supabase_realtime` inclui `ciadi_sos_alertas` entre as tabelas consultadas. Não inclui `finance_clientes`, `finance_documentos`, `finance_pagamentos`, `finance_despesas`, tabelas RH nem caixas. O HTML só contém uma subscrição realtime explícita para alertas SOS.

**Impacto:** os restantes ecrãs não têm sincronização realtime demonstrada; carregam dados ao abrir/atualizar. A sincronização entre os dois polos não está provada por este código/esquema.

## 6. Separação por polo

O centro de custo atual é apenas um registo `CC-001 ` com espaço final e `empresa_id` nulo. A estrutura de `finance_documentos` não tem `centro_custo_id`; despesas têm `centro_custo` como texto, não FK. `ciadi_funcionarios` também usa `centro_custo` em texto. Não foi confirmada uma associação de polo nos perfis que imponha isolamento por linha.

**Impacto:** não declarar isolamento Talatona/Jardim de Rosas pronto. Desenhar primeiro o mapeamento polo/centro de custo e rever as políticas RLS existentes, incluindo políticas permissivas sobrepostas. Não executar migrações ou normalizações sem backup, plano de rollback e autorização.

## 7. Alertas de segurança/performance do Supabase

Leitura dos Database Advisors em 2026-10-27:
- 2 erros `security_definer_view` (`v_ciadi_at_pacientes_atribuidos`, `v_ciadi_calendario_aniversarios`);
- 4 funções SECURITY DEFINER executáveis por `anon`;
- 79 funções SECURITY DEFINER executáveis por `authenticated` (requer revisão função a função; não significa que todas sejam vulneráveis);
- proteção contra palavras-passe comprometidas desativada;
- 65 casos de políticas permissivas múltiplas;
- 134 chaves estrangeiras sem índice de cobertura;
- 51 avisos de inicialização de auth/RLS e 18 índices duplicados.

As vistas contabilísticas `v_ciadi_balancete`, `v_ciadi_balanco_patrimonial`, `v_ciadi_dre`, `v_ciadi_financeiro_resumo` e `v_finance_reconciliacao_resumo` estão definidas com `security_invoker=true`; manter a revisão de permissões das dependências e não expor dados sem teste de utilizador.

## 8. Fonte e compilação Windows

O ficheiro `CIADI_DASHBOARD_FINANCEIRO(1).html` não foi encontrado no caminho consultado da branch principal nem na branch de trabalho. O ficheiro disponível na branch de trabalho é `CIADI_DASHBOARD_FINANCEIRO.html` (blob SHA `e72f73455dff10334cdc93588606ebd927b78be3`). O workflow foi alinhado para procurar o nome documentado com `(1)`, portanto falhará de forma segura até esse ficheiro estar realmente no repositório. Não compilar usando outra fonte silenciosamente.

## 9. Plano de correção recomendado

1. Confirmar e versionar a fonte HTML oficial escolhida, sem sobrescrever a versão anterior.
2. Corrigir o módulo de compras: definir tabela/estrutura, FK do fornecedor, estados de aprovação/contabilização, RPCs com autorização explícita e idempotência; ou ocultar o módulo até estar pronto.
3. Implementar os fluxos RH que faltam e testes de acesso a dados confidenciais.
4. Completar cadastro comercial e configuração fiscal/serviços/séries em homologação.
5. Definir modelo polo/centro de custo e RLS antes de dados operacionais reais.
6. Rever funções/views e políticas indicadas pelos Advisors.
7. Ativar Realtime apenas para tabelas e eventos necessários após rever RLS, e testar atualização/duplicação/conflitos.
8. Compilar Setup Windows em CI, testar instalação/atualização e validar cada fluxo com utilizadores de teste. Só depois avaliar produção.

**Limites desta auditoria:** foi uma inspeção read-only de catálogo, dados de configuração, políticas/advisors e código-fonte disponível na branch. Não foram criados registos, emitidos documentos fiscais, testadas credenciais reais nem aplicadas alterações à base de produção.
