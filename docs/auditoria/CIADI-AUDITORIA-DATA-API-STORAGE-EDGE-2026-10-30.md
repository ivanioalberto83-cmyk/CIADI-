# CIADI — Auditoria de acessos Data API, Storage, Views e Edge Functions
**Data:** 30-10-2026  
**Projecto Supabase:** `egpkkttbcaukqnnxyhjv`  
**Branch de implementação:** `implementation/ciadi-modular-shell-clean-20261030`  
**Estado:** auditoria somente de leitura. Nenhuma escrita ou alteração em produção.

## 1. Resumo executivo

Esta fase ampliou a auditoria para os caminhos de acesso fora das políticas de tabela: grants SQL, views, Storage, RPCs `SECURITY DEFINER`, Edge Functions e chamadas efectivas do Dashboard.

Achados que exigem correcção prioritária antes de qualquer homologação:
1. **Conhecimentos CIADI:** a política de leitura para `anon` e `authenticated` permite ler toda a linha activa (`ativo=true`), sem filtrar a coluna `publico`. A contagem agregada confirma registos activos classificados como `interno` e `familias`; a regra actual não os exclui de utilizadores anónimos.
2. **Recrutamento:** `anon` tem INSERT nas colunas de estado e código de candidatura, além dos campos públicos do formulário. A política só valida a vaga. O trigger gera o código apenas quando está vazio, permitindo ao cliente fornecer código e estado. O estado admite valores como `aprovada` e `rejeitada`. A consulta de estado é uma Edge Function sem JWT que usa service role e procura pelo código.
3. **Storage:** o bucket privado `documentos` usa `is_staff()` para leitura, escrita, actualização e eliminação; a função inclui A.T. activos. O bucket público `ciadi-app-updates` também usa `is_staff()` para operações de escrita/actualização/eliminação, criando risco de cadeia de distribuição se aí forem colocados instaladores/actualizações.
4. **Faturação:** `ciadi_faturacao_emitir_documento` usa `is_staff()`, que inclui A.T. activos, em vez de uma autorização financeira específica.
5. **Registos clínicos:** `ciadi_criar_ficha_comportamento` usa `is_staff()` e não valida no corpo da função a atribuição do A.T. ao paciente recebido.

Estes são achados estáticos baseados em políticas, grants, código e contagens. Não foi feita tentativa de exploração nem inserção de registos de teste em produção.

## 2. Dashboard actual — superfície funcional

A leitura da versão do Dashboard presente na branch identificou:
- **25 rotas/módulos** registados no `ModuleRegistry`: overview, SOS, pedidos de triagem do site, agendamentos, financeiro, faturação, caixa/tesouraria, contabilidade, SAF-T, especialidades, triagens, pacientes/famílias, profissionais, documentos/formulários clínicos, portal/famílias, conteúdos do site, multimédia, marketing, Janeth, utilizadores, instituição/redes, empresas/emitente, clínica virtual, auditoria e A.T.
- **57 destinos distintos** de `.from()` (tabelas e views) e **9 RPCs** chamados directamente pelo Dashboard.
- Buckets referenciados directamente no HTML actual: `profissionais`, `documentos` e `galeria`.
- A versão actual do HTML não contém chamadas directas às tabelas de RH `ciadi_funcionarios` ou `ciadi_funcionario_*`; também não apresenta rotas próprias de RH, Recepção ou Suporte Informático. Estes módulos continuam por integrar nesta shell.
- A função `visibleMenu()` filtra o módulo A.T.; a função `go(id)` encaminha directamente para as funções de cada módulo e não tem verificação centralizada de autorização por módulo/acção. A segurança tem de ser garantida no servidor/RLS/RPC, não pelo menu.

### RPCs chamados directamente pelo Dashboard
`ciadi_at_selecionar_profissional`, `ciadi_emitir_documento_clinico`, `ciadi_faturacao_criar_documento`, `ciadi_faturacao_emitir_documento`, `ciadi_finance_integrar_pagamento`, `ciadi_preparar_sala_video`, `ciadi_saft_diagnostico`, `finance_postar_documento`, `finance_registar_pagamento`.

### Mapeamento de domínios
- **Clínica:** `pacientes`, `agendamentos`, `profissionais`, `especialidades`, `ciadi_triagens`, `ciadi_avaliacoes_clinicas`, `ciadi_formularios_clinicos`, `documentos_clinicos`, `salas_video`, vínculos familiares e formulários.
- **Financeiro:** documentos e linhas fiscais, empresas, emitente, séries, clientes, contas, bancos, despesas, caixa, movimentos, pagamentos, períodos, lançamentos, SAF-T e views de resultados/tesouraria.
- **SOS:** `ciadi_sos_alertas` e funções/rotas do alerta.
- **RH:** existem tabelas no backend, mas não foram encontrados acessos directos no HTML actual do Dashboard.
- **Storage:** os três buckets directamente referenciados pelo Dashboard são `profissionais`, `documentos` e `galeria`.

## 3. Conhecimentos CIADI — leitura anónima demasiado ampla

Política observada:
- Tabela: `public.ciadi_conhecimentos`
- Política: `CIADI conhecimentos leitura`
- Roles: `anon, authenticated`
- Comando: `SELECT`
- Predicado: `ativo = true`

A condição não filtra `publico` nem a área. A contagem agregada dos registos activos (sem ler o conteúdo) foi:
| Classificação `publico` | Registos activos |
|---|---:|
| `publico` | 363 |
| `familias` | 9 |
| `interno` | 1 |
| `todos` | 2 |

A Edge Function `ciadi-indexacao-auto` filtra explicitamente `publico = 'publico'` e exclui a área `seguranca_janeth`, mas a política de tabela não aplica os mesmos filtros. Isto demonstra uma divergência entre a intenção de visibilidade do processamento e a regra de leitura anónima.

**Classificação:** risco elevado de divulgação de conteúdos internos/familiares.  
**Correcção a desenhar:** política de leitura pública deve limitar-se a conteúdo explicitamente publicado; acesso familiar deve depender de vínculo/permissão; conteúdo interno deve exigir autorização autenticada específica. Não basta esconder conteúdo no frontend.

## 4. Recrutamento — inserção pública permite controlar campos internos

Tabela `recrutamento_candidaturas`:
- Política `recrutamento_candidaturas_public_insert` para `anon, authenticated`.
- `WITH CHECK` valida apenas que `vaga_id` seja nula ou corresponda a uma vaga activa dentro do prazo.
- O papel `anon` tem privilégio INSERT de coluna para **todas** as colunas, incluindo `estado`, `codigo_candidatura`, `cv_storage_path`, `email_enviado_at` e `email_erro`.
- O CHECK de `estado` aceita `recebida`, `em_analise`, `contactada`, `entrevista`, `aprovada`, `rejeitada` e `arquivada`.
- O trigger `ciadi_gerar_codigo_candidatura` apenas gera um código se o valor recebido for nulo/vazio; não substitui um código fornecido pelo cliente.
- O código gerado tem 8 caracteres hexadecimais após `CIADI-` (32 bits de espaço de códigos).
- A Edge Function `ciadi-recrutamento-consulta` tem `verify_jwt=false`, usa a service role e devolve código, estado, data e título da vaga quando recebe o código correcto. No código inspeccionado não existe limitação de tentativas/rate limit.

**Classificação:** risco elevado de integridade dos registos de candidatura e de enumeração/consulta indevida de estados.  
**Correcção a desenhar:** aceitar do público apenas os campos estritamente necessários ao formulário; gerar sempre código e estado no servidor; nunca aceitar do cliente campos internos; código aleatório com entropia suficiente; endpoint de consulta com rate limit, resposta mínima e controlo anti-enumeração. A inserção pública deve ser testada com payloads negativos em ambiente isolado.

## 5. Storage — buckets e políticas

Foram observados 10 buckets e 34 políticas em `storage.objects`.

| Bucket | Público | Controlo observado | Observação |
|---|---|---|---|
| `banners` | Sim | leitura pública; escrita por `is_staff()` | A.T. incluído em staff |
| `galeria` | Sim | leitura pública; escrita por `is_staff()` | A.T. incluído em staff |
| `logos` | Sim | leitura pública; escrita por `is_staff()` | A.T. incluído em staff |
| `profissionais` | Sim | leitura pública; escrita por `is_staff()` | A.T. incluído em staff |
| `loja_ciadi` | Sim | leitura pública; escrita por `is_staff()` | A.T. incluído em staff |
| `ciadi-app-updates` | Sim | download público; escrita/actualização/eliminação por `is_staff()` | Risco de cadeia de distribuição se guardar pacotes da app |
| `documentos` | Não | CRUD por `is_staff()` | A.T. pode satisfazer o predicado; sem delimitação por pasta/paciente/funcionário |
| `chat-anexos` | Não | membro activo do grupo, pelo primeiro segmento do caminho | Âmbito mais específico por grupo |
| `marketing` | Sim | gestão de imagens por admin/gestor | Acesso de gestão mais restrito |
| `marketing-anexos` | Não | admin/gestor | Acesso de gestão mais restrito |

A política `is_staff()` não separa RH, clínica, suporte, conteúdo e distribuição de software. Para o bucket privado `documentos`, a política permite a um A.T. activo consultar, carregar, actualizar ou apagar objectos do bucket inteiro. Para `ciadi-app-updates`, o mesmo predicado permite escrita sobre um bucket de download público.

**Classificação:** risco elevado para documentos privados e risco crítico potencial para actualizações de software se o bucket contiver APKs/instaladores consumidos pelos dispositivos CIADI. Confirmar o uso do bucket e o fluxo de assinatura/hash do instalador antes de qualquer correcção.

## 6. Views — segurança e grants

- Foram identificadas 24 views em `public`.
- 23 têm `security_invoker=true`, pelo que as permissões/RLS do utilizador invocador são aplicadas.
- `ciadi_status_indexacao` não apresenta a opção `security_invoker`, mas não tem SELECT concedido a `anon` nem a `authenticated` na verificação efectuada.
- 17 views têm SELECT concedido a `anon`. Entre elas há views de balanço, balancete, DRE, resultados, reconciliação, tesouraria e consultas online. A presença do GRANT não prova exposição de linhas: as views inspeccionadas usam `security_invoker=true` e as tabelas base continuam a aplicar RLS.
- Nas tabelas financeiras base verificadas não foi encontrada política de SELECT para `anon`; o único predicado público explícito nesta amostra foi o da tabela de conhecimentos.

**Recomendação:** remover grants públicos desnecessários após confirmar consumidores; manter `security_invoker=true` nas views expostas e testar com papel `anon` e perfis reais fictícios. Não alterar grants em produção nesta fase.

## 7. Edge Functions sem verificação JWT automática

Foram listadas 16 Edge Functions activas; 4 estão com `verify_jwt=false`. Isto não significa automaticamente que sejam abertas: a validação interna deve ser avaliada.

| Função | Autorização observada no código | Avaliação |
|---|---|---|
| `ciadi-indexacao-auto` | token cron validado por RPC, service-role bearer ou sessão válida de admin/gestor | Tem validação interna; rever gestão/rotação do segredo e logs |
| `ciadi-recrutamento-consulta` | código de candidatura, sem JWT; usa service role | Risco de enumeração; código de 32 bits e sem rate limit observado |
| `ciadi-marketing-webhook` | assinatura Svix/Resend verificada com segredo | Padrão esperado para webhook; manter validação de assinatura e idempotência |
| `ciadi-calendario-email` | cabeçalho `x-ciadi-cron-secret` e RPC de validação; usa service role | Tem autenticação interna; tabela de hashes de token sem grants anon/auth e sem políticas RLS, compatível com uso exclusivo de serviço |

As funções `ciadi-aba-submit`, `ciadi-aba-notify`, `ciadi-ai-assistente`, `ciadi-janeth-inteligente`, `ciadi-video-token`, `ciadi-indexar-conhecimentos`, `ciadi-recrutamento-candidatura`, `ciadi-marketing-enviar`, `ciadi-saft-gerar` e `ciadi-documento-pdf` aparecem com `verify_jwt=true` na listagem consultada.

## 8. RPCs SECURITY DEFINER e Security Advisors

- Total de funções `SECURITY DEFINER` em `public`: **92**.
- Security Advisor reporta **79** executáveis por `authenticated` e **4** executáveis por `anon`.
- As 4 entradas anónimas são:
  1. `ciadi_registrar_acesso_validacao(text)`: consulta código de validação e actualiza contador de acessos.
  2. `ciadi_registrar_triagem_publica(...)`: cria triagem pública após validar campos obrigatórios e consentimento booleano.
  3. `ciadi_registrar_validacao_documento(text)`: valida documento e devolve metadados do documento/profissional.
  4. `finance_bloquear_alteracao_fiscal()`: função `RETURNS trigger`; o aviso do Advisor não prova que possa ser invocada como RPC normal, por ser função de trigger.
- As funções públicas acima têm `search_path=public`; os papéis `anon` e `authenticated` não têm privilégio CREATE no schema `public`, reduzindo o risco de substituição de objectos por utilizadores comuns.
- Dois objectos têm RLS activo e nenhuma política: `ciadi_automation_token_hashes` e `ciadi_email_notificacoes_fila`. A consulta de privilégios não encontrou SELECT/INSERT/UPDATE/DELETE para `anon` ou `authenticated`; parecem destinados a acesso de serviço. Não criar políticas abertas para resolver os avisos.
- A protecção de palavras-passe comprometidas do Supabase Auth está desactivada (Advisor WARN).

### Funções analisadas em detalhe
- `ciadi_criar_alerta_sos`: exige sessão e perfil activo, mas não verifica no corpo da função se o utilizador tem vínculo ao `p_paciente_id` recebido. Definir se o SOS pode ser aberto por qualquer perfil para qualquer assistido ou se precisa de vínculo/escopo.
- `ciadi_criar_ficha_comportamento`: exige `is_staff()`, mas não valida atribuição do A.T. ao paciente indicado. Deve validar paciente atribuído, profissional e agendamento.
- `ciadi_emitir_documento_clinico`: valida admin/gestor ou profissional responsável pelo documento; a regra é mais específica do que `is_staff()`.
- `ciadi_faturacao_emitir_documento`: exige apenas `is_staff()`; A.T. activo satisfaz essa função. Deve passar a autorização financeira específica, com empresa/série e acção de emissão.
- `ciadi_banco_importar_extrato` e `ciadi_banco_reconciliar_movimento`: usam `ciadi_finance_can('reconciliar')`; o controlo de operador existe, mas não foi demonstrado escopo por polo/empresa/conta. Na reconciliação, rever também correspondência entre empresa/conta do movimento e lançamento seleccionado.
- `ciadi_abrir_caixa`: verifica `ciadi_finance_can('abrir')` e função do operador.
- `ciadi_aprovar_fecho_caixa`: exige admin/gestor financeiro, mas o código inspeccionado não exige aprovador diferente do operador que fechou o turno; implementar segregação maker-checker.
- `finance_postar_documento` e `finance_fechar_periodo`: exigem `ciadi_finance_is_staff()`, que é mais restrita a admin/gestor do que `is_staff()`.

## 9. Triagem pública e validação documental

- `ciadi_registrar_triagem_publica` exige nome da criança, data de nascimento, responsável, telefone, email, consentimento booleano verdadeiro e modalidade/período válidos; guarda também diagnóstico, comportamentos e reforçadores. Não foram identificados limites de comprimento/volume nem mecanismo de rate limit no corpo da função. O consentimento booleano não prova, por si só, qual versão do aviso foi apresentada ou aceite.
- `ciadi_gerar_codigo_validacao()` gera 12 caracteres hexadecimais (48 bits) para validação documental. A função pública de validação devolve número/título/tipo/data do documento, assinatura e nome/registo profissional, hashes e QR payload. É compatível com uma página pública de validação, mas requer limitação de tentativas, monitorização e minimização dos metadados devolvidos.

## 10. Plano de correcção — ainda sem execução

Prioridade P0:
1. Corrigir a visibilidade de `ciadi_conhecimentos` para não expor conteúdo `interno` ou `familias` a `anon`.
2. Corrigir o INSERT público de recrutamento: colunas públicas mínimas, estado e código gerados exclusivamente no servidor, endpoint de consulta com rate limit e código forte.
3. Retirar o A.T. do predicado genérico de escrita do bucket `ciadi-app-updates`; restringir publicação de pacotes a processo de release controlado e artefactos assinados.
4. Separar acesso a `documentos` por tipo/pasta/paciente/funcionário; não usar `is_staff()` como autorização genérica.

Prioridade P1:
5. Substituir `is_staff()` em faturação e funções clínicas por verificações de acção e atribuição adequadas.
6. Aplicar escopo por empresa/polo nas funções bancárias e segregação entre operador e aprovador do fecho de caixa.
7. Definir a regra de quem pode abrir SOS para outro assistido e registar a atribuição/origem.
8. Adicionar rate limit, validação de entrada e evidência de consentimento à triagem pública.

Prioridade P2:
9. Rever os 79 RPCs `SECURITY DEFINER` autenticados um a um; não revogar EXECUTE em massa.
10. Rever grants anon nas 17 views com `security_invoker=true`; manter apenas os estritamente necessários.
11. Activar protecção de palavras-passe comprometidas após avaliação de impacto operacional.
12. Criar testes de segurança por perfil, paciente, polo, empresa, turno, bucket, código de candidatura e token cron.

## 11. Restrições e conclusão

- Não foram executadas operações de escrita no Supabase.
- Não foram alterados grants, políticas RLS, funções, Edge Functions, buckets, utilizadores ou dados.
- Não foram criadas migrações nem branches Supabase pagas.
- O PermissionService continua sem ligação ao Dashboard/provedor Supabase.
- Não existe ainda homologação end-to-end nem autorização para integrar em produção.

**Conclusão:** o trabalho deve continuar em branch isolada e ambiente de testes. Os achados P0 impedem declarar o CIADI seguro para publicação até serem corrigidos, testados com identidades fictícias e aprovados. O backup existente ainda não tem restauro demonstrado.


## 12. Testes de visibilidade com papel SQL `anon` (read-only)
Foram executadas consultas dentro de transacções `BEGIN READ ONLY`, com `SET LOCAL ROLE anon` e `ROLLBACK`:
- `ciadi_conhecimentos`: o papel `anon` conseguiu contar os registos activos por classificação e viu **9 `familias` + 1 `interno` + 2 `todos`**, além de 363 `publico`. Isto confirma a exposição anónima das classificações não públicas pela política actual.
- `storage.objects` no bucket privado `documentos`: **0 linhas visíveis** para `anon`.
- `finance_contas_bancarias`: **0 linhas visíveis** para `anon`.
- `finance_documentos`, `finance_pagamentos` e `finance_despesas`: **0 linhas visíveis** para `anon`.
- `v_ciadi_balancete`: **0 linhas visíveis** para `anon`.
- `v_ciadi_financeiro_resumo`: a view devolve uma linha agregada por construção; as tabelas financeiras base acima devolvem zero linhas a `anon`, pelo que não foi demonstrada exposição de montantes reais nesta consulta. A view continua com GRANT SELECT anónimo desnecessário e deve ser restringida se não houver consumidor público legítimo.
- `recrutamento_candidaturas`: a consulta directa de leitura por `anon` falhou com `permission denied`; o endpoint público de consulta é a Edge Function separada.
- `agendamentos`: consulta directa por `anon` falhou por falta de GRANT SELECT.

Estes testes não alteraram dados nem políticas. Confirmam que os GRANTs SQL, isoladamente, não significam leitura efectiva quando RLS ou privilégios adicionais bloqueiam o acesso. A excepção concreta nesta amostra é `ciadi_conhecimentos`, onde a política SELECT permite as classificações não públicas.
