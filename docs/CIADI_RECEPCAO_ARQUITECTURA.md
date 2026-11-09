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

## Facturação e caixa integradas na Recepção

A Recepção deve disponibilizar uma área operacional de facturação e caixa ligada ao motor financeiro central do CIADI. O âmbito inclui consulta de serviços/valores autorizados, identificação administrativa do pagador, emissão de facturas/recibos/comprovativos pelo motor central, meios de pagamento configurados, abertura e fecho de caixa por operador/turno, movimentos de caixa, reconciliação diária e mapas por polo. Anulações, estornos, notas de crédito e reembolsos exigem motivo, actor, auditoria e aprovação adequada. Os campos fiscais e regras AGT devem ser validados pela área financeira antes de produção. Não criar facturação ou livro de caixa paralelo.

## Aprovisionamento integrado na Recepção

A Recepção deve permitir criar e acompanhar requisições internas de materiais/serviços, com polo, centro de custo, finalidade, quantidades e prioridade; consultar aprovações e estado; pedir reposição; consultar disponibilidade; e registar a recepção física de entregas destinadas à Recepção, incluindo quantidades e divergências. Fornecedores, compras, aprovações, inventário e movimentos de stock permanecem no motor central de Aprovisionamento. Não duplicar cadastros nem permitir ajustes directos não autorizados.

## Identidade CIADI e documentos — obrigatório

Todos os documentos gerados, impressos ou exportados pela Recepção devem usar uma identidade documental central e o logótipo oficial CIADI incorporado no PDF. Abrange facturas/recibos emitidos pelo motor financeiro, comprovativos e fechos de caixa, requisições, comprovativos de entrega, declarações, protocolos, correspondência e relatórios. Os modelos devem incluir apenas dados institucionais validados, polo emissor, operador, data/hora, referência, paginação e QR de validação quando aplicável. Antes de implementar, localizar e validar o ficheiro real do logótipo e a configuração central de identidade; não inventar logótipos, NIF, denominação legal ou contactos.

## Fases seguintes

0. Auditar, em modo de leitura, os motores centrais de Financeiro/Facturação/Caixa e Aprovisionamento e mapear os contratos de integração existentes.\n1. Implementar facturação e caixa na Recepção usando os contratos centrais.\n2. Implementar requisições e recepção de entregas ligadas ao Aprovisionamento central.\n3. Identificar a identidade documental central e aplicar o logótipo oficial a todos os documentos da Recepção.\n4. Homologar o motor de chegadas e visitantes em PostgreSQL isolado.
2. Construir agenda/check-in integrado, sem permitir edição clínica.
3. Acrescentar encaminhamentos internos com confirmação de recepção pelo serviço de destino.
4. Acrescentar chamadas, mensagens e correspondência.
5. Integrar motor documental CIADI para comprovativos e registos.
6. Construir relatórios por polo, período, estado e tempo de espera.
7. Definir permissões/RLS por perfil e polo; testar acessos directos e tentativas negadas.
8. Homologar instalação Windows e fluxos ponta a ponta.

## Restrições de entrega

- PR #40 permanece Draft e sem merge.
- PR #39 do Suporte Informático não é alterada.
- Nenhuma alteração foi feita ao Supabase remoto, contas, permissões efectivas, Storage, produção ou Setup distribuível.
- Não criar branch Supabase paga.
