# Plano de integração — Compras, RH e Contabilidade CIADI

**Estado:** especificação para homologação; não autoriza alterações na base de dados de produção.  
**Ramo:** `feature/ciadi-cadastros-comerciais`  
**Data:** 2026-10-27

## Objetivo

Garantir rastreabilidade de ponta a ponta entre cadastro comercial, vendas/faturação, compras/despesas, recursos humanos e contabilidade, sem lançamentos duplicados nem perda de histórico.

## Situação confirmada por inspeção read-only

- `finance_documentos.cliente_id` referencia `finance_clientes.id`; os documentos mantêm snapshots fiscais do adquirente.
- `finance_despesas` tem `empresa_id`, nome/NIF do fornecedor, estado, conta contabilística e centro de custo; não tem uma FK persistente para o fornecedor.
- `finance_lancamentos` suporta referência a `documento_id` e `despesa_id`, contas a débito/crédito, valor, estado, totais e metadados de contabilização.
- `ciadi_funcionario_assiduidade.funcionario_id` e `ciadi_funcionario_contratos.funcionario_id` referenciam `ciadi_funcionarios.id`; funcionários podem referenciar `profissionais.id`.
- As tabelas consultadas têm RLS ativo. A existência de uma FK ou de colunas contabilísticas não prova que o fluxo funcional esteja implementado nem que o utilizador tenha permissões suficientes.
- O módulo RH desta fase é apenas de consulta. A integração de compras atualmente copia nome/NIF do fornecedor para a despesa; não cria uma relação persistente com o cadastro.

## Fluxos-alvo

### 1. Vendas e faturação → Contabilidade

1. Selecionar um cliente/entidade ativo no cadastro comercial.
2. Validar campos obrigatórios e dados fiscais internos; não apresentar o NIF como validado pela AGT.
3. Emitir documento através das funções existentes, com o assistido opcional quando aplicável.
4. Contabilizar através do mecanismo oficial já existente, se as pré-condições e permissões forem satisfeitas.
5. Verificar que o documento tem no máximo o lançamento esperado, que débito = crédito e que uma repetição não duplica lançamentos.
6. Testar também anulação/notas de crédito e respetivo tratamento contabilístico antes da produção.

### 2. Compras / despesas → Contabilidade

1. Selecionar fornecedor ativo do cadastro; guardar o identificador persistente do fornecedor quando houver desenho de esquema aprovado.
2. Registar documento de suporte, data, valor, imposto/retenção quando aplicáveis, empresa, centro de custo, conta e estado de aprovação.
3. Separar estados de rascunho, submetido, aprovado, contabilizado e anulado, de acordo com o modelo validado.
4. Após aprovação, usar uma função transacional/idempotente de contabilização que gere o lançamento ligado a `despesa_id`.
5. Bloquear contabilização duplicada; exigir contas válidas e igualdade entre total a débito e total a crédito.
6. Preservar fornecedor e valores como snapshot documental, mesmo que o cadastro comercial seja atualizado mais tarde.

**Bloqueio atual:** não foi identificada função de contabilização de despesas nem relação persistente `fornecedor_id`. Não simular esta ligação nem escrever lançamentos manualmente em produção.

### 3. RH → Contabilidade

1. Usar o registo de funcionário e contrato como origem controlada dos dados laborais.
2. Separar dados pessoais/RH dos registos contabilísticos e limitar acesso por perfil.
3. Antes de desenvolver salários, confirmar o modelo de remuneração, rubricas, período, regras fiscais/contributivas aplicáveis e contas contabilísticas com a Direção/contabilidade.
4. Gerar folha salarial em estado de rascunho, exigir validação humana e só depois contabilizar através de operação transacional e idempotente.
5. Não calcular nem lançar IRT/INSS automaticamente até as regras e os casos de teste serem aprovados.
6. Não expor dados clínicos no módulo financeiro/RH.

**Bloqueio atual:** folha salarial e integração salarial-contabilidade não foram implementadas nem validadas.

## Testes obrigatórios em homologação

- [ ] Utilizador autorizado consegue ler/criar/editar cadastro segundo o perfil; utilizador sem permissão é bloqueado.
- [ ] Cliente inativo/fornecedor não é aceite indevidamente no fluxo de faturação.
- [ ] Documento emitido conserva o cliente correto e os snapshots fiscais esperados.
- [ ] Falha durante emissão não deixa documento parcial nem lançamento órfão.
- [ ] Repetir a ação de contabilização não cria duplicados.
- [ ] Para cada lançamento: total a débito = total a crédito.
- [ ] Despesa não aprovada não é contabilizada.
- [ ] Fornecedor selecionado pode ser rastreado até à despesa e ao lançamento após implementação da FK.
- [ ] Alterar dados atuais do fornecedor não altera snapshots históricos.
- [ ] RH só é visível para perfis autorizados; salários não ficam acessíveis a perfis comerciais.
- [ ] Testes de anulação, permissões/RLS, erros de rede e recuperação de sessão concluídos.
- [ ] Backup e procedimento de restauro verificados antes de qualquer migração.

## Próxima implementação recomendada

1. Concluir testes de faturação e contabilização de vendas em ambiente de homologação.
2. Propor migração versionada para relação persistente entre despesa e fornecedor, após confirmar duplicados e compatibilidade; não executar até aprovação explícita e backup validado.
3. Implementar função segura e idempotente de contabilização de despesas com auditoria.
4. Definir workflow de requisição, aprovação, receção e compra apenas depois de confirmados os requisitos operacionais.
5. Só depois especificar folha salarial e integração com contabilidade.

## Limites desta fase

- Sem alterações a dados, esquema, políticas RLS, chaves ou configuração de produção.
- Sem emissão fiscal real, lançamento contabilístico real ou validação oficial de NIF pela AGT durante a inspeção.
- A conclusão de testes estáticos não equivale a homologação funcional nem a conformidade fiscal.
