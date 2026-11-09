# CIADI — Arquitectura do Módulo Recepção

**Estado:** desenvolvimento isolado; não homologado; não publicado.

## Objectivo

Criar uma estação de atendimento institucional para os polos CIADI, com processos próprios de chegada, fila, encaminhamento, registo de visitantes, correspondência e reporting. A Recepção não é um módulo clínico nem o ponto de entrada de recepção de mercadorias do Aprovisionamento.

## Limites funcionais

- A Recepção regista o adulto/responsável que se apresenta e a finalidade operacional do atendimento.
- Quando existe marcação, guarda apenas referências ao agendamento e ao utente já existentes. Não cria cópias de registos clínicos.
- Não recolhe notas clínicas, diagnósticos, número de BI ou dados identificativos adicionais da criança.
- Não altera marcações, processos clínicos, facturação, caixa, compras ou stock directamente. Estas operações são obrigatoriamente incluídas na estação Recepção através dos motores centrais de Financeiro e Aprovisionamento, sem duplicação de registos.
- Os encaminhamentos são eventos administrativos; o acesso ao conteúdo do serviço de destino continua a pertencer ao respectivo módulo.

## Primeiro motor implementado no código

### Chegadas e fila

Estados suportados:
- `waiting` — A aguardar
- `in_service` — Em atendimento
- `referred` — Encaminhado
- `completed` — Concluído
- `no_show` — Não compareceu
- `cancelled` — Cancelado

Transições:
- A aguardar → Em atendimento / Não compareceu / Cancelado
- Em atendimento → A aguardar / Encaminhado / Concluído
- Encaminhado → A aguardar / Concluído
- Estados terminais não podem ser reabertos nesta primeira versão.

### Visitantes

- Registo de nome, finalidade, serviço de destino e polo.
- Estado de entrada/saída e hora de cada evento.
- Não guarda número de documento de identificação.

### Indicadores

- Total de chegadas.
- Em espera, em atendimento, encaminhados, concluídos, faltas e cancelamentos.
- Tempo médio de espera calculado a partir da chegada e início do atendimento.
- Visitantes actualmente dentro do centro.

## Integração técnica

- Módulo: `renderer/modules/reception-module.js`.
- Integração no Dashboard: contrato existente `CIADI_RECEPTION_MODULE.create({ root, navigate, notify }).renderHome()`, agora com sessão Supabase e utilizador autenticado fornecidos pelo Dashboard.
- Persistência: apenas por RPC no schema dedicado `ciadi_reception`.
- RPCs previstas: `reception_register_arrival`, `reception_transition_visit`, `reception_register_visitor`, `reception_close_visitor`, `reception_get_dashboard`.
- O ecrã informa indisponibilidade e não simula gravações se o schema/RPC não estiver disponível.

## Base de dados proposta

Ficheiro: `supabase/proposals/ciadi-reception-workflow-proposal.sql`.

Tabelas propostas:
- `front_desk_visits`
- `front_desk_visit_events`
- `visitor_entries`

A proposta activa RLS e revoga acesso por omissão. Não cria policies nem grants; a autorização por perfil e polo é uma fase separada. Não foi aplicada ao Supabase remoto. As referências UUID para `public.agendamentos` e `public.pacientes` não têm FK nesta proposta, porque os tipos e constraints remotos têm de ser confirmados antes de as declarar.

## Encaminhamento com confirmação do serviço

- Cada encaminhamento atribuído fica com `referral_status = pending` até o serviço de destino responder.
- O serviço pode confirmar a recepção (`accepted`) ou devolver o encaminhamento (`returned`) com motivo obrigatório.
- A confirmação e a devolução são RPCs transaccionais, com validação de sessão, bloqueio da visita e evento imutável com actor/data/detalhes.
- A Recepção passa a apresentar o estado do encaminhamento no painel operacional. A autorização por perfil/serviço ainda não está concluída; estas RPCs não devem receber grants até à revisão de permissões.
- Proposta SQL apenas; não aplicada ao Supabase remoto.

## Integração com estruturas existentes do Supabase — auditoria read-only

Projecto auditado: egpkkttbcaukqnnxyhjv. Não foram executados INSERT, UPDATE, DELETE, DDL, grants ou alterações de políticas.

### Facturação e caixa existentes

Estruturas identificadas em public:
- Documentos: finance_documentos, finance_documento_linhas, finance_documentos_relacoes, finance_tipos_documento, finance_series.
- Clientes e catálogo: finance_clientes, finance_servicos, finance_empresas, finance_emitente_config.
- Pagamentos: finance_pagamentos.
- Caixa: finance_caixas, finance_caixa_turnos, finance_movimentos_caixa, finance_operadores.
- Auditoria/contabilidade/fiscal: finance_auditoria_fiscal, finance_auditoria_operacoes, finance_lancamentos, finance_lancamento_linhas, finance_regras_contabilizacao, finance_saft_config, finance_saft_exports, finance_saft_validacoes, finance_agt_conformidade.

Funções existentes identificadas:
- Facturação: ciadi_faturacao_criar_documento, ciadi_faturacao_calcular_documento, ciadi_faturacao_emitir_documento, ciadi_faturacao_anular_documento, ciadi_faturacao_transformar_documento.
- Caixa/pagamento: ciadi_abrir_caixa, ciadi_fechar_caixa, ciadi_aprovar_fecho_caixa, ciadi_registar_movimento_caixa, ciadi_finance_integrar_pagamento, ciadi_finance_can.

As tabelas financeiras consultadas têm RLS activo. Foram identificadas políticas de operador/staff e funções SECURITY DEFINER. A função ciadi_faturacao_criar_documento exige is_staff(); a emissão também exige validação de documento/cliente/série/empresa. ciadi_finance_integrar_pagamento exige finance staff. As funções de caixa usam ciadi_finance_can com permissões por operador (abrir, fechar, receber, emitir recibo, estornar, reconciliar e aprovar), para além dos controlos de turno. A Recepção não deve contornar estas condições. A homologação AGT continua a ser uma validação separada; a existência destas tabelas não certifica o software.

### Aprovisionamento e stock existentes

O schema ciadi_ti já contém:
- Catálogo: items, item_categories.
- Armazéns e saldos: warehouses, stock_balances.
- Movimentos e inventário: stock_movements, inventory_counts, inventory_count_lines, assets.
- Compras/requisições: purchase_requests, purchase_request_lines, suppliers.
- Auditoria: audit_events.

Funções existentes: decide_purchase_request, post_stock_movement, transfer_stock. As tabelas de ciadi_ti têm RLS activo, com políticas de leitura/escrita associadas ao acesso de Suporte Informático. decide_purchase_request exige perfil admin/gestor; post_stock_movement exige has_support_access(); estas operações não estão actualmente autorizadas ao perfil de Recepção. As três funções são SECURITY DEFINER e não devem ser chamadas como atalho de permissões.

Limites identificados na estrutura actual:
- purchase_requests não apresenta campos próprios de polo/centro de custo nem entidade de recepção de mercadorias.
- Não foram encontradas tabelas próprias de ordem de compra formal ou de recepção/nota de entrega no inventário consultado.
- ciadi_solicitacoes_materiais e o respectivo histórico são pedidos de materiais ligados a paciente/responsável/profissional; não devem ser reutilizados como requisição geral de compras da Recepção.
- Não criar tabelas duplicadas antes de mapear se estes campos podem ser tratados por metadados/contratos existentes ou se há uma lacuna que exija proposta aprovada.

### Identidade institucional e logótipo

O repositório já contém renderer/core/institutional-identity-service.js, com marca central CIADI, paleta institucional, contactos/endereço e logoDataUrl incorporado. O motor documental do Suporte já consome esse serviço central, o que fornece um padrão reutilizável para a Recepção.

Na base de dados, public.instituicao.logo_url e public.finance_emitente_config.logotipo_url estão nulos; o bucket Storage logos existe, mas a consulta de objectos não encontrou ficheiros. Portanto, não usar URLs vazios nem depender do Storage para o logótipo. A identidade documental deve reutilizar o logoDataUrl do serviço central existente e incorporar a imagem nos PDFs. A configuração fiscal do emitente continua a ser responsabilidade do Financeiro.

## Âmbito funcional da Recepção sobre estes motores

### Facturação e caixa
- Consultar serviços/valores activos e clientes existentes, respeitando o acesso autorizado.
- Criar e emitir documentos exclusivamente através das funções/fluxos centrais de facturação.
- Registar pagamentos e integrá-los com caixa/contabilidade através dos contratos centrais, sem duplicar pagamentos ou movimentos.
- Abrir/fechar turno apenas quando o operador, caixa e polo estiverem autorizados; apresentar reconciliação e diferenças.
- Anulações, estornos, reembolsos e aprovação de fecho ficam sujeitos às funções e aprovações existentes; nunca expor estas acções como simples botões sem validação.
- Mostrar estados fiscais e de pagamento reais; não apresentar documento como emitido/pago sem confirmação do motor central.

### Aprovisionamento
- Criar e acompanhar pedidos de material/serviço através do fluxo central de requisições aprovado.
- Consultar catálogo, fornecedores, armazéns e saldos através do schema ciadi_ti, apenas com autorização aplicável.
- Acompanhar decisão financeira e estado do pedido.
- A recepção física de mercadorias e divergências precisa de um contrato funcional próprio; esta capacidade ainda não foi confirmada nas tabelas consultadas.
- Não permitir à Recepção lançar movimentos de stock, transferir stock, gerir fornecedores ou decidir compras sem aprovação e autorização explícitas.

### Documentos CIADI
Todos os documentos próprios da Recepção — comprovativos de atendimento, fechos/relatórios de caixa, requisições, registos de entrega quando o fluxo for homologado, declarações, protocolos, correspondência e relatórios — devem usar CIADI_INSTITUTIONAL_IDENTITY. Facturas e recibos fiscais permanecem emitidos pelo motor financeiro, com a identidade/snapshot fiscal central. O logótipo deve ser incorporado no PDF; QR de validação apenas quando houver token/endpoint real.

## Fases seguintes

1. Concluir revisão de segurança dos contratos existentes e mapear as acções exactas permitidas à Recepção. A implementação do ecrã pode avançar com contratos/adaptadores, mas qualquer escrita que seja recusada pelas políticas actuais deve permanecer bloqueada até à fase de permissões.
2. Implementar integração de leitura de catálogo/serviços, clientes, estado de documentos, caixa e requisições, com falha fechada se não houver autorização.
3. Implementar criação/emissão de factura e pagamento somente depois de validar contratos, operador, empresa, série, caixa/turno e idempotência.
4. Resolver a lacuna de polo/centro de custo e recepção de mercadorias no Aprovisionamento, primeiro por proposta técnica; não aplicar alterações remotas.
5. Reutilizar o serviço central de identidade documental e garantir o logótipo em todos os PDFs da Recepção.
6. Homologar os fluxos com dados de teste e PostgreSQL isolado; depois rever permissões/RLS por perfil e polo.
7. Concluir agenda/check-in, encaminhamento, correspondência, relatórios e homologação Windows.

## Restrições de entrega

- PR #40 permanece Draft e sem merge.
- PR #39 do Suporte Informático não é alterada.
- Nenhuma alteração foi feita ao Supabase remoto, contas, permissões efectivas, Storage, produção ou Setup distribuível.
- Não criar branch Supabase paga.
