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
- A identidade central está disponível no código; a migração integral de todos os modelos documentais continua a exigir inventário e validação individual.

## Dependência de dados
O UI consulta o schema `ciadi_ti`, tabelas `helpdesk_tickets` e `helpdesk_ticket_events`. A proposta SQL está em `supabase/proposals/ciadi-ti-helpdesk-proposal.sql` e inclui referência sequencial no servidor, histórico automático, eventos de alteração e RLS. A proposta exige previamente a função `ciadi_ti.has_support_access()`; a definição dessa função não foi encontrada na branch auditada. Sem essa dependência e sem exposição validada do schema à Data API, a activação real não está homologada.

## Segurança e limites
- Sem alteração ao Supabase remoto, Storage, RLS, permissões, contas, produção ou outras estações.
- A interface envia operações autenticadas e depende das políticas do servidor; não se considera autorização comprovada até testar perfis reais e RLS em ambiente isolado.
- Atribuição por ID técnico é funcional no contrato de dados, mas a pesquisa/lista de técnicos ainda precisa de uma fonte de utilizadores autorizada.
- Não estão implementados anexos, envio electrónico, nem cálculo automático de SLA.
- Não aplicar a proposta SQL automaticamente.
