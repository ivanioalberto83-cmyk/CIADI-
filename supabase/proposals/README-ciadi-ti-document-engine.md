# CIADI — Proposta de arquivo e emissão documental do Suporte Informático

**Estado:** proposta técnica para revisão. Não é uma migration aplicada nem está autorizada para execução em produção.

## Base factual da auditoria (2026-11-08)

- Projecto Supabase CIADI: `egpkkttbcaukqnnxyhjv`, região `eu-west-1`.
- O schema `ciadi_ti` existe e contém as tabelas operacionais de TI.
- `ciadi_ti.has_support_access()` existe e valida perfis activos `admin`, `gestor` e `suporte_informatica`.
- O bucket existente `documentos` é privado, mas as políticas actuais dependem de `is_staff()`; não deve ser reutilizado para o arquivo de TI sem alterar uma superfície de acesso partilhada.
- O PR #33 contém apenas a camada local de exportação PDF; ainda não existe integração UI/servidor com persistência e emissão.

## Decisões da proposta

1. Criar um bucket privado separado: `ciadi-ti-documentos`, apenas PDF e limite de 10 MiB.
2. Guardar objectos em `suporte-informatica/<document_uuid>.pdf`.
3. Criar `ciadi_ti.documents` para metadados e estado do documento.
4. Criar `ciadi_ti.document_sequences` para numeração por código documental e ano.
5. Criar `ciadi_ti.document_events` como histórico de eventos, com escrita apenas pelo servidor confiável.
6. Permitir ao cliente autenticado ler documentos do módulo e criar/editar apenas os seus rascunhos. Sem política de eliminação.
7. A emissão é transaccional, via função restrita a `service_role`; valida o perfil, reserva número, confirma o PDF no bucket, calcula/recebe hashes e bloqueia a mutação posterior.
8. QR Code contém token aleatório; apenas o hash é guardado. A verificação pública deve passar por Edge Function e devolver metadados mínimos, nunca o PDF nem dados internos.

## Fluxo previsto

1. Renderer cria rascunho em `ciadi_ti.documents`.
2. Serviço Electron produz PDF A4 com identidade CIADI.
3. Processo de servidor calcula SHA-256, cria token de verificação aleatório e carrega PDF para o bucket privado.
4. Edge Function chama `ciadi_ti.issue_document(...)`; a transacção reserva o número e emite o documento.
5. O QR Code aponta para a página pública de verificação, com token; o endpoint calcula o hash e compara sem revelar o token/hash.
6. Envio, exportação, consulta e tentativa de verificação são registados em `document_events`.

## Limites e validações obrigatórias

- Esta pasta é uma **proposta**, deliberadamente fora de `supabase/migrations`; não será executada automaticamente.
- Não foram criados buckets, tabelas, funções, políticas ou dados no projecto Supabase.
- O nome da coluna de MIME em `storage.objects.metadata` deve ser confirmado na versão activa antes da aplicação.
- Confirmar a exposição do schema `ciadi_ti` na Data API e privilégios necessários. Não expor o schema ao papel `anon`.
- A função `issue_document` é SECURITY DEFINER, por isso está no schema de TI, com search_path fixo, validação explícita do perfil e EXECUTE revogado de PUBLIC/anon/authenticated; só `service_role` pode invocá-la.
- A Edge Function deve validar o JWT do utilizador antes de chamar a função com o actor_id verificado. Nunca aceitar actor_id fornecido livremente pelo browser.
- A política do bucket novo não permite UPDATE nem DELETE; uploads devem usar caminhos únicos e nunca `upsert`.
- Antes de aplicação: testes RLS com quatro classes de utilizador, Supabase advisors, teste concorrente de numeração, teste de imutabilidade, teste de QR expirado/inválido e revisão de segurança.
- O PR #33 permanece independente; nenhuma alteração ao Setup, Administração, RH, Recepção, permissões de outros módulos ou produção.

## Ficheiros

- `ciadi-ti-document-engine-proposal.sql`: SQL proposto, ainda sujeito a revisão e validação de versão.
