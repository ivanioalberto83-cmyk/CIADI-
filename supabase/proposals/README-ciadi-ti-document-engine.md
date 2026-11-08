# CIADI — Proposta de arquivo e emissão documental do Suporte Informático

**Estado:** proposta técnica corrigida para revisão. Não é uma migration aplicada nem está autorizada para execução em produção.

## Base factual da auditoria (2026-11-08)

- Projecto Supabase CIADI: `egpkkttbcaukqnnxyhjv`, região `eu-west-1`.
- O schema `ciadi_ti` existe e contém as tabelas operacionais de TI.
- `ciadi_ti.has_support_access()` existe e valida perfis activos `admin`, `gestor` e `suporte_informatica`.
- O bucket existente `documentos` é privado, mas as políticas actuais dependem de `is_staff()`; não deve ser reutilizado para o arquivo de TI sem alterar uma superfície de acesso partilhada.
- O PR #33 contém a camada local de exportação PDF; ainda não existe integração UI/servidor com persistência e emissão.

## Correcções desta revisão

1. Reescrita integral da secção de emissão SQL para remover blocos duplicados e fragmentos de código que estavam depois do primeiro `COMMIT`.
2. Corrigidas as expressões regulares SHA-256 e hash do token QR: ambas exigem exactamente 64 caracteres hexadecimais.
3. A validação de tamanho rejeita valores nulos, zero e acima de 10 MiB.
4. A função de emissão confirma o objecto no bucket privado e o MIME `metadata.mimetype = application/pdf`.
5. A validação do tamanho real e do Content-Type efectivo deve ser feita pela Edge Function com Storage `.info(path)`; não se confia num tamanho enviado pelo browser.
6. Mantida a separação do bucket exclusivo e o acesso de cliente limitado por RLS.

## Decisões da proposta

1. Criar um bucket privado separado: `ciadi-ti-documentos`, apenas PDF e limite de 10 MiB.
2. Guardar objectos em `suporte-informatica/<document_uuid>.pdf`.
3. Criar `ciadi_ti.documents` para metadados e estado do documento.
4. Criar `ciadi_ti.document_sequences` para numeração por código documental e ano.
5. Criar `ciadi_ti.document_events` como histórico de eventos, com escrita apenas pelo servidor confiável.\n6. Criar `ciadi_ti.document_issuance_sessions` para tokens QR temporários, com hash, actor, validade de 10 minutos e consumo atómico na emissão.
6. Permitir ao cliente autenticado ler documentos do módulo e criar/editar apenas os seus rascunhos. Sem política de eliminação.
7. A emissão é transaccional, via função restrita a `service_role`; valida o perfil, reserva número, confirma o PDF no bucket e grava hashes.
8. QR Code contém token aleatório; apenas o hash é guardado. A verificação pública deve passar por Edge Function e devolver metadados mínimos, nunca o PDF nem dados internos.

## Fluxo previsto

1. Renderer cria rascunho em `ciadi_ti.documents`.
2. Serviço Electron produz PDF A4 com identidade CIADI.
3. Edge Function valida JWT e perfil activo, calcula SHA-256, cria token de verificação aleatório, carrega o PDF no bucket privado e consulta Storage `.info(path)` para confirmar tipo e tamanho.
4. Edge Function chama `ciadi_ti.issue_document(...)`; a transacção reserva o número e emite o documento.
5. O QR Code aponta para a página pública de verificação, com token; o endpoint calcula o hash e compara sem revelar o token/hash.
6. Envio, exportação, consulta e tentativa de verificação são registados em `document_events` por operações de servidor controladas.

## Limites e validações obrigatórias

- Esta pasta é uma **proposta**, deliberadamente fora de `supabase/migrations`; não será executada automaticamente.
- Não foram criados buckets, tabelas, funções, políticas ou dados no projecto Supabase.
- A confirmação de `metadata.mimetype` deve ser feita na versão activa do Storage antes de aplicação; a Edge Function também deve confirmar `contentType` através de `.info(path)`.
- Confirmar a exposição do schema `ciadi_ti` na Data API e privilégios necessários. Não expor o schema ao papel `anon`.
- A função `issue_document` é SECURITY DEFINER, por isso está no schema de TI, com search_path fixo, validação explícita do perfil e EXECUTE revogado de PUBLIC/anon/authenticated; só `service_role` pode invocá-la.
- A Edge Function deve validar o JWT do utilizador e obter o actor_id a partir da identidade verificada. Nunca aceitar actor_id fornecido livremente pelo browser.
- A chave privilegiada só pode existir no ambiente servidor. Nunca a incluir no renderer, HTML, preload ou aplicação Electron distribuída.
- A política do bucket novo não permite UPDATE nem DELETE; uploads devem usar caminhos únicos e nunca `upsert`.
- Antes de aplicação: testes RLS com quatro classes de utilizador, Supabase advisors, teste concorrente de numeração, teste de imutabilidade, teste de QR inválido e revisão de segurança.
- O PR #33 permanece independente; nenhuma alteração ao Setup, Administração, RH, Recepção, permissões de outros módulos ou produção.

## Ficheiros

- `ciadi-ti-document-engine-proposal.sql`: SQL proposto, corrigido nesta revisão, ainda sujeito a validação num ambiente isolado.

## Revisão adicional — privilégios e testes isolados

- A função RPC de emissão está no schema personalizado `ciadi_ti`. Por isso, a proposta concede explicitamente `USAGE` nesse schema a `service_role`, além de `EXECUTE` na função; sem ambos, a Edge Function pode não conseguir invocar a RPC.
- As Edge Functions de confiança precisam de consultar os metadados documentais e registar eventos. A proposta concede a `service_role` apenas `SELECT` em `documents` e `SELECT/INSERT` em `document_events`; não concede actualização ou eliminação directa de documentos emitidos.
- Foi acrescentado um harness PostgreSQL isolado em `supabase/tests/`, com objectos mínimos compatíveis com Supabase, execução da proposta e verificações de RLS, emissão, sequência, registo de evento e imutabilidade.
- O harness é uma simulação PostgreSQL, não substitui um teste Supabase local/real: não valida o comportamento interno real do Storage, JWT/Edge Runtime, Data API, Advisors ou concorrência de múltiplas emissões. Os testes agora também verificam a criação e consumo da sessão temporária QR.
- A exposição do schema `ciadi_ti` à Data API continua a ser uma configuração explícita a confirmar. Não expor o schema a `anon`; conceder apenas o acesso autenticado estritamente necessário.
