# CIADI — Desenho técnico do Suporte Informático

**Estado:** proposta técnica baseada em auditoria read-only de 06-11-2026.  
**Aplicação:** exclusivamente aos sistemas, equipamentos e serviços internos do CIADI.  
**Não aplicado:** este documento não cria tabelas, não altera RLS, políticas, permissões, contas, dados ou produção.

## 1. Resultado da auditoria do esquema actual

Foram consultados o catálogo de tabelas/colunas, constraints, políticas RLS, privilégios e migrações do projecto Supabase `egpkkttbcaukqnnxyhjv`.

| Estrutura existente | Estado observado | Decisão |
|---|---|---|
| `ciadi_materiais_apoio` | RLS activo; 0 registos; publicação e disponibilidade de materiais de apoio | Não reutilizar para inventário de TI |
| `ciadi_solicitacoes_materiais` | RLS activo; 0 registos; pedidos associados a pacientes, responsáveis e profissionais | Não reutilizar para requisições informáticas |
| `ciadi_solicitacoes_materiais_historico` | RLS activo; histórico do circuito clínico de materiais | Não reutilizar |
| `finance_despesas` | RLS activo; 0 registos; política `ciadi_finance_staff()` | Manter no domínio financeiro |
| `finance_imobilizados` | RLS activo; 0 registos; política `is_staff()`; campos de aquisição e depreciação | Manter como registo contabilístico; eventual ligação por referência, sem duplicar lançamentos |
| `ciadi_modelos_documentos` | RLS activo; 10 modelos; ligado a documentos clínicos e campos de modelos | Não misturar documentos técnicos com modelos clínicos |
| `ciadi_campos_modelos_documentos` | RLS activo; 113 campos | Não alterar no âmbito do Suporte |
| `ciadi_documentos_institucionais` | RLS activo; 2 registos; escrita reservada à gestão | Não assumir que o Suporte pode arquivar aqui documentos técnicos |
| `documentos_clinicos` | RLS activo; circuito clínico, validação, assinatura, publicação e histórico | Não reutilizar para documentação de TI |

### 1.1 Limites de autorização observados

- A constraint de `perfis.tipo` aceita actualmente `admin`, `gestor`, `profissional`, `paciente`, `responsavel` e `operador`; não inclui `suporte_informatica`.
- `is_staff()` reconhece Administração/Gestão e profissionais AT activos; não reconhece uma estação Suporte autónoma.
- `ciadi_finance_staff()` e `ciadi_is_management()` reconhecem apenas perfis activos `admin` e `gestor`.
- O perfil/atalho da estação Windows é apenas identificação de interface; não concede permissões de dados.
- Não foi encontrada uma tabela dedicada a fornecedores, compras, stock ou inventário operacional de TI.

**Conclusão:** a interface não deve tentar gravar nas tabelas clínicas ou financeiras existentes para simular aprovisionamento informático.

## 2. Arquitectura proposta

Separar o domínio de TI em estruturas próprias, com prefixo `ciadi_it_`. Os nomes abaixo são propostas, não objectos existentes.

| Estrutura proposta | Finalidade principal |
|---|---|
| `ciadi_it_memberships` | Associar utilizadores autenticados a capacidades de TI, sem confundir estação com autorização |
| `ciadi_it_assets` | Registo de computadores, monitores, impressoras, routers, telefones e outros equipamentos |
| `ciadi_it_stock_items` | Catálogo interno de artigos e consumíveis informáticos |
| `ciadi_it_stock_movements` | Entradas, saídas, transferências, devoluções e ajustamentos justificados |
| `ciadi_it_requests` | Requisições internas de equipamento, consumíveis e serviços técnicos |
| `ciadi_it_request_items` | Linhas, quantidades e especificações técnicas de cada requisição |
| `ciadi_it_suppliers` | Cadastro interno de fornecedores autorizados para compras de TI |
| `ciadi_it_maintenance` | Manutenções preventivas/correctivas, diagnóstico, intervenção e resultado |
| `ciadi_it_document_templates` | Modelos versionados de documentos técnicos |
| `ciadi_it_documents` | Documentos técnicos emitidos, numeração, autoria, estado, hash e arquivo |
| `ciadi_it_document_history` | Histórico append-only de alterações e transições documentais |
| `ciadi_it_service_checks` | Verificações de serviço com data, origem, evidência e estado |

### 2.1 Regras de inventário

- Cada equipamento tem código patrimonial/operacional único, categoria, fabricante, modelo, número de série, estado, localização, polo responsável e datas relevantes.
- A atribuição do equipamento a um polo/localização é explícita e pode ser alterada com histórico; não é inferida pelo computador ou pelo polo onde o utilizador iniciou sessão.
- Consumíveis têm unidade de medida, stock mínimo, stock disponível e movimentos rastreáveis.
- Quando um equipamento for também imobilizado contabilístico, guardar uma referência opcional ao registo de `finance_imobilizados`; não criar nem alterar lançamentos contabilísticos automaticamente.
- Transferências, baixas e ajustamentos exigem motivo, autoria, data e histórico.

### 2.2 Fluxo de aprovisionamento

1. Suporte cria a requisição e descreve necessidade, prioridade, especificação, quantidade e polo/local de destino.
2. Suporte valida tecnicamente e submete para decisão.
3. Administração aprova, rejeita ou devolve para esclarecimento, incluindo a decisão financeira.
4. Só após aprovação da Administração o estado pode avançar para encomenda/aquisição.
5. Suporte regista recepção física, conferência, números de série e entrada em stock/inventário.
6. Suporte regista entrega/atribuição e encerra a requisição com evidência.

**Separação de funções:** Suporte não aprova despesas, pagamentos, fornecedores financeiros nem compras em nome da Administração.

Estados sugeridos: `rascunho`, `submetida`, `em_validacao_tecnica`, `pendente_aprovacao_administracao`, `aprovada`, `rejeitada`, `em_aquisicao`, `recebida_parcialmente`, `recebida`, `entregue`, `encerrada`, `cancelada`.

## 3. Motor documental técnico

Documentos previstos para o domínio de TI:

- Requisição interna de material/equipamento;
- Ordem de trabalho/intervenção;
- Ficha de equipamento e termo de atribuição;
- Guia de entrega/devolução;
- Relatório de manutenção;
- Relatório de incidente;
- Registo de alteração de acesso/configuração;
- Relatório de backup e de teste de recuperação;
- Acta técnica de verificação/homologação.

Cada modelo deverá ter código, versão, campos obrigatórios, regras de validação, série/numeração, autor, data, estado, pré-visualização, impressão/exportação, arquivo privado e trilho de auditoria. Documentos emitidos devem ser imutáveis; correcções geram nova versão ou documento de substituição, sem apagar o original.

O arquivo deverá usar o bucket privado apropriado, com autorização por documento e tipo de confidencialidade. A existência do bucket `documentos` não equivale a autorização de acesso para a estação Suporte.

## 4. Modelo de permissões proposto

| Capacidade | Suporte Informático | Administração | RH / Recepção |
|---|---:|---:|---:|
| Consultar estado de serviços e auditoria técnica | Sim | Sim | Não, salvo relatório autorizado |
| Gerir equipamentos e stock de TI | Sim | Sim | Não |
| Criar/editar requisições técnicas | Sim | Sim | Não |
| Submeter requisições para aprovação | Sim | Sim | Não |
| Aprovar/rejeitar compras e despesas | Não | Sim | Não |
| Registar recepção técnica e atribuição | Sim | Sim | Não |
| Emitir documentos técnicos de TI | Sim | Sim | Não |
| Consultar dados clínicos | Não por defeito | Conforme perfil clínico autorizado | Não por defeito |
| Gerir salários e documentos confidenciais de RH | Não | Conforme autorização | RH, conforme função |

O acesso global de Suporte e Administração aos polos deve ser independente da atribuição física do equipamento. O âmbito de RH e Recepção mantém-se limitado às funções e polos autorizados.

### 4.1 Implementação de autorização

Antes de escrever políticas:
1. Confirmar o mapeamento real das quatro contas de estação para os perfis autenticados, sem alterar contas.
2. Definir capacidades explícitas e separadas da estação Windows.
3. Desenhar políticas RLS por operação e por registo, incluindo escopo global de TI e separação de polos.
4. Verificar privilégios SQL e exposição ao Data API para cada nova tabela.
5. Testar SELECT/INSERT/UPDATE/DELETE com identidades de teste autorizadas e não autorizadas.
6. Executar Security Advisors e rever funções auxiliares, sem introduzir acesso privilegiado genérico.

Não conceder `admin` ou `gestor` à conta Suporte como atalho. A implementação deve dar apenas as capacidades necessárias.

## 5. Condições de segurança e implementação

- O Supabase passou a exigir exposição explícita de novas tabelas públicas à Data API; não presumir que a criação da tabela a torna acessível. Cada GRANT deve ser intencional e acompanhado de RLS e políticas adequadas.
- Não colocar service-role/secret keys no HTML, Electron renderer ou instalador.
- Não usar tabelas clínicas, dados de pacientes ou modelos clínicos para o domínio informático.
- Não dar ao Suporte capacidade de aprovar despesas, pagamentos ou compras.
- Não fazer alterações destrutivas, migrações, DDL/DML ou alterações de RLS até existir autorização específica.
- A implementação deverá ser versionada, testada em ambiente não produtivo, revista e homologada antes de qualquer publicação.

## 6. Observações da auditoria de segurança

Na consulta dos Security Advisors foram apresentados, entre outros, avisos sobre duas tabelas com RLS activo sem políticas (`ciadi_automation_token_hashes` e `ciadi_email_notificacoes_fila`), funções SECURITY DEFINER executáveis por papéis API e políticas permissivas múltiplas. São achados preexistentes que merecem auditoria própria; não foram alterados nesta entrega.

O advisor de desempenho também reportou índices duplicados em várias tabelas. Não foram removidos nem modificados.

## 7. Próximo passo sujeito a autorização

Rever este modelo e autorizar, separadamente, a preparação de uma migração versionada para o domínio `ciadi_it_` e respectivas políticas RLS. A autorização para preparar a migração não deve ser interpretada como autorização para a aplicar no projecto de produção.
