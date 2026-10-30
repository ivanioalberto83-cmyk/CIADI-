# CIADI — revisão de permissões, RH e polos

Data: 2026-10-30  
Âmbito: revisão de código e consulta read-only ao Supabase `egpkkttbcaukqnnxyhjv`.  
Estado: nenhuma alteração ao schema, dados, funções ou políticas de produção.

## 1. Conclusões executivas

1. O Dashboard autentica actualmente `admin`, `gestor` e `profissional`; o perfil `operador` é aceite no módulo SOS mas não passa pelo controlo geral de entrada.
2. Depois do login, a navegação principal mostra praticamente todos os módulos a qualquer perfil admitido. A única excepção central é A.T.; existem verificações adicionais dispersas em alguns módulos.
3. Não existe no schema de produção a tabela `ciadi_centros_acesso` nem uma tabela `polos`.
4. A migração proposta na PR #15 cria atribuições perfil-centro, mas não representa separadamente polo de origem, polo activo e representação temporária.
5. A migração proposta na PR #15 não basta para impor isolamento dos centros: a policy existente `finance_centros_custo_staff` continua a permitir `ALL` a `is_staff()`. Como as policies permissivas são combinadas por OR, uma policy adicional de leitura por centro não restringe a policy antiga.
6. A função `is_staff()` inclui A.T. activos; várias tabelas de RH e aprovisionamento usam essa função em policies `ALL`. A extensão global dessa função para novos perfis seria insegura.
7. A política de `ciadi_funcionarios` permite operações `ALL` a `is_staff()`. A tabela confidencial e as folhas salariais têm regras adicionais mais restritas; não se deve inferir que o acesso à tabela geral concede acesso a IBAN ou salário confidencial.

## 2. Estado observado no Dashboard

### Autenticação e navegação

- A validação de entrada no Dashboard aceita `admin`, `gestor` e `profissional`.
- `operador` é verificado como elegível para Alertas SOS, mas não é aceite no controlo geral de entrada.
- `visibleMenu()` apenas filtra A.T. através de `canAccessAT()`.
- `go(id)` encaminha directamente para os módulos sem uma verificação central de autorização por módulo.
- Existem verificações locais em funções de SOS e A.T., mas não constituem uma matriz completa e consistente.

Consequência: a visibilidade dos menus não representa a autorização real e o controlo de acesso à navegação precisa de uma matriz explícita aprovada e de RLS correspondente.

### Perfis existentes

A constraint actualmente observada em `public.perfis.tipo` aceita:
- `admin`
- `gestor`
- `profissional`
- `paciente`
- `responsavel`
- `operador`

Os tipos `rh`, `rececao` e `suporte_informatica` ainda não são aceites pela constraint de produção. A migração que os adiciona existe na PR #20, mas não foi aplicada.

## 3. Estado observado no Supabase

### Políticas de RH

As seguintes tabelas têm policy `ALL` para `authenticated` baseada em `is_staff()`:
- `ciadi_funcionarios`
- `ciadi_funcionario_assiduidade`
- `ciadi_funcionario_avaliacoes`
- `ciadi_funcionario_competencias`
- `ciadi_funcionario_contratos`
- `ciadi_funcionario_documentos`
- `ciadi_funcionario_ferias_licencas`
- `ciadi_funcionario_formacoes`
- `ciadi_funcionario_historico`

`is_staff()` aceita administradores/gestores activos e profissionais A.T. activos. Assim, os A.T. abrangidos pela função também passam nas policies destas tabelas. É necessário avaliar e restringir individualmente cada tabela e operação antes de activar RH.

`ciadi_funcionario_confidencial` e `ciadi_funcionario_beneficios` têm condições adicionais para `admin`/`gestor`. `ciadi_folhas_salariais` e `ciadi_folha_salarial_linhas` têm policies próprias de gestão. Preservar esta separação e verificar também as funções RPC relacionadas com recibos e folhas.

### Centros de custo e polos

- `finance_centros_custo` tem uma policy existente `finance_centros_custo_staff` para `ALL` baseada em `is_staff()`.
- `ciadi_centros_acesso` não existe actualmente em produção.
- Não foi encontrada uma tabela `polos`.
- `ciadi_funcionarios.centro_custo` é texto, não uma FK para `finance_centros_custo`.
- O modelo actual não guarda os três conceitos operacionais necessários: polo de origem, polo activo e polo representado.

### SOS e aprovisionamento

- `ciadi_sos_alertas` permite leitura a perfis activos `admin`, `gestor`, `operador` e `profissional`; a policy de actualização operacional limita-se a `admin`, `gestor` e `operador`.
- `ciadi_materiais_apoio` permite leitura pública apenas de materiais publicados, activos e disponíveis; escrita de equipa depende de `is_staff()`.
- `ciadi_solicitacoes_materiais` combina acesso da equipa com acesso de familiares/profissionais às respectivas solicitações. Alterar `is_staff()` pode afectar estes fluxos.

## 4. Revisão da migração de centros da PR #15

Ficheiro analisado: `supabase/migrations/20261027070000_ciadi_centros_custo_acesso.sql`.

A migração é preparatória e não foi aplicada. Foram identificadas três limitações:

1. Cria uma relação perfil-centro com `ativo` e `principal`, mas não distingue polo de origem, contexto de trabalho activo ou representação temporária.
2. Acrescenta uma policy de leitura por centros atribuídos, mas não substitui nem restringe a policy permissiva `finance_centros_custo_staff` (`ALL`, `is_staff()`). A policy antiga pode continuar a autorizar operações independentemente da nova condição.
3. A normalização de `CC-001` e a criação de `CC-002` são operações de dados e não devem ser executadas sem confirmação da identidade dos registos, backup restaurável e autorização explícita.

A migração também declara que não isola linhas financeiras. Documentos, clientes, despesas, pagamentos, caixas e operações relacionadas continuam a exigir modelação e policies próprias antes de activar o selector de polo.

## 5. Decisões técnicas para a implementação seguinte

### Permissões

- Não codificar uma matriz final de permissões enquanto a Direcção não aprovar, por módulo e operação, quem pode consultar, criar, editar, aprovar, anular e exportar.
- Não converter o perfil de estação Windows em perfil de autorização.
- Não confiar em ocultação de menus; a aplicação deverá bloquear também a navegação directa, mas o servidor/RLS continuará a ser a autoridade.
- Não alargar globalmente `is_staff()` nem `ciadi_finance_staff()`.
- Criar funções de autorização específicas por domínio apenas depois de mapear as tabelas, RPC e relações abrangidas.

### Polos

O futuro modelo deve separar, sem ambiguidade:
- polo de origem do colaborador (associação administrativa);
- polo activo (contexto da sessão);
- polo representado (delegação temporária autorizada, com início/fim, motivo, autor e trilho de auditoria).

A selecção do polo activo deve limitar-se aos polos autorizados pelo servidor. A representação deve ser uma concessão explícita e auditável; não deve alterar o polo de origem. A Direcção só terá visão consolidada mediante permissão específica do servidor.

### RH

Separar pelo menos:
- dados funcionais necessários à operação de RH;
- dados identificativos/documentais;
- dados confidenciais, bancários e remuneratórios;
- operações de aprovação e emissão de recibos.

Não atribuir acesso a salários, IBAN, INSS ou documentos identificativos por herança de uma permissão genérica de RH.

## 6. Bloqueios antes de activar permissões ou polos

1. Aprovação formal da matriz de módulos/acções pela Direcção.
2. Auditoria das policies e RPC de cada tabela e módulo abrangido.
3. Verificação de backup Supabase restaurável e backup independente do Storage.
4. Migrações aditivas e plano de reversão, sem backfill presumido.
5. Contas de teste separadas para Admin, Gestor (se mantido), Operador, A.T., RH, Recepção, Suporte, Paciente e Responsável.
6. Testes positivos e negativos por SELECT/INSERT/UPDATE/DELETE/RPC e tentativas directas à API.
7. Testes de isolamento Talatona/Jardim de Rosas, incluindo sessão activa e representação temporária.
8. Só depois, homologação do Setup Windows.

## 7. Limites desta revisão

- Consulta Supabase exclusivamente read-only.
- Nenhum utilizador, dado, registo, tabela, função ou policy foi alterado.
- As PR #15 e #20 foram consultadas como propostas separadas; não foram integradas.
- A PR #23 continua separada e não foi integrada.
- Não foi gerado nem instalado um novo Setup.
