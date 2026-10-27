# CIADI — Mapa técnico de separação por polo (auditoria read-only)

Data da auditoria: 2026-10-27  
Branch: `feature/ciadi-compras-contabilidade-integrada`  
Supabase consultado: projeto CIADI (`egpkkttbcaukqnnxyhjv`)  
**Estado:** apenas leitura. Nenhuma alteração foi aplicada ao Supabase; nenhum dado foi reclassificado.

## 1. Modelo operacional aprovado para desenvolvimento

- `CC-001` — CIADI Polo Talatona.
- `CC-002` — CIADI Polo Jardim de Rosas.
- Cada operação comercial/financeira deve ter um polo responsável.
- A Direção pode ter acesso consolidado; os restantes utilizadores só acedem aos centros que lhes forem atribuídos.
- O catálogo de serviços pode ser comum quando o serviço é realmente comum, mas preço, disponibilidade, stock/consumo, caixa, vendas e resultados devem ser controlados por polo quando aplicável.
- Um seletor de polo na interface é apenas contexto de trabalho; RLS e validação de relações na base de dados têm de impor o isolamento.
- Dados históricos sem associação segura ficam pendentes de classificação administrativa. Não preencher o centro automaticamente por suposição.

## 2. Estruturas identificadas no Supabase

### Registos principais de operação

| Tabela | Situação observada | Tratamento de desenho recomendado |
|---|---|---|
| `finance_centros_custo` | Tem `id`, `codigo`, `nome`, `ativo`, `empresa_id`; RLS ativo | Catálogo central de polos/custos. Confirmar duplicados antes de normalizar CC-001. |
| `ciadi_centros_acesso` | Não existia na auditoria anterior; prevista na migração versionada, ainda não aplicada | Associação perfil-centro; verificar RLS e funções antes de aplicar. |
| `finance_clientes` | Não tem `centro_custo_id`; tem `empresa_id` | Decidir se cliente é cadastro central partilhado (recomendação inicial) e separar consultas/relatórios operacionais por polo. Não duplicar clientes automaticamente. |
| `finance_servicos` | Tem `empresa_id`, sem centro de custo | Catálogo potencialmente comum; se preços diferirem por polo, criar modelo explícito de preço/serviço por centro em migração futura. Não duplicar serviços por suposição. |
| `finance_documentos` | Não tem `centro_custo_id`; tem `serie_id`, `cliente_id`, `empresa_id`, `agendamento_id` | Centro explícito no cabeçalho ou derivação validada por origem/caixa; nunca confiar apenas no filtro da interface. |
| `finance_documento_linhas` | Tem `documento_id`, `servico_id`; sem centro | Herdar a autorização do documento pai; impedir linhas órfãs ou ligação a documento de outro polo. |
| `finance_despesas` | Tem `centro_custo` textual e `empresa_id`, sem FK UUID | Migrar futuramente para FK UUID com mapeamento validado; manter texto histórico até classificação controlada. |
| `finance_pagamentos` | Tem `documento_id`, `empresa_id`, sem centro | Acesso herdado do documento pai; validar também inserções e alterações. |
| `finance_pagamentos_despesas` | Tem `despesa_id`, sem centro | Acesso herdado da despesa pai. |
| `finance_caixas` | Tem `empresa_id`, sem `centro_custo_id` | Associar cada caixa a um centro; não permitir um caixa servir ambos os polos como operação normal. |
| `finance_caixa_turnos` | Tem `caixa_id`, sem centro | Herdar o centro do caixa e validar operador autorizado. |
| `finance_movimentos_caixa` | Já tem `centro_custo_id` e referências a caixa/documento/pagamento/turno | Validar consistência entre centro próprio e todos os registos relacionados. Não aceitar centro diferente do caixa. |
| `finance_auditoria_operacoes` | Regista caixa/turno/movimento, sem centro | Filtrar/autorizar através das relações pai; considerar centro explícito para auditoria futura, sem alterar histórico nesta fase. |
| `finance_auditoria_fiscal` | Referência `documento_id`, sem centro | Herdar acesso do documento pai. |
| `finance_lancamentos` | Tem `centro_custo` textual, `documento_id`, `despesa_id`, `empresa_id` | Substituir gradualmente texto por FK validada; validar coerência com documento/despesa e linhas. |
| `finance_lancamento_linhas` | Já tem `centro_custo_id` | Garantir que o centro corresponde ao lançamento e que a soma contabilística continua equilibrada. |
| `finance_imobilizados` | Já tem `centro_custo_id` | Restringir por centro; transferência entre polos deve ser operação auditada. |
| `finance_regras_contabilizacao` | Já tem `centro_custo_id`, `empresa_id` | Decidir regra específica por centro ou regra global; não deixar regra global permitir contaminação de lançamentos. |
| `finance_series` | Tem `empresa_id`, sem centro | Separar séries por polo apenas se a estrutura fiscal/AGT e a empresa emitente o permitirem. Não criar/ativar séries fiscais sem validação. |
| `finance_saft_config`, `finance_saft_exports`, `finance_saft_validacoes` | Config/exportações ligadas a empresa/configuração, sem centro direto em várias tabelas | Separar exportações por empresa/centro de origem e período; preservar integridade fiscal e rastreabilidade. |
| `finance_periodos_contabeis` | Tem `empresa_id`, sem centro | Definir se períodos são comuns à entidade ou por centro; não duplicar períodos sem decisão contabilística. |
| `finance_contas`, `finance_diarios`, `finance_contas_bancarias`, `finance_extratos_bancarios`, `finance_movimentos_bancarios`, `finance_reconciliacoes` | Predomínio de `empresa_id`; algumas relações bancárias não têm centro | Manter plano de contas comum quando adequado; restringir contas bancárias e reconciliações conforme titularidade e polo. Evitar inferir que cada polo é uma empresa diferente. |
| `finance_tipos_documento`, `finance_config`, `finance_emitente_config`, `finance_empresas` | Configuração e cadastro fiscal centralizados | Não separar por polo sem análise fiscal; manter identidade fiscal do emitente e os snapshots de documentos. |

**Nota sobre produtos/stock:** na consulta por nomes, não apareceu tabela com nome evidente `produtos`, `stock` ou `estoque`. Isso não prova que não exista módulo de stock com outro nome ou que os produtos não estejam representados noutro módulo. Antes de implementar, pesquisar todo o schema e o código de `index.html` por cadastros, inventário, consumo, aprovisionamento e fornecedores.

## 3. RLS observada — risco de acesso cruzado

As policies atuais de várias tabelas financeiras autorizam operações para staff através de funções como `ciadi_finance_staff()`, `ciadi_finance_is_staff()` e `is_staff()`, sem verificar centro de custo. A existência de RLS não equivale a isolamento por polo.

As funções `is_staff()` e `ciadi_finance_staff()` consultadas usam `SECURITY DEFINER`; qualquer nova política/função deve ser revista com especial cuidado para não abrir um caminho de contorno de RLS. A policy de centros não deve ser adicionada isoladamente como se já garantisse o isolamento financeiro.

**Consequência:** não ativar seletor de polo nem declarar separação segura enquanto todas as policies e caminhos indiretos relevantes não forem testados. A policy permissiva existente pode permitir acesso mesmo quando se acrescenta uma segunda policy permissiva; a estratégia de migração deve rever/substituir as policies específicas de cada tabela com plano de reversão, nunca removê-las indiscriminadamente.

## 4. Arquitetura alvo por módulo

1. **Catálogo partilhado:** clientes, serviços e cadastro de fornecedores podem ser comuns quando representam a mesma entidade. A partilha do cadastro não dá acesso automático às operações financeiras de todos os polos.
2. **Dados por polo:** caixas, turnos, movimentos, documentos, vendas, despesas, pagamentos, consumo/stock, relatórios de produção e lançamentos têm de ter centro explícito ou uma relação pai validada que determine o centro sem ambiguidade.
3. **Documentos fiscais:** série e sequência devem manter integridade; avaliar se séries distintas por polo são permitidas no modelo fiscal aplicável antes de qualquer alteração.
4. **Relatórios:** relatório de polo filtrado e protegido por RLS; relatório consolidado apenas para Direção/roles autorizadas.
5. **Transferências:** stock ou valores entre polos devem usar operação explícita com origem, destino, utilizador, data, motivo e trilho de auditoria.
6. **Histórico:** registos sem centro conhecido ficam em lista de classificação pendente; não atribuir retroativamente a CC-001 por defeito.

## 5. Plano faseado e critérios de aceitação

- [ ] Inventariar todas as tabelas e policies dos módulos comercial, aprovisionamento, stock, faturação, pagamentos, caixa e contabilidade.
- [ ] Confirmar relações entre Auth e perfis (a FK `perfis.id -> auth.users.id` foi observada).
- [ ] Definir matriz de centro por tabela e regras de herança, incluindo validações de consistência pai/filho.
- [ ] Preparar migração aditiva versionada: colunas/FKs/índices/constraints, sem backfill presumido.
- [ ] Rever policies existentes para eliminar acesso cruzado, cobrindo SELECT/INSERT/UPDATE/DELETE e queries indiretas.
- [ ] Implementar atribuição de utilizadores no Supabase e seletor de polo no login apenas após o isolamento estar pronto.
- [ ] Testar duas contas de teste: Talatona não consegue ler nem alterar Jardim de Rosas e vice-versa; Direção consegue consolidar quando autorizada.
- [ ] Testar pagamentos e linhas, documentos e notas relacionadas, turnos/caixas, despesas/pagamentos, lançamentos/linhas, SAF-T e relatórios.
- [ ] Fazer backup e verificar possibilidade de restauro antes de qualquer aplicação em produção.
- [ ] Só depois atualizar o Setup Windows; a alteração no repositório não atualiza automaticamente a aplicação instalada.

## 6. Estado e limites

- Esta documentação descreve o estado observado e o desenho recomendado.
- A migração `20261027070000_ciadi_centros_custo_acesso.sql` continua por aplicar.
- Nenhuma policy foi modificada e nenhum registo histórico foi reatribuído.
- Ainda não foi gerado nem validado novo Setup.
