# CIADI Dashboard — Emergências SOS (homologação)

## Implementado nesta branch
- Novo item de navegação **Emergências SOS**.
- Consulta de leitura à tabela existente `public.ciadi_sos_alertas`, limitada aos 100 registos mais recentes.
- Acesso visual restrito aos perfis `admin` e `gestor`; a segurança final continua a depender de RLS no Supabase.
- Subscrição Supabase Realtime à tabela de alertas, com botão de atualização manual como alternativa.
- Mostra data/hora, tipo, estado, mensagem, referência curta e link para mapa apenas quando a localização foi explicitamente autorizada.
- Sem botões para fechar/alterar alertas, sem envio externo e sem integração WhatsApp activa.

## Restrições
- Não altera `main`, não aplica migrações à base de dados e não envia mensagens reais.
- O Realtime só funciona depois da migração aditiva ser revista e aplicada numa janela aprovada. Até lá, a consulta manual pode funcionar se as políticas RLS autorizarem.
- Confirmar as políticas RLS da tabela antes de homologação; a interface não substitui autorização no banco.
- Não considerar pronto para produção até validar os perfis, RLS, localização autorizada e eventos Realtime.
