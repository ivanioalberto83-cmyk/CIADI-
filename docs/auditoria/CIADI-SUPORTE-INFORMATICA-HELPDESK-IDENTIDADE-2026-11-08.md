# CIADI — Auditoria técnica do Suporte Informático
**Data da auditoria:** 2026-11-08  
**Âmbito:** Helpdesk integral, identidade institucional central e motor documental para Suporte Informático/Aprovisionamento.  
**Restrição:** auditoria de leitura; sem alterações à produção, dados, políticas, funções ou outras estações.

## 1. Repositório GitHub

- Repositório: `ivanioalberto83-cmyk/CIADI-`
- Branch auditada: `feature/ciadi-compras-contabilidade-integrada`
- HEAD observado: `662383d1d61e9df17a9f895554415fac72a15493`
- `main` observado: `8530ceb4bc56f3905962ef7a8b3f1ad083e750b0`
- Comparação: branch divergente, 84 commits à frente e 2 atrás de `main`.
- A branch de implementação `feature/ciadi-suporte-helpdesk-identidade` foi criada a partir da branch de trabalho auditada; nenhuma branch existente foi alterada.
- A aplicação principal está concentrada em `index.html` (cerca de 277 KB / 1.172 linhas), com cópia de fonte `CIADI_DASHBOARD_FINANCEIRO.html`.
- O menu contém Aprovisionamento/Compras, mas não contém uma estação/área Helpdesk ou Suporte Informático dedicada. A pesquisa do código não encontrou fluxo de tickets, atribuição de técnico, SLA, comentários ou encerramento de incidentes de TI.
- Existe um módulo de inventário e aprovisionamento no backend, mas a integração de interface ainda não está demonstrada.

## 2. Estado real do Supabase

Projeto observado: `egpkkttbcaukqnnxyhjv`, região `eu-west-1`, estado `ACTIVE_HEALTHY`, PostgreSQL 17.6.

### 2.1 Inventário de TI já existente

O histórico remoto de migrações contém três entradas aplicadas em 2026-11-06:
- `20261106124438 ciadi_ti_inventory_core`
- `20261106124530 ciadi_ti_inventory_workflows`
- `20261106124604 ciadi_ti_inventory_updated_at`

O schema privado `ciadi_ti` contém 11 tabelas:
- `assets`
- `audit_events`
- `inventory_count_lines`
- `inventory_counts`
- `item_categories`
- `items`
- `purchase_request_lines`
- `purchase_requests`
- `stock_movements`
- `suppliers`
- `warehouses`

As 11 tabelas estão com RLS activo e, na leitura efectuada, sem registos. Existem políticas de leitura/escrita que usam `ciadi_ti.has_support_access()`; esta função verifica perfil activo do tipo `admin`, `gestor` ou `suporte_informatica`. O tipo `suporte_informatica` está actualmente previsto na constraint de `public.perfis.tipo`.

Não foram encontradas tabelas de tickets/helpdesk, interacções/comentários, SLA, anexos de tickets ou catálogo de categorias de incidentes no schema `ciadi_ti`.

### 2.2 Divergência de migrações

As três migrações de inventário acima constam do histórico remoto do Supabase, mas não aparecem na pasta `supabase/migrations` da branch auditada no GitHub. Isto é uma divergência de controlo de versões que deve ser reconciliada antes de acrescentar novas migrações. Não se deve recriar nem reaplicar cegamente as tabelas existentes.

A autorização de utilização do schema `ciadi_ti` por `authenticated` foi observada; a inclusão do schema na lista de schemas expostos pela Data API ainda precisa de confirmação na configuração da API do projecto.

## 3. Identidade institucional e documentos

### 3.1 O que já existe
- `public.instituicao` contém `logo_url`, `favicon_url`, `cor_primaria`, `cor_secundaria` e `cor_acento`, além dos contactos e morada.
- `public.ciadi_modelos_documentos` e `public.ciadi_campos_modelos_documentos` fornecem modelos e campos configuráveis.
- `public.documentos_clinicos` já tem número, versão, hash, assinatura, código de validação, `qr_payload`, bucket e caminho de armazenamento.
- `public.ciadi_documentos_validacao` e `public.ciadi_documentos_clinicos_historico` suportam validação e histórico.
- A Edge Function `ciadi-documento-pdf` está activa, versão 4, com JWT obrigatório; gera PDF com pdf-lib e QR Code, guarda no bucket privado `documentos` e devolve URL assinada temporária.

### 3.2 Lacunas observadas
- O motor PDF remoto está limitado ao fluxo de `documentos_clinicos`; não é ainda um gerador documental transversal do Suporte Informático/Aprovisionamento.
- A função PDF utiliza um URL de logótipo externo fixo, em vez de ler a identidade institucional configurada.
- O código de impressão do dashboard também contém logótipo incorporado em Base64, contactos, cabeçalho e rodapé fixos.
- A edição da instituição permite alterar `logo_url`, mas a impressão consultada não usa essa configuração de forma central.
- O QR Code é efectivamente gerado na Edge Function clínica quando existe `qr_payload` ou código de validação; não está comprovada a sua aplicação a documentos de TI.
- O motor financeiro tem um layout A4 próprio, separado dos documentos clínicos e sem um sistema transversal de identidade/modelos.

Conclusão: há componentes reutilizáveis, mas a identidade central ainda não governa todos os documentos. A solução deve manter snapshots/versionamento da identidade para preservar documentos já emitidos.

## 4. Segurança e armazenamento observados

- O bucket `documentos` é privado e aceita PDF/PNG/JPEG, com limite de 10 MB.
- As tabelas do schema `ciadi_ti` têm RLS activo; o acesso é condicionado por políticas de suporte.
- Os resultados do Security Advisor incluem alertas existentes sobre funções SECURITY DEFINER executáveis por `anon` e protecção contra palavras-passe comprometidas desactivada. São achados preexistentes; esta auditoria não os alterou.
- Antes de disponibilizar a interface, deve confirmar-se a exposição do schema `ciadi_ti` à Data API e testar a autorização efectiva com contas de teste de suporte e de utilizador comum.

## 5. Diagnóstico

| Frente | Estado observado | Acção necessária |
|---|---|---|
| Inventário/equipamentos | Backend existente, 11 tabelas, sem registos | Reconciliar migrações e ligar interface |
| Aprovisionamento TI | Pedidos, fornecedores, linhas e stock existentes | Completar ciclo de aprovação/recepção e documentos |
| Helpdesk | Não encontrado | Criar motor de tickets, comentários, SLA, atribuição e histórico |
| Identidade CIADI | Campos existentes em `instituicao` | Tornar a identidade configurável e fonte única |
| Modelos documentais | Motor clínico existente | Generalizar para TI/Aprovisionamento sem misturar dados clínicos |
| PDF/QR | Edge Function clínica existente | Criar emissão transversal e validação segura de documentos TI |
| Auditoria | Eventos de inventário existentes | Ligar tickets, documentos e intervenções ao trilho de auditoria |
| Integração GitHub/Supabase | Migrações remotas não espelhadas no repositório | Recuperar/reconciliar as três migrações de TI antes de novas |

## 6. Plano de implementação na branch isolada

1. Reconciliar as três migrações remotas de inventário com o repositório; não executar novamente em produção.
2. Confirmar a exposição do schema `ciadi_ti` na Data API e validar a função de autorização com perfis de teste.
3. Desenhar e versionar as tabelas do Helpdesk: tickets, comentários/interacções, categorias, prioridades, atribuições, SLA, anexos e histórico de estado.
4. Criar o painel Helpdesk com abertura, triagem, atribuição, diagnóstico, intervenção, resolução, validação e encerramento.
5. Implementar o Gestor Central de Identidade: logótipo, cores, dados institucionais, cabeçalho, rodapé, assinaturas e versões.
6. Criar o motor documental transversal para ordens de trabalho, pedidos, guias, entradas/saídas, avarias, inventário e relatórios.
7. Integrar PDF, QR Code, hash, verificação pública com dados mínimos e arquivo privado.
8. Ligar gráficos e indicadores de auditoria ao Helpdesk e inventário.
9. Executar testes estáticos, SQL em ambiente não produtivo e testes funcionais por perfil. Só considerar produção após homologação e autorização específica.

## 7. Limites desta auditoria

Esta auditoria não executou DDL/DML, não alterou RLS, não publicou Edge Functions, não alterou contas, não modificou o dashboard de produção e não distribuiu instaladores. A branch isolada foi criada apenas para conter o trabalho futuro.
