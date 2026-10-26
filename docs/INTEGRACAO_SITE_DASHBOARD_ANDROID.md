# CIADI — integração Site, Dashboard e CIADI+

## Alteração desta branch

Foi acrescentado ao Dashboard um módulo **Alertas SOS** que consulta `public.ciadi_sos_alertas`, apresenta os alertas que a sessão autenticada está autorizada a ler e tenta atualizar a lista através do Supabase Realtime. Existe também o botão **Atualizar agora** como recuperação manual.

O módulo está restrito na interface a perfis `admin`, `gestor` e `operador`; a autorização real continua a depender de RLS e permissões no banco de dados. A interface não altera o estado do alerta nem afirma que WhatsApp/email foram entregues. A localização só é ligada ao mapa se o registo indicar consentimento/autorização e tiver coordenadas válidas.

## Projeto partilhado

O Dashboard, o site institucional e o CIADI+ Android apontam para o projeto Supabase `egpkkttbcaukqnnxyhjv`. O site completo está em `CIADI-SITE-OFICIAL/INDEX.HTML.CIADI.html`; o Android chama a RPC `ciadi_criar_alerta_sos` e utiliza as tabelas de chat/notificações CIADI.

## Antes de produção

1. Confirmar que a migração versionada de SOS foi aplicada e revista no ambiente correto. Esta alteração de interface **não aplica migrações à base de dados**.
2. Verificar RLS e políticas de leitura de `ciadi_sos_alertas` para os perfis de gestão.
3. Confirmar que a tabela está na publicação Realtime; caso contrário, o botão manual continua disponível, mas não haverá atualização instantânea.
4. Testar com um paciente fictício autorizado e uma conta de gestão de homologação.
5. Confirmar receção no Dashboard, protocolo, data/hora e tratamento de coordenadas opcionais.
6. Testar com uma conta sem autorização e confirmar que não consegue consultar alertas ou pacientes.
7. Fazer backup verificável e preparar rollback antes de aplicar qualquer mudança de esquema em produção.

## Limites

- A implementação é uma interface de leitura, não um sistema de despacho de emergência por si só.
- A entrega de notificações externas exige configuração e confirmação do fornecedor/canal.
- Não foi comprovado aqui um teste ponta a ponta em produção nem uma compilação do instalador Windows.
