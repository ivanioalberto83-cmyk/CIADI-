# CIADI — Proposta de arquivo e emissão documental do Suporte Informático

**Estado:** proposta técnica em revisão. Não é uma migration aplicada nem está autorizada para execução em produção.

## Base factual da auditoria (2026-11-08)

- Projecto Supabase CIADI: `egpkkttbcaukqnnxyhjv`, região `eu-west-1`.
- O schema `ciadi_ti` e a função `ciadi_ti.has_support_access()` foram identificados na auditoria read-only.
- A função de acesso valida perfis activos `admin`, `gestor` e `suporte_informatica`.
- O bucket existente `documentos` é privado e usa políticas baseadas em `is_staff()`; não deve ser reutilizado para o arquivo de TI.
- O PR #33 contém a camada local de exportação PDF, ainda sem integração completa no ciclo de emissão.

## Objectivo e desenho

Criar um motor documental para rascunhos, emissão oficial, PDF A4 com identidade CIADI, QR verificável, arquivo privado, consulta e histórico de eventos.

### Objectos propostos

1. `ciadi_ti.documents`: metadados, conteúdo estruturado, estado, número, localização e hashes.
2. `ciadi_ti.document_sequences`: sequência por código documental e ano.
3. `ciadi_ti.document_events`: histórico de criação, emissão, envio, exportação e verificação.
4. `ciadi_ti.document_issuance_sessions`: sessões temporárias com hash do token QR, actor, número reservado, validade de 10 minutos e consumo único.
5. Bucket privado `ciadi-ti-documentos`, exclusivo para PDFs do Suporte Informático, com limite de 10 MiB.

### Fluxo correcto de emissão

1. O utilizador autenticado cria e guarda um rascunho.
2. A Edge Function valida o JWT, consulta o perfil activo e deriva o actor_id da identidade verificada — nunca aceita um actor_id livre do browser.
3. O servidor gera um token aleatório QR e guarda apenas o seu SHA-256. Chama `prepare_document_issuance`, que valida o rascunho, reserva o número oficial e cria uma sessão válida por 10 minutos.
4. O serviço documental compõe o PDF A4 com identidade CIADI, número reservado e QR Code.
5. O servidor carrega o PDF final num caminho único `suporte-informatica/<document_uuid>.pdf`, sem `upsert`.
6. A Edge Function consulta Storage `.info(path)` e confirma o tipo e tamanho reais (1 a 10 MiB); não confia nos metadados enviados pelo renderer.
7. A Edge Function calcula SHA-256 dos bytes finais e chama `issue_document`. A transacção confirma a sessão, o PDF e o perfil, emite o documento, consome o token e regista o evento.
8. A página pública de verificação recebe o token QR, calcula o hash e devolve apenas metadados permitidos — nunca o PDF, payload, hashes, caminho interno ou dados pessoais.

A reserva antecipada pode deixar lacunas na sequência se a sessão expirar ou for substituída. Essas lacunas devem ser rastreáveis e nunca reutilizadas.

## Segurança e privilégios

- RLS activa nas tabelas do módulo; clientes autenticados só podem ler o módulo e criar/editar os seus próprios rascunhos.
- Não existe política de eliminação de documentos.
- O trigger impede alteração ou eliminação de documentos emitidos.
- As funções SECURITY DEFINER têm `search_path` fixo e EXECUTE revogado de PUBLIC, anon e authenticated; só `service_role` as pode invocar.
- A proposta concede explicitamente USAGE no schema `ciadi_ti` a `authenticated` e `service_role`.
- `service_role` recebe apenas os privilégios necessários para consulta e eventos; a emissão permanece atrás das funções.
- A chave privilegiada só pode existir no ambiente servidor. Nunca deve ser incluída no renderer, HTML, preload ou aplicação Electron distribuída.
- O bucket de TI é separado do bucket clínico existente. Não se alteram as políticas do bucket clínico.
- A exposição do schema `ciadi_ti` à Data API tem de ser confirmada. Não expor o schema ao papel `anon`.

## Correcções nesta revisão

- Removidos os blocos SQL duplicados e fragmentos que existiam depois do primeiro `COMMIT`.
- A função `prepare_document_issuance` reserva efectivamente o número antes da composição do PDF.
- A função `issue_document` usa o número reservado na sessão, confirma a validade e consome o token atomicamente.
- O teste de integração foi reescrito para cobrir reserva, emissão, correspondência do número, consumo do token, RLS e imutabilidade.
- Corrigida a utilização de variáveis psql dentro de blocos PL/pgSQL através de parâmetros de sessão de teste.

## Validação ainda necessária

O harness PostgreSQL isolado é apenas uma simulação compatível com PostgreSQL. Não substitui Supabase local ou projecto de teste real e não valida:
- Storage real e metadados devolvidos por `.info(path)`;
- JWT e runtime das Edge Functions;
- exposição da Data API e configuração real de privilégios;
- Advisors Supabase;
- concorrência multi-sessão e comportamento em falhas de rede;
- endpoint público de verificação QR e protecção contra enumeração.

Antes de qualquer aplicação real, executar os testes acima num projecto Supabase de teste, rever políticas RLS e Storage, testar concorrência, verificar Advisors e fazer revisão de segurança.

## Limites operacionais

- Esta pasta é uma proposta, deliberadamente fora de `supabase/migrations`; não será executada automaticamente.
- Nenhum bucket, tabela, função, política ou dado foi criado no projecto Supabase CIADI.
- Nenhuma alteração foi feita ao Setup, Administração, RH, Recepção ou permissões reais.
- Os PRs #33, #34, #35 e #36 permanecem independentes e sem merge, salvo confirmação posterior em GitHub.
