# CIADI — Matriz de permissões e auditoria de homologação
**Data:** 28-10-2026  
**Branch de trabalho:** `agent/ciadi-dashboard-20261028`  
**Base da PR:** `main` (PR mantida em Draft)  
**Supabase auditado em modo read-only:** projeto CIADI `egpkkttbcaukqnnxyhjv`

## 1. Princípios que não mudam
- Actualizar o Dashboard web existente; não reconstruir a aplicação.
- Preservar o Setup Windows e a separação dos polos já existente.
- ADM e Suporte Informático têm acesso global aos polos e módulos. O ADM não escolhe um polo como limite do seu próprio acesso.
- O agente técnico só pode ser utilizado por Suporte Informático. O agente ainda não executa comandos: precisa de backend autenticado, autorização por função, registo de auditoria e aprovação explícita para alterações de produção.
- Não alterar produção, esquema, dados ou RLS durante esta fase de auditoria/proposta. Não fazer merge nem publicar.

## 2. Estrutura observada
- `public.perfis` tem actualmente os tipos `admin`, `gestor`, `profissional`, `paciente`, `responsavel` e `operador`. O constraint `perfis_tipo_check` rejeita `suporte_informatica`, `rh` e `rececao`.
- O Dashboard já contém os módulos de RH e uma página reservada para o agente. A navegação já filtra os perfis RH/Receção e a função `go(id)` verifica se o módulo aparece no menu antes de o abrir.
- As tabelas RH existentes incluem `ciadi_funcionarios`, `ciadi_funcionario_contratos`, `ciadi_funcionario_documentos`, `ciadi_funcionario_assiduidade`, `ciadi_funcionario_ferias_licencas`, `ciadi_funcionario_avaliacoes`, `ciadi_folhas_salariais` e `ciadi_folha_salarial_linhas`.
- A tabela `finance_clientes` existe. A tabela `finance_fornecedores` não foi encontrada no esquema auditado.
- As páginas de entrada `index.html` e `CIADI_DASHBOARD_FINANCEIRO.html` são mantidas sincronizadas.

## 3. Matriz pretendida
| Perfil | Acesso pretendido | Restrições principais |
|---|---|---|
| **ADM (`admin`)** | Todos os módulos, todos os polos, gestão de utilizadores, configurações, registos A.T., RH, faturação, caixa e contabilidade. | Não deve precisar de seleccionar um polo para obter acesso global. Acções fiscais e salariais devem continuar auditadas. |
| **Suporte Informático (`suporte_informatica`)** | Acesso técnico global aos módulos e polos; diagnóstico e manutenção autorizada. Único perfil autorizado a abrir/usar o agente. | Agente não deve ter execução directa em produção por omissão. Mudanças devem ser registadas, testadas em homologação e sujeitas a aprovação. |
| **RH (`rh`)** | Trabalhadores e registos laborais, contratos/adendas, documentos, férias/licenças, assiduidade, avaliação/formação, recrutamento e folha salarial/recibos. | Sem contabilidade, caixa, faturação, administração global, gestão de polos ou acesso clínico geral. Não regista nem activa administrativamente A.T. |
| **Receção (`rececao`)** | Agendamentos, triagem/encaminhamento operacional, pacientes/famílias no âmbito de receção, profissionais para agendamento, clientes de faturação, emissão operacional autorizada e movimentos de caixa conforme permissões atribuídas. | Sem folha salarial, processos laborais, contabilidade, SAF-T, configuração fiscal, gestão global, gestão de polos ou agente. Cadastro mestre de fornecedores só após definição do fluxo de aprovisionamento. |
| **Gestor (`gestor`)** | Preservar o comportamento legado existente enquanto se revê a matriz. | Não o converter silenciosamente em ADM; confirmar os limites funcionais antes da migração. |
| **Profissional clínico** | Módulos clínicos e assistidos atribuídos, conforme políticas existentes. | Sem RH, folha salarial, contabilidade ou agente. |
| **A.T.** | Apenas informação clínica/operacional necessária às atribuições autorizadas. | Registo administrativo, associação a polo e activação do profissional A.T. ficam sob ADM. RH trata apenas de vínculo laboral quando aplicável. |

## 4. Bloqueios de segurança confirmados no servidor
### 4.1 Tipos de perfil
O constraint actual de `public.perfis.tipo` impede criar os três novos perfis. Alterar apenas o frontend não resolve login, gravação nem autorização.

### 4.2 Função partilhada `is_staff()`
A função actual considera `admin`, `gestor` e profissionais activos marcados como A.T. como staff. As políticas de todas as tabelas RH usam actualmente `is_staff()`. Isso significa que o mesmo predicado que autoriza alguns fluxos clínicos de A.T. também autoriza tabelas laborais; a revisão deve separar a autorização RH da autorização clínica e remover esse acesso transversal não intencional.

### 4.3 Funções financeiras
`ciadi_finance_staff()` e `ciadi_finance_is_staff()` autorizam actualmente apenas `admin` e `gestor`. As políticas de clientes, documentos, linhas, séries, serviços, caixas, empresas e movimentos dependem destas funções ou de funções relacionadas. Logo, mostrar os menus de faturação/caixa à Receção não concede acesso real.

As funções `ciadi_faturacao_criar_documento` e `ciadi_faturacao_emitir_documento` são `SECURITY DEFINER` e verificam `is_staff()`. Não se deve acrescentar Receção à função genérica `is_staff()`: essa alteração poderia alargar o acesso a pacientes, dados clínicos e tabelas RH. É necessária uma autorização específica para operações de faturação, com validação dentro das funções RPC.

O formulário de clientes também consulta `finance_empresas` antes de abrir. Como esta tabela está limitada a staff financeiro, o fluxo de Receção precisa de um mecanismo seguro para escolher a empresa emitente permitida, sem expor configurações fiscais.

### 4.4 Caixa
As operações de caixa passam por `ciadi_finance_can()` e `finance_operadores`. A Receção só poderá abrir, receber, emitir recibos ou fechar caixa se tiver um registo de operador activo com permissões específicas e se as RPCs validarem essas permissões. Não conceder acesso global a tesouraria por meio de uma política ampla.

### 4.5 Fornecedores
`finance_fornecedores` não existe. Não há cadastro persistente de fornecedores até ser criada e revista uma migração com empresa/polo, auditoria, índices, restrições, RLS e integração com pedidos de compra.

### 4.6 Agente técnico
A página do agente declara expressamente que ainda não está ligada a um serviço de execução. Não activar execução de comandos no browser. A futura integração deve validar a identidade do utilizador no servidor, permitir apenas Suporte Informático, usar allowlist de operações, registar prompts/alterações e exigir aprovação para produção.


### 4.7 Avisos do Security Advisor
A consulta read-only ao Security Advisor em 28-10-2026 devolveu:
- 2 tabelas com RLS activo e sem políticas (`ciadi_automation_token_hashes` e `ciadi_email_notificacoes_fila`). Isto pode ser intencional; confirmar o fluxo servidor antes de alterar.
- 4 funções `SECURITY DEFINER` executáveis por `anon` e 79 executáveis por `authenticated` no relatório do advisor. O número não prova, por si só, que todas sejam vulneráveis; cada função exposta deve ser classificada como pública intencional ou restringida por privilégios/validação. Nenhuma permissão foi alterada nesta auditoria.

## 5. Plano de implementação seguro
1. **Frontend (branch de homologação):** manter filtros de menu, validação de navegação directa e nomenclatura inequívoca de IDs de cliente/paciente.
2. **Proposta de migração (a rever):** permitir os novos tipos de perfil, criar funções de autorização estreitas e rever as políticas RH, finanças, faturação, caixa e atribuições por polo. Não aplicar esta proposta à produção nesta fase.
3. **RPCs:** separar autorização de faturação da autorização clínica geral; verificar papel, empresa emitente, cliente activo, série/tipo de documento, permissões de caixa e autoria/auditoria dentro de cada operação.
4. **Fornecedores/aprovisionamento:** criar esquema e RLS só após definir campos obrigatórios, relação empresa/polo, estados e ciclo de aprovação.
5. **Homologação:** usar contas de teste dedicadas e dados fictícios. Testar SELECT/INSERT/UPDATE/DELETE conforme permitido, RPCs, navegação por URL, chamadas directas à API, isolamento entre perfis, geração PDF, numeração fiscal, caixa, RH e polos.
6. **Revisão de segurança:** executar os advisors e analisar avisos de funções `SECURITY DEFINER` expostas antes de qualquer deploy.
7. **Aprovação:** manter Draft PR até revisão de código, matriz server-side e testes de ponta a ponta. Não fazer merge/publicação sem autorização.

## 6. Correcção de faturação registada nesta branch
O selector do cliente no gerador A4 usava o nome de campo `paciente_id`, apesar de listar registos de `finance_clientes`. O código foi renomeado para `cliente_id` e a mensagem de pré-validação foi corrigida. A associação a paciente continua a ser obtida do campo `finance_clientes.paciente_id`, quando existe; clientes sem associação clínica continuam válidos no fluxo. Isto é uma correcção de clareza/identificadores no frontend, não prova de emissão fiscal nem de acesso da Receção.

## 7. Estado e limites
- Nenhum SQL mutável, DDL, migration ou alteração RLS foi aplicado ao Supabase.
- Nenhuma alteração ao Setup Windows, aos polos, aos dados de produção ou à `main` foi feita.
- A validação CI anteriormente observada passou na sintaxe JS e em verificações estáticas, mas não equivale a testes funcionais de todos os perfis.
- A matriz acima é o alvo de desenho. Os perfis RH/Receção/Suporte Informático não estão operacionais no Supabase até a migração e as políticas serem revistas, testadas e autorizadas.
- Não declarar homologação final, certificação AGT/APD ou prontidão para produção sem evidência formal.
