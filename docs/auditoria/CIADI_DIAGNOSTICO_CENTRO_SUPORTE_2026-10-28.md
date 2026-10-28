# CIADI — Diagnóstico inicial do Centro de Suporte Informático
**Data:** 28-10-2026  
**Projeto Supabase:** `egpkkttbcaukqnnxyhjv`  
**Branch:** `agent/ciadi-dashboard-20261028`  
**Modo de auditoria:** consulta read-only; sem alterações ao esquema, dados ou RLS.

## 1. Resultado desta etapa
Foi acrescentado ao Dashboard um painel inicial **Centro de Suporte Informático**, com indicadores obtidos por consultas de contagem às tabelas existentes e uma lista limitada da auditoria recente. O painel é informativo e não executa reparações. Deve ser validado no ambiente autenticado depois da integração da branch.

## 2. Fontes existentes confirmadas
A consulta read-only confirmou a existência destas fontes:
- `auditoria`: histórico de ações, tabela, utilizador, detalhes e data.
- `ciadi_sos_alertas`: alertas SOS e estados.
- `ciadi_email_notificacoes_fila`: estado, tentativas e erros da fila de email.
- `ciadi_documentos_institucionais`: metadados da biblioteca institucional.
- `finance_clientes`: clientes de faturação.
- `ciadi_funcionarios`: registos RH.
- `agendamentos`, `pacientes`, `profissionais`: fontes operacionais clínicas.

O painel mostra contagens para estas fontes, mas não apresenta nomes, contactos, conteúdo clínico, detalhes de erros nem payloads sensíveis. Se uma consulta for recusada, mostra “Sem confirmação de acesso”, não zero.

## 3. Bloqueios de segurança confirmados
- O constraint de `public.perfis.tipo` aceita apenas `admin`, `gestor`, `profissional`, `paciente`, `responsavel` e `operador`; não aceita ainda `suporte_informatica`, `rh` ou `rececao`.
- O inventário read-only identificou tabelas com RLS ativada e sem políticas: `ciadi_automation_token_hashes` e `ciadi_email_notificacoes_fila`. Não se deve adicionar políticas sem conhecer os consumidores e os fluxos de serviço.
- O Security Advisor reporta funções `SECURITY DEFINER` executáveis por papéis autenticados e, em alguns casos, anónimos. Cada função deve ser revista individualmente, porque algumas podem ser endpoints intencionais; não revogar permissões em lote.
- O acesso de leitura do painel depende das permissões reais do utilizador. O painel não contorna RLS e não é uma prova de que os dados completos estão acessíveis.

## 4. O que o painel já faz
- Consulta contagens de nove tabelas existentes usando `SELECT COUNT` sem carregar linhas completas.
- Consulta até oito eventos recentes da tabela `auditoria`, mostrando apenas ação, tabela e data.
- Mostra a quantidade de fontes consultadas com sucesso, a hora local da consulta e permite imprimir/guardar o relatório em PDF pelo navegador.
- Não altera dados, não grava resultados de auditoria novos, não testa gravações, não executa SQL de reparação e não chama o agente de IA.

## 5. O que ainda não faz
- Monitorização externa de disponibilidade/latência ou verificações programadas.
- Captura centralizada de logs de aplicação, navegador, Windows e Android.
- Testes de qualidade relacional (duplicados, referências órfãs, campos obrigatórios) com regras de negócio aprovadas.
- Relatórios de SLA, MTTR, recorrência e tendências históricas.
- Testes de backup/restauro.
- Executor autenticado e isolado para o agente de IA.
- Alertas automáticos com atribuição, prazos e fecho por evidência.
- Exportação de relatórios históricos com fonte, período, versão e assinatura de auditoria.

## 6. Próximas tarefas prioritárias
1. Executar testes de sintaxe/integração do workflow para os dois HTML e confirmar que permanecem byte-a-byte idênticos.
2. Rever a matriz de acesso e preparar uma migration proposta para os perfis, sem aplicar à produção.
3. Rever uma a uma as políticas RLS e funções privilegiadas; testar permissões positivas e negativas com contas fictícias.
4. Criar testes de qualidade de dados read-only para clientes/faturas, agenda, RH e documentos, sem expor dados pessoais.
5. Definir fontes de monitorização, retenção de logs, limiares de alertas e responsáveis.
6. Ligar o agente apenas depois de existir executor autenticado, permissões mínimas, logs de ações e aprovação para operações sensíveis.
7. Testar restauração de backups num ambiente isolado antes de declarar recuperação validada.

## 7. Critério de aceitação
O Centro de Suporte só será considerado homologado quando os indicadores forem comparados com consultas controladas, as permissões forem testadas por perfil, os dois HTML estiverem sincronizados, os testes forem aprovados e a revisão de segurança não apresentar bloqueios críticos sem plano aceite.

**Estado atual:** primeira interface implementada na branch de homologação; testes de ponta a ponta, permissões de perfis novos, monitorização programada, backups/restauro e executor do agente continuam pendentes. Não é homologação final nem publicação em produção.


## 8. Auditoria ampliada — consulta read-only de 28-10-2026

### Resultado geral
**Estado: NÃO HOMOLOGADO.** A auditoria foi read-only. Não foram executados INSERT, UPDATE, DELETE, DDL, migrations, alterações RLS, publicação ou build do instalador.

### Segurança e permissões — prioridade alta
- Inventário: 134 tabelas em `public`; RLS activa em todas as tabelas públicas identificadas pela consulta.
- O Security Advisor reportou 4 funções `SECURITY DEFINER` executáveis por `anon` e 79 executáveis por `authenticated`. Requer revisão função a função, especialmente endpoints públicos e funções que acedem a dados clínicos/fiscais. Não revogar em lote sem verificar consumidores e autorização interna.
- A função pública `ciadi_registrar_triagem_publica` aceita nome e data de nascimento da criança, dados do responsável, telefone/email e diagnóstico/comportamentos. Antes de homologar o formulário público, testar rate limiting, anti-abuso, minimização de dados, consentimento/registo de consentimento e acesso restrito aos registos.
- `ciadi_registrar_validacao_documento` devolve metadados do documento e profissional a quem conhece o código. Confirmar entropia/expiração do código, campos mínimos expostos e política de privacidade.
- A protecção de palavras-passe comprometidas (Leaked Password Protection) está desactivada segundo o Auth Advisor.
- O Advisor assinala 2 tabelas com RLS activa e sem políticas: `ciadi_automation_token_hashes` e `ciadi_email_notificacoes_fila`. O bloqueio por defeito é preferível a acesso excessivo; confirmar se o backend de serviço é o único consumidor pretendido.
- O Advisor identifica 65 casos de políticas permissivas sobrepostas. Rever as políticas por tabela/ação, porque políticas permissivas acumulam permissões; não as remover automaticamente.

### Bloqueios funcionais confirmados
- **Perfis:** `perfis.tipo` não permite `suporte_informatica`, `rh` nem `rececao`. Os registos existentes são 2 admin, 1 operador, 2 profissionais, 2 pacientes e 2 responsáveis. Não existem contas dos três novos perfis no inventário consultado.
- **Regra do Suporte Informático:** o código do Dashboard inclui `suporte_informatica` em `isGlobalAdmin()`, o que faz aparecer menus globais. Isto contraria o requisito de não transformar Suporte em administrador global. A função é apenas controlo de interface, não uma fronteira de segurança do backend.
- **Agente de suporte:** o código exige `window.ciadiDesktop.installProfile === 'suporte_informatica'`, mas `preload.cjs` só expõe `appName`. Assim, a condição do agente nunca é satisfeita pela implementação actual; o agente fica inacessível mesmo que o perfil seja criado.
- **Fornecedores:** o Dashboard consulta `public.finance_fornecedores`, mas essa tabela não existe no esquema consultado. A área de fornecedores falhará ao carregar até o código ser alinhado com uma fonte existente ou ser proposta uma estrutura aprovada.
- **Clientes/faturação:** `finance_clientes` tem 0 registos e `finance_documentos` tem 0; não há dados de teste existentes para comprovar o ciclo de cadastro → factura → PDF/recibo. Criar dados fictícios só em ambiente de teste autorizado.
- **Marketing:** 2 campanhas existentes, 0 envios e 0 eventos na consulta; as três tabelas não estão na publicação `supabase_realtime`. A UI de tempo real não pode ser considerada funcional sem configurar e testar a publicação, RLS e eventos.
- **Dados operacionais:** `ciadi_funcionarios` tem 1 registo; `ciadi_sos_alertas` e `ciadi_cadastros_utilizadores` têm 0 registos na consulta. Estes números não provam falha funcional, mas limitam os testes reais disponíveis.

### Windows Setup.exe — situação da auditoria
- O workflow Windows usa `CIADI_DASHBOARD_FINANCEIRO.html` como fonte e copia-o para `ciadi-windows/index.html`; a raiz tem os dois HTML sincronizados na branch auditada.
- A validação automática do Dashboard passou: igualdade dos HTML, sintaxe JavaScript inline e verificações de pontos de integração/chaves públicas. Estes testes não validam os fluxos funcionais nem a segurança completa.
- `ciadi-windows/package.json` não tem lockfile `package-lock.json` na pasta do pacote; o workflow executa `npm install`. Isto torna as dependências menos reproduzíveis e deve ser corrigido antes de release.
- A lista de GitHub Releases consultada estava vazia; não há evidência nesta auditoria de uma release publicada actual. Não foi compilado nem testado um Setup.exe nesta etapa.
- O repositório público contém `app-debug.apk` e `ciadi+ (1).zip`. Confirmar que são artefactos que podem ser públicos e fazer varredura de segredos/metadados antes de manter estes ficheiros publicamente acessíveis.
- A verificação de actualização automática, assinatura do instalador, instalação limpa, actualização sobre versão anterior, persistência local e desinstalação/retensão de dados continuam pendentes de teste em Windows.

### Desempenho — avisos, não alterações autorizadas
- 140 chaves estrangeiras sem índice de cobertura.
- 18 conjuntos de índices duplicados.
- 198 índices marcados como não utilizados.
- 51 políticas com padrão de inicialização de funções de autenticação potencialmente ineficiente.
- Não remover nem adicionar índices em massa; medir consultas e preparar migração revista.

### Plano de correcção priorizado
1. Rever a autorização de funções `SECURITY DEFINER`, começando pelas quatro executáveis por `anon`; testar abuso e limitar exposição.
2. Corrigir o modelo de permissões: Suporte Informático sem privilégios globais; resolver o perfil no backend e preparar associação a polos sem alargar RLS.
3. Corrigir o módulo Fornecedores (fonte/tabela ausente) e testar clientes/facturação com dados fictícios num ambiente de teste.
4. Confirmar publicação Realtime e RLS para campanhas/envios/eventos, depois testar com evento de teste.
5. Activar protecção de palavras-passe comprometidas após avaliação/configuração de Auth.
6. Criar lockfile, executar build Windows em branch e testar o Setup.exe num Windows limpo antes de release.
7. Auditar os ficheiros APK/ZIP públicos e o site CIADI para conteúdo/links externos suspeitos.
8. Só depois preparar migrations propostas, revisão independente e autorização explícita para produção.

