# CIADI — Helpdesk e identidade institucional central

## Âmbito
Esta entrega consolida a primeira camada operacional do Helpdesk da estação Suporte Informático e utiliza o serviço central de identidade institucional existente.

## Helpdesk disponível no código
- Validação de chamados, categorias, prioridades e localização.
- Fila de atendimento e indicadores de volume, estado, prioridade e SLA.
- Abertura de chamados associada ao utilizador autenticado.
- Consulta do histórico de eventos.
- Atribuição de técnico por identificador de utilizador.
- Actualização de estado: aberto, em tratamento, a aguardar, resolvido e encerrado.
- Registo de intervenções com histórico cronológico.
- Atribuição, alteração de estado e intervenções dependem da autorização RLS no servidor; o cliente não substitui essa autorização.

## Identidade
- Nome institucional, paleta, tipografia, endereço, site e email num único serviço.
- Funções comuns para escapar conteúdo e compor cabeçalho documental.
- O motor documental disponibiliza consulta do arquivo, pesquisa por referência/título/código, filtro por estado, indicadores de rascunhos/emitidos, consulta do histórico de eventos e exportação do PDF oficial para documentos emitidos.
- Os 116 tipos do catálogo continuam distribuídos por oito motores. Os documentos e relatórios não-dashboard dispõem agora de formulários padrão gerados pelo perfil do respectivo motor; os dez modelos anteriores mantêm os seus campos específicos. Estes formulários padrão são uma primeira camada e não substituem ainda a validação de campos próprios de cada documento.
- A identidade central está disponível no código; a migração integral de todos os modelos documentais continua a exigir inventário e validação individual.

## Auditoria read-only do Aprovisionamento (2026-11-08)
- Confirmado no Supabase `egpkkttbcaukqnnxyhjv`: schema `ciadi_ti` com 10 tabelas operacionais de inventário, compras, stock, contagens e auditoria; as 10 tabelas apresentavam zero registos no momento da consulta.
- A vista `ciadi_ti.stock_balances` existe, é uma view com `security_invoker=true` e agrega os movimentos por artigo/armazém. A listagem de tabelas não a apresentou por ser uma view; a interface consulta a vista existente.
- Confirmadas as funções `has_support_access()`, `has_finance_approval()`, `decide_purchase_request()`, `post_stock_movement()` e `transfer_stock()`. As funções transaccionais de stock verificam acesso, artigo/armazém activos e saldo suficiente; a transferência regista saída e entrada numa operação.
- RLS está activo nas 10 tabelas consultadas. O acesso de suporte depende de perfil activo `suporte_informatica`, além de `admin` e `gestor` na função comum.
- A decisão de compra é feita por `decide_purchase_request()`, que limita a aprovação/rejeição a `admin` e `gestor`, e apenas para pedidos submetidos.
- **Risco a tratar na fase de permissões:** a policy actual de UPDATE em `purchase_requests` filtra por acesso de suporte e estado, mas não limita `requested_by` ao utilizador autor. A interface adiciona uma verificação de autoria antes da submissão, mas isso não substitui uma condição RLS no servidor. Não foi alterada qualquer policy.
- A consulta confirmou USAGE no schema e privilégios de SELECT/INSERT/UPDATE de `authenticated` em `purchase_requests`. A exposição efectiva na Data API ainda deve ser confirmada no PostgREST/Data API settings.
- Nenhuma escrita foi executada na base de dados durante esta auditoria.

## Fluxos de Aprovisionamento implementados no código
- Criar pedido de aquisição em rascunho, com linha, quantidade, unidade, fornecedor opcional e cálculo do total estimado.
- Submeter pedido à Administração, com verificação de autoria na camada de serviço; a decisão financeira continua fora da estação Suporte Informático.
- Registar entradas, saídas, ajustes e devoluções usando exclusivamente `post_stock_movement()`.
- Transferir stock entre armazéns usando exclusivamente `transfer_stock()`, sem inserts directos na tabela de movimentos.
- Criar contagens físicas em rascunho e marcar a contagem como concluída; a reconciliação final permanece separada.
- Os formulários de pedido de aquisição e de contagem física permitem adicionar/remover várias linhas dinamicamente; o serviço valida e grava o conjunto de linhas e mantém o fluxo de recuperação para cabeçalhos que fiquem gravados se a inserção das linhas falhar.
- Consultar a vista de saldos existente `stock_balances`.
- Apresentar alertas por artigo/armazém abaixo do stock mínimo configurado e distinguir artigos sem saldo; a regra exclui artigos com stock mínimo igual a zero.

- A recepção/conferência de mercadoria não foi implementada nesta fase: a auditoria não encontrou uma tabela de recepções/entregas nem uma RPC de recepção no schema consultado. O movimento de entrada existente não será apresentado como recepção formal de encomenda.

## Formulários e relatórios
- O catálogo mantém 116 tipos em oito motores.
- Os tipos documentais e relatórios não-dashboard têm formulários padrão gerados por motor; os dez modelos originais mantêm os seus campos específicos.
- Os campos padrão ainda carecem de validação individual para cada tipo documental; os painéis e gráficos dependem da ligação às fontes operacionais.
- A estação inclui uma vista de Auditoria e Relatórios com acções frequentes, actividade diária e registos recentes, limitada aos últimos 300 registos permitidos pela consulta.

## Dependência de dados
O UI consulta o schema `ciadi_ti`, tabelas `helpdesk_tickets` e `helpdesk_ticket_events`. A proposta SQL está em `supabase/proposals/ciadi-ti-helpdesk-proposal.sql` e inclui referência sequencial no servidor, histórico automático, eventos de alteração e RLS. A proposta exige previamente a função `ciadi_ti.has_support_access()`; a definição dessa função não foi encontrada na branch auditada. Sem essa dependência e sem exposição validada do schema à Data API, a activação real não está homologada.

## Segurança e limites
- Sem alteração ao Supabase remoto, Storage, RLS, permissões, contas, produção ou outras estações.
- A interface envia operações autenticadas e depende das políticas do servidor; não se considera autorização comprovada até testar perfis reais e RLS em ambiente isolado.
- Atribuição por ID técnico é funcional no contrato de dados, mas a pesquisa/lista de técnicos ainda precisa de uma fonte de utilizadores autorizada.
- Não estão implementados anexos, envio electrónico, nem cálculo automático de SLA.
- Não aplicar a proposta SQL automaticamente.
