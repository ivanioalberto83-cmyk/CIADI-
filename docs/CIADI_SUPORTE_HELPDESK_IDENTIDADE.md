# CIADI — Helpdesk e identidade institucional central

## Âmbito
Esta entrega cria a primeira camada funcional do Helpdesk da estação Suporte Informático e um serviço central de identidade institucional.

## Helpdesk
- Validação de chamados, categorias, prioridades e localização.
- Fila de atendimento e indicadores de volume, estado, prioridade e SLA.
- Abertura de chamados associada ao utilizador autenticado.
- Leitura de histórico preparada para a tabela de eventos.
- Sem atribuição, alteração de estado, anexos ou encerramento nesta etapa; essas acções exigem políticas e RPCs de suporte homologadas.

## Identidade
- Nome institucional, paleta, tipografia, endereço, site e email num único serviço.
- Funções comuns para escapar conteúdo e compor cabeçalho documental.
- Os documentos existentes continuam compatíveis; migração integral dos modelos para o serviço central é uma etapa seguinte.

## Dependência de dados
O UI consulta o schema `ciadi_ti`, tabelas `helpdesk_tickets` e `helpdesk_ticket_events`. A proposta SQL está em `supabase/proposals/ciadi-ti-helpdesk-proposal.sql` e inclui referência sequencial no servidor, histórico automático e RLS. Se a estrutura não existir, informa que o serviço não está activado e não simula gravação. Não aplicar o SQL de proposta automaticamente.

## Segurança e limites
- Sem alteração ao Supabase remoto, Storage, RLS, permissões, contas, produção ou outras estações.
- Não activar atribuição/edição até validar perfil activo e autorização no servidor.
- Não configurar envio electrónico ou SLA automático sem canal e rotina homologados.
