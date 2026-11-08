# CIADI TI — Edge Functions do motor documental

**Estado:** implementação em branch de revisão; não publicada no Supabase.

## Funções

### `ciadi-ti-issue-document`
- Autenticação obrigatória do utilizador via `withSupabase({ auth: "user" })`.
- A plataforma delega a validação JWT ao SDK; o `verify_jwt = false` no `config.toml` é intencional para suportar a gestão moderna de chaves. Não significa endpoint anónimo.
- Obtém o actor exclusivamente de `ctx.userClaims.id`; nunca aceita `actor_id` do formulário.
- Confirma em `public.perfis` que o perfil está activo e é admin, gestor ou suporte_informatica.
- Consulta o rascunho em `ciadi_ti.documents`; aceita apenas estado `draft`.
- Recebe multipart/form-data com `document_id` e `file`; valida limite de 10 MiB, MIME, cabeçalho PDF e marcador EOF.
- Carrega para o bucket privado com `upsert: false`; consulta Storage `.info(path)` e compara tamanho/MIME.
- Calcula SHA-256, gera token aleatório de 256 bits, guarda apenas o hash via RPC `ciadi_ti.issue_document`.
- Devolve número e URL HTTPS com token para QR. Não devolve o PDF nem o hash.
- Em caso de falha antes da emissão, tenta remover o objecto carregado. A limpeza é registada sem expor conteúdo ou credenciais.

### `ciadi-ti-verify-document`
- Endpoint público deliberado, com `auth: "none"`; a validação depende de token aleatório de 256 bits e hash SHA-256.
- Responde apenas com autenticidade, número, código documental, data de emissão e emissor CIADI.
- Não revela payload, título, dados pessoais, autor, hash, caminho Storage ou PDF.
- Usa resposta uniforme `not_verified` para identificadores/tokens inválidos ou documentos não encontrados.

## Configuração necessária no projecto

1. Confirmar que o schema `ciadi_ti` está exposto à Data API para as Edge Functions; não expor a `anon`. O código usa explicitamente `.schema("ciadi_ti")`.
2. Confirmar que as Edge Functions têm as variáveis padrão `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` e `SUPABASE_SECRET_KEYS` disponíveis. O SDK `@supabase/server@1.9.2` usa as chaves nomeadas e cria o cliente privilegiado apenas no servidor.
3. Definir `SUPABASE_URL` com a URL pública do projecto, porque é usada para formar a URL HTTPS de verificação.
4. Rever CORS/origem, limite de pedido, política de retenção e rate limiting do endpoint público antes de publicar.
5. Testar com Supabase local/branch não produtiva e utilizadores de teste.

## Contrato de invocação

`POST /functions/v1/ciadi-ti-issue-document`

- Header `Authorization: Bearer <JWT do utilizador>`
- Header `apikey: <publishable key>`
- Body `multipart/form-data`: `document_id=<UUID>`, `file=<PDF>`

Resposta de sucesso:
- `ok`
- `document.id`, `document.number`, `document.type`, `document.title`, `document.status`
- `verificationUrl` — URL secreta de uso documental; não deve ser registada em logs nem partilhada fora do QR/documento.

`GET /functions/v1/ciadi-ti-verify-document?document_id=<UUID>&token=<token>`

Resposta pública allowlisted:
- `valid`, `status`, `issuer`, `document_number`, `document_type`, `issued_at`

## Limites conhecidos

- Ainda não existe integração da UI/serviço Electron para enviar o PDF e chamar estas funções.
- O esquema SQL continua uma proposta, não aplicada. O código depende das tabelas, RPC e bucket previstos no PR #35/#36.
- O endpoint público ainda não tem rate limiting persistente; antes de produção deve ser protegido por regra de tráfego/rate limit e monitorização.
- A consulta Data API a `ciadi_ti` depende da exposição do schema; isso tem de ser validado no ambiente de teste.
- Não foi executado Deno local neste ambiente; o workflow GitHub Actions faz `deno check` e testes unitários.
- Nenhum segredo é incluído no repositório. Não configurar nem publicar funções em produção nesta fase.

- Dependências Deno: versão directa de `@supabase/server` fixada em `deno.json`; árvore resolvida fixada em `deno.lock`. O workflow valida os tipos e executa os testes usando esse lockfile.
