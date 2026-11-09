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

## Implementação actual — integração sem duplicação

A estação Recepção já dispõe de um adaptador de leitura para as estruturas centrais existentes:
- public.finance_servicos, filtrado por empresa e activo;
- public.finance_caixas e public.finance_documentos, filtrados por empresa;
- ciadi_ti.stock_balances e ciadi_ti.purchase_requests.

O Dashboard apresenta os serviços/preços, estado das caixas, estado de documentos recentes, saldos/alertas de stock e estado de requisições. Não escreve nestas tabelas, não emite documentos, não recebe pagamentos, não aprova compras e não movimenta stock. Se a RLS impedir a leitura, a área identifica a indisponibilidade; não apresenta dados fictícios. Se a empresa principal não puder ser confirmada, as consultas financeiras ficam bloqueadas.

O cabeçalho do Dashboard reutiliza o logótipo embutido no serviço central CIADI. O helper renderReceptionDocumentHeader exige o serviço CIADI_INSTITUTIONAL_IDENTITY e incorpora logoDataUrl no HTML do cabeçalho documental. A integração em cada modelo PDF final e a validação dos PDFs continuam pendentes.

Verificação: GitHub Actions run 42610491365 concluiu com 162 testes aprovados e 0 falhas; validação de integração do Dashboard run 42610491460 concluiu com sucesso. Estes resultados validam os testes automatizados, não substituem homologação PostgreSQL, validação de permissões ou testes ponta a ponta.

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


## Auditoria detalhada de Aprovisionamento — 09/11/2026

Auditoria read-only ao projecto Supabase `egpkkttbcaukqnnxyhjv`. Foram consultadas colunas, constraints, políticas RLS, privilégios e corpos das funções centrais. Nenhuma escrita, DDL, alteração de grants ou política foi executada.

### Estruturas existentes confirmadas

- `ciadi_ti.purchase_requests`: número único, requisitante, fornecedor, estado, justificação, total estimado e decisão financeira (actor/data/nota). Estados actualmente permitidos: `draft`, `submitted`, `returned`, `approved`, `rejected`, `received`, `cancelled`.
- `ciadi_ti.purchase_request_lines`: artigo opcional, descrição, quantidade, unidade e custo unitário estimado. Não contém quantidade recebida nem divergência por linha.
- `ciadi_ti.warehouses`: código, nome, campo `polo`, localização e estado activo. O polo já existe no armazém; não deve ser duplicado sem necessidade.
- `ciadi_ti.stock_movements`: livro central com artigo, armazém, tipo, delta de quantidade, custo, lote, referência, notas, movimento relacionado, actor e data.
- `ciadi_ti.stock_balances`: vista/saldo por artigo e armazém, incluindo mínimo e indicador abaixo do mínimo.
- `ciadi_ti.inventory_counts` e `inventory_count_lines`: contagem física e diferenças de inventário; não são registos de recepção de encomendas.
- `ciadi_ti.suppliers`, `items`, `assets` e `audit_events` permanecem os cadastros e registos centrais existentes.

### Controlos de acesso observados

- RLS está activo nas tabelas auditadas.
- As políticas de leitura de requisições, linhas, fornecedores, armazéns, artigos, movimentos e inventário usam `ciadi_ti.has_support_access()`.
- A escrita directa de requisições/linhas, fornecedores, armazéns e artigos está limitada pelas políticas de Suporte Informático; as linhas só podem ser alteradas quando a requisição está em rascunho/devolvida.
- `decide_purchase_request` é SECURITY DEFINER, valida `has_finance_approval()` (admin/gestor), bloqueia a linha e só decide pedidos submetidos.
- `post_stock_movement` e `transfer_stock` são SECURITY DEFINER e validam `has_support_access()`. O acesso EXECUTE foi observado para authenticated e não para anon/public; isso não concede autorização funcional à Recepção.
- Não foi identificada uma função dedicada para recepção física de mercadorias ou recepção parcial.

### Conclusão de desenho — enriquecer, não duplicar

1. Manter `purchase_requests` e `purchase_request_lines` como origem da requisição e das linhas.
2. Reutilizar `warehouses.polo` e associar o pedido ao armazém de destino existente, após validar o modelo operacional dos dois polos.
3. Manter `stock_movements` como único livro de stock. Uma futura recepção deve gerar movimentos de entrada através de um fluxo transaccional autorizado, com referência à requisição/linha e documento de entrega.
4. Usar `audit_events` e os campos actor/data já existentes para rastreabilidade; não criar um segundo livro de movimentos.
5. Para recepção parcial e divergências, preparar uma proposta aditiva sobre as estruturas existentes (campos de quantidade recebida/estado e ligação do movimento à requisição/linha), sem aplicar SQL remoto.
6. Não reutilizar `inventory_count_lines` para entregas: o seu grão é contagem física por inventário/artigo.
7. A Recepção continua bloqueada para escrita enquanto as políticas e funções existentes não forem revistas e aprovadas para o seu perfil/polo.

**Próximo passo técnico:** preparar testes de contrato e uma proposta SQL aditiva para ligar requisição, linha, armazém e movimento de entrada. A proposta deve contemplar recebimentos parciais, divergências, idempotência e actor autenticado; os grants/policies só serão tratados numa fase expressamente aprovada.


### Proposta aditiva preparada — recepção física de mercadorias

Ficheiro: `supabase/proposals/ciadi-ti-purchase-receipt-extension-proposal.sql`.

A proposta, ainda não aplicada, enriquece apenas estruturas existentes:
- `purchase_requests`: armazém de destino, referência ao centro de custo existente em `public.finance_centros_custo` e prioridade.
- `stock_movements`: ligação à requisição/linha e chave idempotente. O campo `reference` existente recebe a referência da guia de entrega; não é criado outro campo/livro para o mesmo fim.
- Função transaccional proposta `ciadi_ti.receive_purchase_request_line`: exige sessão autenticada, actor derivado de `auth.uid()`, acesso actual de Suporte Informático, requisição aprovada, armazém activo igual ao destino, centro de custo activo, artigo activo e quantidade não superior ao saldo em falta. Bloqueia requisição/linha, protege a chave idempotente e só muda a requisição para `received` quando todas as linhas estiverem completas.
- Recepções parciais permanecem na requisição aprovada e são calculadas a partir dos movimentos ligados à linha; não se duplica a quantidade recebida em mais uma coluna.
- Os triggers de auditoria já existentes em `purchase_requests`, `purchase_request_lines` e `stock_movements` continuam a registar as alterações em `audit_events`.

A proposta revoga EXECUTE para `public`, `anon` e `authenticated`; não cria policies nem grants. O predicado de acesso actual ainda não inclui o perfil Recepção. A inclusão desse perfil é uma decisão posterior de permissões, não está simulada nesta implementação.


## Correcções e integração preparada — 09/11/2026

### Encaminhamentos
- A grelha da fila apresenta acções explícitas para confirmar a recepção pelo serviço de destino ou devolver o encaminhamento pendente.
- A devolução exige motivo e usa a RPC `reception_return_referral`; a confirmação usa `reception_confirm_referral`.
- A interface actualiza o painel apenas após a confirmação da operação no servidor.
- TDD observado: o teste falhou antes da implementação (commit `bbace144dd160b0a319cd687aea141a368427275`); após a implementação, 167/167 testes passaram (commit `1ee00ef761a7787f6fd52ca6733fac58511f6f02`).

### Adaptador do motor financeiro central
Foi acrescentado `createReceptionFinanceRepository`, que prepara chamadas apenas aos contratos centrais existentes:
- `ciadi_faturacao_criar_documento`
- `ciadi_faturacao_calcular_documento`
- `ciadi_faturacao_emitir_documento`
- `finance_registar_pagamento`
- `ciadi_abrir_caixa`
- `ciadi_fechar_caixa`
- `ciadi_registar_movimento_caixa`

O adaptador valida campos e valores, transforma as linhas para o contrato SQL e propaga erros do motor. Não faz INSERT/UPDATE directo nas tabelas financeiras e não simula confirmação.

### Bloqueio real de autorização confirmado no Supabase remoto (consulta read-only)
- `public.is_staff()` reconhece perfis activos `admin` e `gestor`, ou profissional activo com `eh_at = true`. O perfil Recepção não está incluído.
- `ciadi_faturacao_criar_documento` e `ciadi_faturacao_emitir_documento` exigem `is_staff()`.
- `finance_pagamentos`, `finance_documentos`, `finance_documento_linhas` e movimentos de caixa têm políticas RLS associadas a `ciadi_finance_staff()`; não foi identificada policy específica de Recepção.
- `ciadi_abrir_caixa` e `ciadi_fechar_caixa` dependem de `ciadi_finance_can()`, que reconhece staff financeiro ou operador activo com a capacidade correspondente.
- A Recepção ainda não tem operador financeiro nem matriz de capacidades homologada.

Consequência: o adaptador está preparado e testado, mas as operações de escrita não devem ser activadas para o perfil Recepção antes da fase de permissões. Não se deve contornar estas restrições através de chamadas directas ou de funções SECURITY DEFINER alternativas.

### Pendências que permanecem
1. Ligar o adaptador a formulários de facturação, pagamento e caixa, mantendo as acções bloqueadas até existir autorização server-side homologada.
2. Concluir a recepção física de mercadorias na estação Recepção. As RPCs do ciclo completo de recepção do Aprovisionamento não foram confirmadas no Supabase remoto; a proposta existente permanece não aplicada e actualmente limita o acesso a `has_support_access()`.
3. Integrar os modelos documentais finais e o fluxo oficial de PDF/QR. O cabeçalho com logótipo está disponível, mas não equivale à emissão/arquivo oficial.
4. Executar homologação PostgreSQL isolada e testes ponta-a-ponta no projecto CIADI de teste.

### Verificação desta correcção
- Commit `387dd8e31fcf19115845fb4707d3f6b45dbe337d`.
- CI Workstation Modules: sucesso, 169 testes aprovados, 0 falhas.
- Validação da integração do Dashboard: sucesso.
- Supabase remoto: apenas consultas SELECT/introspecção; sem DDL, DML, grants, policies, Storage ou deploy.


## Continuação — formulários financeiros e ciclo de caixa (09/11/2026)

### Dados e formulários integrados na estação Recepção
- O repositório de negócio consulta clientes activos, tipos documentais activos, séries activas por empresa/tipo, caixas, documentos recentes e turnos abertos.
- O painel da Recepção passou a apresentar formulários para criar rascunho de factura, abrir caixa e fechar turno, bem como a lista de documentos em edição.
- A criação de rascunho chama exclusivamente `ciadi_faturacao_criar_documento`; o cálculo subsequente chama `ciadi_faturacao_calcular_documento`. A UI só confirma a operação quando recebe o identificador e resposta do motor.
- A abertura de caixa chama `ciadi_abrir_caixa` e exige o UUID do turno devolvido pelo servidor. O fecho chama `ciadi_fechar_caixa` com o turno seleccionado, saldo contado e justificação.
- O painel identifica a marca institucional CIADI. O documento fiscal não pode ser emitido a partir deste formulário até à integração do PDF oficial e QR de autenticação.

### Incompatibilidade do motor de pagamentos identificada (consulta read-only)
A leitura das definições SQL remotas identificou um bloqueio adicional:
- `ciadi_faturacao_emitir_documento` grava `finance_documentos.document_status = 'emitido'`.
- `finance_registar_pagamento` exige `document_status = 'N'` e `fiscal_status = 'emitido'`.
- Assim, um documento acabado de emitir pelo motor fiscal não satisfaz a condição de estado da função de pagamento. O formulário de recebimento fica desactivado e apresenta esta incompatibilidade, até correcção e homologação do motor central.
- A emissão fiscal também permanece desactivada na Recepção enquanto não estiver ligado o fluxo oficial de PDF, logótipo institucional e QR de autenticação.

### Limites mantidos
- A Recepção não recebeu grants, policies, perfis, capacidades ou permissões novas.
- As operações de escrita continuam sujeitas às verificações server-side existentes; a UI não contorna RLS nem usa INSERT/UPDATE directo.
- Não foram efectuadas alterações SQL, DDL/DML, deploy, Storage ou produção.
- A recepção física de mercadorias continua pendente; a extensão SQL de Aprovisionamento permanece proposta e não aplicada.

### Verificação
- Teste TDD do painel financeiro: RED antes da implementação.
- Commit da integração de formulários: `f4f2c17ddb58c416c98b463c16ea3aa960e3b030`.
- GitHub Actions — CIADI Workstation Modules CI: sucesso, 171 testes aprovados, 0 falhas (run `42632034321`).
- A execução valida os testes de contrato, tipos das Edge Functions documentais, segurança/validação e sintaxe do motor/ponte Electron; não constitui homologação operacional no Supabase remoto.


### Verificação complementar — 09/11/2026
- A consulta read-only a `ciadi_ti` confirmou as tabelas de requisições, linhas, fornecedores, artigos, armazéns e movimentos de stock.
- O projecto remoto ainda não contém `purchase_requests.warehouse_id`, `purchase_requests.cost_center_id`, nem as ligações de requisição/linha e chave idempotente em `stock_movements` previstas na proposta.
- A pesquisa de funções remotas não encontrou `ciadi_ti.receive_purchase_request_line`, `create_goods_receipt`, `check_goods_receipt` ou `finalize_goods_receipt`. Por isso, não foi criada uma acção de recepção de mercadorias que pudesse fingir sucesso ou escrever directamente no stock.
- A alteração de interface preserva os campos já preenchidos quando carrega séries documentais. Também separa a confirmação da criação do rascunho da tentativa de cálculo, evitando que um erro de cálculo induza a criação duplicada.
- Último commit de código verificado: `031469813bd492afa74210ee85caacc7b5f1bd0e`.
- CIADI Workstation Modules CI: sucesso, 171/171 testes, 0 falhas (run `42632248479`).


## Gate de encerramento da estação Recepção — auditoria final (09/11/2026)

### Estado verificável do código
- Fila, atendimento, check-in, visitantes e encaminhamentos: implementação existente; os controlos de confirmação/devolução de encaminhamentos foram acrescentados nesta branch.
- Facturação: painel e formulário de criação de rascunho/calcular ligados às RPCs centrais; emissão fiscal desactivada na Recepção.
- Caixa: formulários de abertura e fecho ligados às RPCs centrais; operação sujeita à autorização server-side.
- Recebimentos: formulário desactivado devido à incompatibilidade document_status/fiscal_status já descrita.
- Aprovisionamento: consulta de stock/pedidos existente; recepção física de mercadorias não implementada como operação porque não há RPC remota homologada nem campos de ligação suficientes.
- Documentos: a identidade CIADI e o motor documental partilhado existem no código do Suporte. Contudo, o motor documental ainda não está integrado na estação Recepção.

### Bloqueio do motor documental confirmado
- A proposta `supabase/proposals/ciadi-ti-document-engine-proposal.sql` cria `ciadi_ti.documents`, `document_events`, sessões QR e o bucket privado. A proposta está marcada como NÃO EXECUTAR em produção sem revisão.
- A introspecção read-only do Supabase remoto não encontrou as tabelas `ciadi_ti.documents` e `ciadi_ti.document_events`; o schema remoto também não expõe as rotinas `prepare_document_issuance` e `issue_document`.
- As Edge Functions existentes no repositório validam explicitamente apenas os perfis `admin`, `gestor` e `suporte_informatica`. A Recepção não pode utilizá-las até aprovação da matriz de permissões e alteração controlada do contrato de acesso.
- Consequentemente, não é seguro declarar concluída a emissão de PDF/QR na Recepção, nem apresentar uma emissão como operacional. A identidade visual do cabeçalho não substitui arquivo, assinatura de emissão e autenticação QR.

### Decisão de encerramento
- A implementação de código da Recepção fica consolidada nesta PR como fase de desenvolvimento/testes, mas a estação NÃO está homologada nem pronta para produção.
- Para encerramento operacional são necessários: (1) rever/aprovar a proposta de persistência documental e validar em ambiente isolado; (2) decidir a matriz de acesso da Recepção às funções documentais e financeiras; (3) corrigir o contrato de pagamento; (4) homologar recepção física de mercadorias; (5) executar testes integrados com perfis reais em ambiente de validação.
- Nenhum destes passos foi aplicado remotamente nesta fase. Não foram alterados SQL, RLS, grants, Storage, perfis, contas, produção ou deploy.
- PR #41 permanece Draft e aberta, sem merge.

### CI final da branch
- Commit de documentação: `f8e268cba5a56901d467e654e78fc1c668999ea8`.
- GitHub Actions run `42632402207`: concluído com sucesso.
- Testes: 171 aprovados, 0 falhas; verificações das Edge Functions documentais, segurança/validação, sintaxe do motor e integração do dashboard também concluídas com sucesso.
- Este CI valida o código no repositório; não substitui a homologação remota ou testes de interface na aplicação instalada.


## Facturação na Recepção — PDF A4

O módulo passou a reutilizar o serviço PDF nativo do CIADI Desktop para compor uma pré-visualização A4 a partir dos registos centrais da factura e exportar o PDF real para o computador. A composição usa o logótipo incorporado pelo serviço central de identidade CIADI e os dados existentes do emitente, cliente, série e linhas.

A exportação local só é permitida para documentos cujo estado central seja emitido e cujo estado fiscal seja emitido. A interface permite pré-visualizar rascunhos, mas não confunde a pré-visualização com emissão fiscal.

**Limites ainda não homologados:** o servidor financeiro não fornece ainda um QR de autenticação verificável nem um arquivo central de PDF associado à factura. Quando o QR não está disponível, o documento declara essa ausência e não se apresenta como PDF oficial autenticado. A exportação actual grava uma cópia PDF local através do CIADI Desktop; não faz upload para o Supabase. A emissão/validação QR, hash, Storage e permissões devem ser tratados numa proposta de backend própria e aprovada, sem reutilizar a função documental do Suporte Informático nem contornar RLS.
