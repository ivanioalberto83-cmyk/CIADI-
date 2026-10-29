# CIADI — Especificação técnica do Centro de Suporte Informático e Agente de IA

Data: 29/10/2026  
Branch: `audit/divisao-acessos-ciadi-2026-10-29`  
Estado: executor de teste de leitura implementado na branch; base isolada ainda não configurada; IA e execução de ações reais **não homologadas**.

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
4. A criação da proposta usa a função RPC `ciadi_create_support_proposal`, que valida o técnico ativo e o estado do pedido, calcula a próxima versão sob bloqueio do pedido e grava proposta/estado numa única transação. O hash SHA-256 autoritativo é agora calculado no servidor a partir da representação `jsonb` persistida; o valor calculado no browser não é tratado como fonte de confiança.
5. A proposta aguarda decisão explícita. A aprovação ou rejeição é enviada à função RPC `ciadi_decide_support_proposal`, que valida no servidor o técnico ativo, o pedido, a proposta, a versão, o hash e os estados pendentes, e regista a decisão e os estados numa única transação. O mesmo técnico pode aprovar o seu próprio pedido, conforme decisão expressa do responsável do projeto.
6. O trigger impede modificar conteúdo, versão, autoria ou hash depois de criada a proposta; para corrigir conteúdo, deve ser criada nova versão. As permissões diretas de UPDATE dos pedidos/propostas e INSERT das decisões são revogadas para `authenticated`; o cliente não altera estes estados diretamente.
7. O executor de teste tem uma única ação permitida: `readonly_validate_proposal`. Confirma aprovação exata, versão, hash recalculado no servidor e perfil ativo; valida os campos obrigatórios e regista o resultado em `ciadi_support_executions`. É idempotente por proposta e não executa comandos, SQL arbitrário, migrações, alterações de conta, deploy ou escritas em módulos de negócio. A flag `SUPPORT_EXECUTOR_TEST_MODE` permanece `false` até existir uma base de homologação isolada.

## 4. Executor de teste implementado e limites

A RPC `ciadi_execute_approved_support_action` executa apenas a validação de leitura descrita acima. Antes de ativar o modo de teste, deve confirmar-se numa base isolada:
- sessão autenticada válida e perfil ativo `suporte_informatica`;
- pedido e proposta existentes;
- aprovação com decisão `approved`, identidade do aprovador, versão e hash iguais à proposta atual;
- tipo de ação igual a `readonly_validate_proposal`, único valor permitido no executor atual;
- âmbito e alvo limitados à ação aprovada;
- proposta inalterada e aprovação ainda válida;
- registo de auditoria sem credenciais ou dados sensíveis desnecessários.

A RPC recusa se qualquer verificação falhar, se a aprovação for antiga ou se o conteúdo não corresponder ao hash do servidor. Repetir a mesma validação devolve o resultado registado, sem criar uma segunda execução.

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
6. **Executor:** confirmar que o modo de teste permanece desativado na interface até à configuração da base isolada; numa base isolada, testar aprovação válida, versão/hash divergente, ação não permitida, utilizador não autorizado e repetição idempotente. Confirmar que nenhum dado de negócio é alterado.
7. **Dados:** confirmar que auditoria não inclui palavras-passe, tokens, dados clínicos não necessários ou dados bancários/salariais.
8. **Produção:** não aplicar migração nem políticas RLS sem backup restaurável confirmado, backup independente do Storage e autorização de mudança.

## 7. Decisões ainda necessárias

- Catálogo exato de ações que o agente pode propor para execução.
- Serviço de IA continua por escolher/configurar. O executor de teste é uma RPC da migração branch-only; não está instalado na base partilhada/produção e não deve ser ativado antes da homologação isolada.
- A política aprovada permite que o mesmo técnico abra e aprove o seu próprio pedido; ações de risco elevado continuam dependentes do catálogo de ações e das futuras salvaguardas do executor.
- Retenção dos pedidos, propostas, aprovações e registos de execução.
