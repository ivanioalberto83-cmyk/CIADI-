-- CIADI — bloquear a emissão fiscal via utilizadores da aplicação até validação AGT
-- PROPOSTA PARA HOMOLOGAÇÃO. NÃO aplicar em produção sem backup restaurável,
-- testes de integração, autorização explícita e plano de reativação aprovado.
-- Esta migração não apaga documentos nem altera séries. Retira EXECUTE ao cliente
-- autenticado para impedir emissão fiscal oficial enquanto o sistema não está validado.
-- A criação de rascunhos continua disponível através de ciadi_faturacao_criar_documento.
begin;

revoke execute on function public.ciadi_faturacao_emitir_documento(uuid)
  from public, anon, authenticated;

commit;

-- Reativação futura (NÃO executar até haver validação formal e evidência):
-- grant execute on function public.ciadi_faturacao_emitir_documento(uuid) to authenticated;
