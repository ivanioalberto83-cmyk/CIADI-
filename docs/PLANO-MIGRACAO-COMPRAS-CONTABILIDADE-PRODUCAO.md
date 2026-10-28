# Plano de migração de produção — CIADI Compras e Contabilidade

**Estado:** proposta versionada para revisão e homologação; não executada.  
**Ramo:** `feature/ciadi-compras-contabilidade-integrada`  
**Migração proposta:** `supabase/migrations/20261027120000_ciadi_compras_contabilidade.sql`

## Alterações propostas

1. Adicionar a relação opcional `finance_despesas.fornecedor_id → finance_clientes.id`, mantendo fornecedor/nome/NIF históricos como snapshot.
2. Separar aprovação (`pendente/aprovada/rejeitada`) da situação financeira já existente (`pendente/parcial/pago/anulado`).
3. Guardar estado de contabilização e bloquear mais de um lançamento por despesa.
4. Criar estruturas para ordens de compra e linhas, com estado, fornecedor, empresa, aprovação e quantidades recebidas.
5. Disponibilizar RPCs protegidas por `ciadi_finance_is_staff()` para aprovar/rejeitar despesas, contabilizar despesas, criar ordens e aprovar/rejeitar ordens.
6. A contabilização exige fornecedor associado, despesa aprovada, empresa, período contabilístico aberto, diário `COM`, regra ativa `DESPESA` e contas configuradas. Quando existe imposto, exige também conta de imposto.
7. A contabilização é transacional e idempotente: bloqueia a despesa, procura lançamento existente, valida os totais e usa as linhas de lançamento existentes.

## Regra contabilística implementada na proposta

- Débito da despesa: `finance_despesas.valor`.
- Débito de imposto: `finance_despesas.imposto`, apenas quando positivo e com `conta_imposto_id` configurada.
- Crédito de fornecedor/contas a pagar: `finance_despesas.total`.
- Pré-condição: `valor + imposto = total`, arredondado a duas casas decimais.
- Não são criadas automaticamente regras contabilísticas nem contas; a Direção/Contabilidade deve configurar e validar a regra `DESPESA` e o diário `COM`.

## Ordem de compra

A função de criação aceita linhas JSON e cria cabeçalho/linhas numa única transação. A primeira versão do formulário pode registar uma linha por ordem; o suporte de múltiplas linhas e a receção física completa devem ser homologados antes de produção. A ordem nasce como `submetida`; uma decisão explícita move-a para `aprovada` ou `rejeitada`.

## Preflight obrigatório

Executar apenas em ambiente de homologação primeiro:

- [ ] Confirmar backup integral de base de dados e Storage; executar e documentar um restauro de ensaio.
- [ ] Confirmar que não existem despesas com mais de um lançamento em `finance_lancamentos`; a migração aborta se encontrar duplicados.
- [ ] Confirmar que os nomes dos fornecedores existentes não serão associados automaticamente por semelhança.
- [ ] Mapear manualmente despesas antigas a fornecedores inequívocos; as restantes ficam com `fornecedor_id = NULL`.
- [ ] Confirmar se o diário `COM` existe para a empresa principal e se a regra `DESPESA` tem contas adequadas.
- [ ] Validar tratamento fiscal de IVA/retenções com a Contabilidade. A proposta não afirma conformidade fiscal nem validação AGT.
- [ ] Aplicar em cópia de homologação e testar as funções com utilizadores autorizados e não autorizados.
- [ ] Testar repetição de contabilização, falha de transação, período fechado, fornecedor inativo, despesa rejeitada/anulada e montantes inconsistentes.
- [ ] Comparar contagens, somatórios e lançamentos antes/depois; registar resultados e plano de reversão.
- [ ] Só após aprovação formal, planear janela de manutenção e migração de produção.

## Limites e bloqueios

- Nenhuma migração foi executada na base de dados remota.
- Nenhuma política RLS, chave, dado de produção ou configuração remota foi alterada.
- A existência do ficheiro SQL não significa que foi executado ou que as funções passaram testes runtime.
- A folha salarial permanece fora desta fase.
- O Setup.exe não deve ser gerado até o fluxo compras → aprovação → despesa → contabilidade passar testes estáticos, integração, segurança e homologação funcional.
