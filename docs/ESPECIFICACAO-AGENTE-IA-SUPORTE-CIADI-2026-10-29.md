# CIADI — Especificação técnica do Centro de Suporte Informático e Agente de IA

Data: 29/10/2026  
Branch: `audit/divisao-acessos-ciadi-2026-10-29`  
Estado: protótipo de interface e esquema preparados; integração de IA e execução real **não homologadas**.

## 1. Objetivo

Dar ao técnico autorizado um local único para registar falhas, preparar uma proposta de diagnóstico, rever riscos e obter aprovação explícita antes de qualquer ação técnica.

## 2. Autorização

- A identidade vem da sessão Supabase e de `public.perfis`; o perfil deve estar ativo e ser exatamente `suporte_informatica`.
- O Dashboard verifica o acesso no menu e no dispatcher de rotas. A lista de rotas protegidas inclui `centro_suporte` e `agente_ia_suporte`.
- Admin mantém acesso global aos módulos administrativos existentes, mas a guarda específica impede abrir estas duas rotas.
- A migração proposta aplica RLS específica nas três tabelas de suporte e não altera `is_staff()` nem `ciadi_finance_staff()`.
- A seleção de perfil no Setup Windows continua apenas a identificar a estação; não atribui permissões.

## 3. Fluxo de pedido e proposta

1. Técnico autenticado regista assunto, descrição e impacto.
2. O pedido é guardado em `ciadi_support_requests`.
3. O técnico prepara uma proposta manual com resumo/diagnóstico, âmbito exato, riscos e passos de verificação. A integração de IA está assinalada como não configurada, sem simular uma resposta de IA.
4. A proposta é serializada como JSON e recebe um hash SHA-256 no cliente. O registo inclui versão crescente por pedido.
5. A proposta aguarda decisão explícita. A aprovação ou rejeição é guardada em `ciadi_support_approvals`, associada ao pedido, ID da proposta, versão, hash e utilizador autenticado.
6. O trigger impede modificar conteúdo, versão, autoria ou hash depois de criada a proposta; para corrigir conteúdo, deve ser criada nova versão.
7. A ação “Executar” devolve `blocked` porque `SUPPORT_EXECUTOR_CONFIGURED` está fixado em `false`. Nenhum comando, SQL, migração, alteração de conta, deploy ou escrita em módulos de negócio é executado.

## 4. Contrato de execução futura

A futura execução deve existir exclusivamente no servidor, não no browser. Antes de qualquer execução, o serviço deverá confirmar novamente:
- sessão autenticada válida e perfil ativo `suporte_informatica`;
- pedido e proposta existentes;
- aprovação com decisão `approved`, identidade do aprovador, versão e hash iguais à proposta atual;
- tipo de ação incluído num catálogo autorizado;
- âmbito e alvo limitados à ação aprovada;
- proposta inalterada e aprovação ainda válida;
- registo de auditoria sem credenciais ou dados sensíveis desnecessários.

O serviço deve recusar se qualquer verificação falhar, se a aprovação for antiga ou se a ação proposta tiver mudado. O hash calculado no cliente serve para vincular o registo nesta fase, mas não é prova suficiente por si só: o futuro executor tem de recalcular/verificar o conteúdo no servidor.

## 5. Limite de integração

A inspeção do repositório não identificou um serviço de IA ou executor de ações de servidor que possa ser reutilizado com segurança. Por isso:
- não foi escolhida uma API de IA por suposição;
- não foi adicionado segredo/API key ao HTML;
- não foi criado endpoint que execute comandos;
- o modo manual permanece disponível apenas quando a tabela de suporte e a RLS estiverem instaladas num ambiente de teste;
- as operações de gravação falharão enquanto a migração não estiver aplicada, o que é esperado na branch isolada.

## 6. Testes de homologação necessários

1. **Permissões:** permitir técnico ativo; negar Admin, Receção, RH, Operador, profissional, paciente, responsável e sessão anónima.
2. **Navegação:** negar abertura direta das duas rotas para todos os perfis exceto Suporte Informático.
3. **Pedidos:** criar pedido válido, falhar sem assunto/descrição e apresentar erro de integração sem afirmar sucesso.
4. **Propostas:** criar versões sucessivas, rejeitar hash divergente, impedir alteração do conteúdo da versão e não aprovar proposta já decidida.
5. **RLS:** testar SELECT/INSERT/UPDATE como Suporte Informático e negar como outros perfis; confirmar ausência de DELETE para o cliente.
6. **Executor:** confirmar que a ação continua bloqueada quando não há serviço verificado, mesmo após uma aprovação.
7. **Dados:** confirmar que auditoria não inclui palavras-passe, tokens, dados clínicos não necessários ou dados bancários/salariais.
8. **Produção:** não aplicar migração nem políticas RLS sem backup restaurável confirmado, backup independente do Storage e autorização de mudança.

## 7. Decisões ainda necessárias

- Catálogo exato de ações que o agente pode propor para execução.
- Serviço de servidor autorizado para IA e execução; não existe um serviço verificado neste levantamento.
- Se a mesma pessoa pode abrir e aprovar o pedido ou se ações de risco elevado exigem segundo técnico.
- Retenção dos pedidos, propostas, aprovações e registos de execução.
