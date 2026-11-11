# CIADI — Auditoria RH e Aprovisionamento: plano de testes de homologação
**Data:** 26/10/2026  
**Modo executado:** leitura apenas  
**Ambiente:** produção Supabase `egpkkttbcaukqnnxyhjv` consultado para inventário; nenhum dado alterado.  
**Estado:** plano de teste preparado; testes comportamentais ainda não executados porque o projeto não permite branches de desenvolvimento no plano atual.

## 1. Resumo executivo

- O projeto Supabase está ativo e saudável.
- A criação de branch foi tentada após autorização do custo estimado de US$ 0,01344/h, mas a plataforma devolveu `Branching is supported only on the Pro plan or above`. Não foi criada branch; a lista de branches está vazia.
- A revisão do esquema identifica um conjunto de tabelas de RH, mas a interface `index.html` da branch `main` não apresenta item de menu RH. A existência de tabelas não comprova que o módulo esteja utilizável pelo Dashboard.
- Aprovisionamento está representado por `ciadi_materiais_apoio`, `ciadi_solicitacoes_materiais` e `ciadi_solicitacoes_materiais_historico`. Não foi confirmada a existência de um ciclo integrado de fornecedores, compras, receções, armazéns e movimentos de stock.
- O Security Advisor continua a assinalar duas views SECURITY DEFINER e funções SECURITY DEFINER acessíveis a `anon`/ `authenticated`. São achados a investigar, não prova automática de exploração.

## 2. Inventário RH observado

Tabelas identificadas:
- `ciadi_funcionarios`
- `ciadi_funcionario_contratos`
- `ciadi_funcionario_documentos`
- `ciadi_funcionario_assiduidade`
- `ciadi_funcionario_ferias_licencas`
- `ciadi_funcionario_avaliacoes`
- `ciadi_funcionario_beneficios`
- `ciadi_funcionario_competencias`
- `ciadi_funcionario_formacoes`
- `ciadi_funcionario_historico`
- `ciadi_funcionario_confidencial`

As políticas observadas para várias tabelas RH concedem operações `ALL` a `authenticated` quando `is_staff()` é verdadeiro. Algumas tabelas, como dados confidenciais e benefícios, combinam a verificação com um perfil `admin` ou `gestor`. A função `is_staff()` e a matriz de perfis têm de ser inspecionadas para determinar o alcance real; não se deve concluir que a separação de funções está correta sem testes por identidade.

### Risco principal RH
Um profissional clínico ou outro membro de equipa pode estar incluído na definição de `is_staff()` e, assim, obter acesso maior do que o necessário a contratos, assiduidade, férias, avaliações ou documentos. Não carregar dados laborais reais até se confirmar o princípio do menor privilégio.

## 3. Inventário Aprovisionamento observado

### `ciadi_materiais_apoio`
- Leitura de materiais publicados, ativos e disponíveis é permitida a `anon` e `authenticated`.
- Escrita é atribuída a `authenticated` com condição `is_staff()`.

### `ciadi_solicitacoes_materiais`
- Inserção permite `is_staff()`, responsável associado ao paciente por vínculo familiar ativo, ou profissional ligado ao pedido.
- Consulta permite equipa, responsável indicado ou profissional ligado.
- Atualização e eliminação estão limitadas por `is_staff()`.

### `ciadi_solicitacoes_materiais_historico`
- Leitura limitada à equipa ou a utilizadores associados à solicitação.
- A política de equipa permite operações mais amplas quando `is_staff()` é verdadeiro.

### Limite funcional
Estas tabelas sustentam catálogo e solicitações, mas não demonstram controlo de stock físico nem compras. Não foi confirmado um esquema de fornecedores, encomendas, receções, armazéns e movimentos de stock no conjunto de tabelas consultado.

## 4. Matriz de testes — RH

Executar apenas em ambiente de homologação com contas e registos fictícios. Para cada caso, guardar evidência sem dados pessoais reais.

| ID | Perfil de teste | Ação | Resultado esperado | Prioridade |
|---|---|---|---|---|
| RH-01 | Admin | Consultar lista de colaboradores | Apenas campos necessários; operações administrativas permitidas | Alta |
| RH-02 | Gestor RH | Criar/editar colaborador fictício | Guardar uma vez; histórico e validações coerentes | Alta |
| RH-03 | Profissional clínico | Consultar contrato e dados confidenciais | Acesso negado, salvo autorização formal específica | Crítica |
| RH-04 | Profissional A.T. | Consultar documentos/assiduidade de RH | Sem acesso automático por ser profissional | Crítica |
| RH-05 | Paciente/responsável | Tentar consultar tabelas RH via API | Sem acesso a qualquer registo laboral | Crítica |
| RH-06 | Anónimo | Consultar tabelas RH via API | Sem acesso a informação laboral | Crítica |
| RH-07 | Gestor | Submeter férias/licença fictícia | Aprovação/estado rastreável; sem autoaprovação se a política exigir separação | Alta |
| RH-08 | Utilizador não autorizado | Alterar contrato, salário ou documento | Operação bloqueada e sem alteração parcial | Crítica |
| RH-09 | Admin | Consultar histórico de alteração | Autor, data e ação disponíveis quando o evento é auditável | Alta |
| RH-10 | Qualquer perfil autorizado | Tentar upload/download de documento privado | Acesso temporário e restrito; sem URL pública permanente | Crítica |

## 5. Matriz de testes — Aprovisionamento

| ID | Perfil de teste | Ação | Resultado esperado | Prioridade |
|---|---|---|---|---|
| AP-01 | Anónimo | Listar materiais | Apenas materiais publicados, ativos e disponíveis; sem campos internos | Alta |
| AP-02 | Utilizador autenticado sem função de equipa | Criar/editar material | Operação bloqueada | Crítica |
| AP-03 | Profissional ligado a pedido | Criar solicitação fictícia | Só pode associar o pedido a contexto autorizado | Alta |
| AP-04 | Responsável familiar | Solicitar material para criança vinculada | Permitido apenas para vínculo ativo e paciente correto | Alta |
| AP-05 | Responsável A | Consultar pedido de responsável B | Sem acesso ao pedido de outra família | Crítica |
| AP-06 | Profissional A | Consultar pedido de profissional B | Sem acesso fora do âmbito autorizado | Crítica |
| AP-07 | Utilizador não autorizado | Atualizar/apagar solicitação | Operação bloqueada | Crítica |
| AP-08 | Equipa | Alterar estado de solicitação | Mudança validada e registada no histórico | Alta |
| AP-09 | Utilizador repetindo envio | Submeter duas vezes | Evitar duplicação ou sinalizar duplicado | Média |
| AP-10 | Equipa de aprovisionamento | Receber material e atualizar stock | Não executar até existir módulo de stock real e homologado | Bloqueio funcional |

## 6. Revisão de segurança transversal

1. Rever a definição de `is_staff()`, quem a pode executar e quais perfis ela inclui.
2. Rever políticas RLS por tabela, operação (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) e perfil.
3. Testar acesso via interface e API; esconder um botão não é controlo de segurança.
4. Confirmar que documentos pessoais/laborais estão em bucket privado e que downloads exigem autorização.
5. Rever logs e histórico sem incluir dados pessoais nas evidências.
6. Não revogar em bloco permissões de funções SECURITY DEFINER: algumas podem ser chamadas por triggers ou fluxos legítimos. Verificar referências, triggers, grants e autorização interna antes de propor cada alteração.
7. Rever as views `v_ciadi_at_pacientes_atribuidos` e `v_ciadi_calendario_aniversarios` quanto a SECURITY INVOKER/RLS e campos expostos.
8. Rever funções SECURITY DEFINER acessíveis a `anon`, distinguindo funções públicas intencionais (por exemplo, submissão de triagem pública) de funções que não devem ser chamadas anonimamente.
9. Manter habilitação de proteção contra palavras-passe comprometidas como item pendente para configuração e teste controlado.
10. Não usar dados reais de pacientes, famílias, colaboradores ou fornecedores em testes.

## 7. Plano de remediação proposto — ainda não aplicado

1. Documentar a matriz de perfis e as responsabilidades de RH/Aprovisionamento.
2. Fazer revisão linha a linha de `is_staff()` e de cada política RH.
3. Propor migrações SQL estreitas, com comentários, pré-condições e rollback; não aplicar em produção nesta fase.
4. Implementar ambiente isolado compatível com o plano Supabase ou usar projeto separado de homologação, com aprovação explícita de custos e sem copiar dados pessoais de produção.
5. Executar as matrizes acima e guardar evidências fictícias.
6. Corrigir a interface RH e decidir o escopo de Aprovisionamento somente depois de requisitos e testes aprovados.
7. Fazer nova leitura do Security Advisor após cada mudança de esquema.
8. Exigir revisão e autorização separadas antes de qualquer promoção a produção.

## 8. Critérios de aceitação

- Nenhum perfil não autorizado lê ou modifica dados laborais confidenciais.
- Familiares/profissionais só consultam solicitações de materiais associadas a si e aos vínculos permitidos.
- O catálogo público expõe apenas materiais destinados a publicação.
- Alterações de estado e dados críticos são rastreáveis.
- A interface não oferece ações que falham silenciosamente ou criam duplicados.
- O manual descreve apenas funcionalidades efetivamente testadas.
- Todos os testes críticos passam; qualquer falha crítica bloqueia a entrada em produção.

## 9. Limitações desta revisão

- A leitura do esquema e das políticas não substitui testes de sessão real por cada perfil.
- Nenhuma mutação, inserção, atualização ou exclusão foi executada.
- Nenhuma migração foi aplicada e nenhuma alteração foi feita ao projeto de produção.
- A branch Supabase de homologação não foi criada, porque a plataforma informou que exige Pro ou superior.
