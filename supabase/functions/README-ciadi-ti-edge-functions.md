# CIADI TI — Edge Functions do motor documental

**Estado:** implementação em branch de revisão; não publicada no Supabase.

## Funções

### `ciadi-ti-prepare-document`
- Autenticação obrigatória via `withSupabase({ auth: "user" })`; o actor vem de `ctx.userClaims.id`.
- Confirma perfil activo em `public.perfis` e verifica que o documento é um rascunho do próprio utilizador.
- Gera token aleatório de 256 bits; calcula e guarda apenas SHA-256.
- Chama a RPC protegida `ciadi_ti.prepare_document_issuance`, que reserva atomicamente o número oficial e cria uma sessão de emissão com validade de 10 minutos.
- Invalida sessões anteriores ainda não consumidas para o mesmo rascunho.
- Gera o QR Code SVG no servidor e devolve `documentNumber`, `verificationUrl`, `qrDataUrl` e `expiresAt`.
- O token em claro só é devolvido dentro da URL de verificação ao cliente autenticado, para o incluir no QR/PDF. Não é escrito em logs.

### `ciadi-ti-issue-document`
- Autenticação obrigatória via `withSupabase({ auth: "user" })`; nunca aceita `actor_id` do cliente.
- Recebe multipart/form-data com `document_id`, `verification_token` e `file`.
- Confirma perfil activo, autoria do rascunho e sessão QR correspondente, não expirada e ainda não consumida.
- Valida limite de 10 MiB, MIME, assinatura PDF e marcador EOF.
- Carrega para o bucket privado com `upsert: false`; consulta Storage `.info(path)` e confirma tamanho/MIME.
- Calcula SHA-256 e chama `ciadi_ti.issue_document`. A transacção valida e consome a sessão, atribui o número previamente reservado, emite o documento e regista o evento.
- A finalização é idempotente para o mesmo token e os mesmos bytes: em caso de resposta perdida, a repetição recupera o estado emitido ou reusa o mesmo objecto se o rascunho continuar pendente. Em resultados ambíguos, o PDF é preservado; nunca é apagado automaticamente.

### `ciadi-ti-verify-document`
- Endpoint público deliberado, com `auth: "none"`; a validação depende de token aleatório de 256 bits e hash SHA-256.
- Para leitores QR em navegador (`Accept: text/html`), apresenta uma página de verificação CIADI com identidade institucional e estado visual de validação; para integrações (`Accept: application/json`), mantém resposta JSON.
- A página HTML escapa os valores provenientes da base de dados e aplica CSP restritiva, `X-Frame-Options: DENY`, `no-store` e `no-referrer`.
- Responde apenas com autenticidade, número, código documental, data de emissão e emissor CIADI.
- Não revela payload, título, dados pessoais, autor, hash, caminho Storage, PDF ou token.
- Usa resposta uniforme `not_verified` para identificadores/tokens inválidos ou documentos não encontrados.

## Fluxo funcional

1. O renderer guarda um rascunho em `ciadi_ti.documents`.
2. A função `ciadi-ti-prepare-document` reserva o número e devolve QR antes da composição final.
3. O motor documental inclui o número reservado e o QR no HTML A4.
4. O processo principal Electron gera os bytes PDF em memória, sem gravar ficheiro ainda.
5. A função `ciadi-ti-issue-document` arquiva o PDF e emite-o transaccionalmente.
6. Só depois da confirmação o utilizador pode exportar os bytes do PDF original arquivado; o processo Electron não volta a compor um PDF emitido.

## Configuração necessária no projecto

1. Confirmar que o schema `ciadi_ti` está exposto à Data API para as Edge Functions; não expor a `anon`. O código usa explicitamente `.schema("ciadi_ti")`.
2. Confirmar que as Edge Functions têm as variáveis padrão `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` e `SUPABASE_SECRET_KEYS` disponíveis. O SDK `@supabase/server@1.9.2` usa as chaves nomeadas e cria o cliente privilegiado apenas no servidor.
3. Definir `SUPABASE_URL` com a URL HTTPS pública do projecto, usada para formar a URL de verificação.
4. Rever CORS/origem, limite de pedido, política de retenção e rate limiting do endpoint público antes de publicar.
5. Testar com Supabase local/branch não produtiva e utilizadores de teste.

## Contratos de invocação

`POST /functions/v1/ciadi-ti-prepare-document`

- Header `Authorization: Bearer <JWT do utilizador>`
- Header `apikey: <publishable key>`
- JSON `{ "document_id": "<UUID>" }`

Resposta: `documentId`, `documentNumber`, `verificationUrl`, `qrDataUrl`, `expiresAt`. O token é devolvido apenas na URL HTTPS para ser incorporado no QR.

`POST /functions/v1/ciadi-ti-issue-document`

- Header `Authorization: Bearer <JWT do utilizador>`
- Header `apikey: <publishable key>`
- Body `multipart/form-data`: `document_id=<UUID>`, `verification_token=<token da URL preparada>`, `file=<PDF final com QR e número>`

Resposta: `document.id`, `document.number`, `document.type`, `document.title`, `document.status`, `verificationUrl`.

`GET /functions/v1/ciadi-ti-verify-document?document_id=<UUID>&token=<token>`

Resposta pública allowlisted: `valid`, `status`, `issuer`, `document_number`, `document_type`, `issued_at`.

## Limites conhecidos

- O SQL continua uma proposta, não aplicada. O código depende das tabelas, RPC e bucket previstos no PR #36.
- A exposição Data API do schema `ciadi_ti` ainda tem de ser confirmada.
- O endpoint público ainda não tem rate limiting persistente; antes de produção deve ser protegido por regra de tráfego/rate limit e monitorização.
- A recuperação idempotente cobre a repetição com o mesmo token e os mesmos bytes do PDF. Se a sessão expirar ou o PDF já carregado não corresponder aos novos bytes, é necessária revisão/limpeza controlada antes de preparar outra emissão.
- Números reservados por sessões expiradas podem criar lacunas na sequência; os números nunca são reutilizados.
- O envio electrónico não está ligado: falta escolher e configurar o canal institucional e o registo de entrega.
- A página de verificação visual está incluída na resposta HTML do endpoint QR; ainda falta homologar o URL público no domínio institucional CIADI e testar a leitura em dispositivos móveis.
- O endpoint público ainda não tem rate limiting persistente; antes de produção deve ser protegido por regra de tráfego/rate limit e monitorização.
- Nenhuma função foi publicada, nenhum segredo foi configurado e nenhuma alteração foi aplicada ao Supabase CIADI.
