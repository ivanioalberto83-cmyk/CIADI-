# CIADI — Matriz técnica de permissões por módulo e dados
**Data da leitura:** 30-10-2026  
**Projecto:** `egpkkttbcaukqnnxyhjv`  
**Âmbito:** RH, Financeiro, Clínica e SOS  
**Estado:** auditoria somente de leitura; não foram executadas escritas, DDL, alterações de políticas, funções ou dados.

## 1. Princípios de autorização aprovados
A matriz funcional aprovada distingue os perfis Administrador, Gestor, Operador, Profissional, RH, Recepção, Suporte Informático, Paciente e Responsável. O perfil de login, por si só, não concede acesso: cada operação deve ser autorizada por módulo, acção, âmbito de dados e polo.

Acções distintas: `view`, `create`, `update`, `delete`, `approve`, `cancel`, `export`, `manage_users`, `manage_permissions`, `delegate`, `sign`, `publish`, `revoke`.

Âmbito polo:
- **Polo de origem:** vínculo administrativo estável do colaborador.
- **Polo activo:** contexto operacional escolhido entre polos autorizados.
- **Polo representado:** polo terceiro em que o colaborador actua por delegação expressa, temporária, limitada e auditável.
A mudança do polo activo ou a representação não altera o polo de origem. O perfil de estação (RH, Recepção, Suporte, etc.) é preferência operacional, não autorização.

## 2. Matriz funcional proposta (não é autorização técnica actualmente activa)
| Módulo / domínio | Administrador | Gestor | RH | Operador | Profissional | Recepção | Suporte |
|---|---|---|---|---|---|---|---|
| RH — cadastro e vínculo | gerir, com âmbito institucional autorizado | consultar/gerir conforme delegação | gerir dados laborais necessários | sem acesso por defeito | apenas dados próprios/operacionais mínimos | sem acesso | suporte técnico sem conteúdo laboral |
| RH — assiduidade, férias, formação, avaliações | gerir/consultar conforme necessidade | gerir/aprovar se delegado | gerir; aprovar conforme segregação | sem acesso | consultar registos próprios permitidos | sem acesso | sem acesso |
| RH — contratos e documentos | acesso justificado e auditado | acesso justificado e auditado | gerir conforme função | sem acesso | próprios documentos autorizados | sem acesso | metadados técnicos sem conteúdo |
| RH — confidencial, NIF, INSS, IBAN, salário | acesso excepcional e auditado | acesso excepcional e auditado | não automático; concessão específica | sem acesso | apenas dados próprios estritamente necessários | sem acesso | sem acesso |
| Financeiro — operações correntes | gerir conforme âmbito | gerir conforme âmbito | sem acesso | operações explicitamente atribuídas (ex.: caixa própria) | sem acesso | sem acesso | suporte técnico sem valores/conteúdo |
| Financeiro — contas, extratos, movimentos bancários | acesso específico, auditado | acesso específico, auditado | sem acesso por defeito | sem acesso por defeito | sem acesso | sem acesso | sem acesso |
| Financeiro — salários/processamento | aprovação separada e auditada | aprovação delegada, nunca implícita | processamento apenas se especificamente autorizado | sem acesso | sem acesso | sem acesso | sem acesso |
| Clínica — pacientes e agenda | acesso institucional justificado | gestão operacional autorizada | sem acesso clínico | apenas dados necessários a SOS/operação | pacientes atribuídos e finalidade clínica | dados mínimos de marcação/identificação | sem acesso clínico |
| Clínica — avaliações e documentos | acesso excepcional/auditado | acesso excepcional/auditado | sem acesso | sem acesso | registos dos pacientes atribuídos, dentro da função | sem acesso ao conteúdo clínico | sem acesso |
| SOS — alertas | gestão e supervisão | gestão e supervisão | sem acesso por defeito | receber/actualizar alertas atribuídos | acesso apenas quando necessário/atribuído | recepção de alerta apenas se explicitamente designada | diagnóstico técnico sem conteúdo sensível |
| SOS — denúncias | investigação com necessidade e auditoria | investigação delegada | sem acesso por defeito | sem acesso por defeito | sem acesso por defeito | sem acesso | sem acesso |

**Regra de segregação:** quem prepara processamento salarial não deve aprovar e pagar sem uma autorização separada. Exportação, assinatura, publicação, revogação, eliminação, delegação e gestão de permissões exigem direitos próprios; não decorrem de `view` ou `update`.

## 3. Estado observado nas políticas RLS de produção

### 3.1 RH
As tabelas `ciadi_funcionarios`, `ciadi_funcionario_assiduidade`, `ciadi_funcionario_avaliacoes`, `ciadi_funcionario_contratos`, `ciadi_funcionario_documentos`, `ciadi_funcionario_ferias_licencas`, `ciadi_funcionario_formacoes` e `ciadi_funcionario_historico` têm políticas permissivas `ALL` baseadas em `is_staff()`.

A função `public.is_staff()` devolve verdadeiro para:
- perfis activos `admin` ou `gestor`; **ou**
- profissionais activos com `eh_at = true` e perfil `profissional` activo.

**Risco elevado:** a segunda condição significa que um A.T. pode satisfazer a condição de staff nestas tabelas gerais de RH. Isto não corresponde à matriz funcional aprovada. Não foi testado com utilizadores reais; a conclusão decorre directamente da definição da função e das políticas.

As tabelas `ciadi_funcionario_beneficios` e `ciadi_funcionario_confidencial` acrescentam verificação de perfil `admin`/`gestor`, reduzindo o acesso. Porém, a tabela confidencial contém NIF, número INSS, identificação, IBAN, banco, titular, salário, subsídios, descontos e dados fiscais/bancários. O acesso de Gestor continua amplo e não está condicionado por polo nem por acção específica.

### 3.2 Financeiro
As políticas de `finance_contas_bancarias`, `finance_extratos_bancarios` e `finance_movimentos_bancarios` usam `is_staff()`. Consequentemente, o mesmo caminho de A.T. referido acima pode satisfazer o predicado de acesso a dados bancários. É uma exposição potencial de dados financeiros que requer prioridade máxima de correcção, após desenho e autorização próprios.

Várias tabelas de operações financeiras usam `ciadi_finance_staff()` ou `ciadi_finance_is_staff()`, cujas definições consultadas limitam a perfis activos `admin` e `gestor`. As políticas de caixa também contemplam o operador associado ao próprio turno/caixa. Ainda assim, várias políticas usam `ALL`, juntando leitura, inserção, actualização e eliminação numa única regra; a matriz final deve separar operações e limitar por polo, empresa, caixa e turno.

### 3.3 Clínica
- `pacientes`: existem políticas de leitura própria, vínculo familiar activo, profissional com relação de atendimento e `paciente_staff_all`/leitura com `is_staff()`. Como `is_staff()` inclui A.T., há um caminho de acesso de A.T. a todos os registos de pacientes e operações `ALL` na tabela, não apenas aos pacientes atribuídos.
- `agendamentos`: leitura inclui staff, paciente, profissional associado e responsável com vínculo familiar activo. Actualização permite staff ou profissional associado. Inserção permite staff ou paciente próprio. O uso de `is_staff()` volta a incluir A.T. em operações de staff.
- `documentos_clinicos`: políticas de staff para SELECT, INSERT, UPDATE e DELETE usam `is_staff()`; existem também políticas específicas para profissional e família. A regra staff permite acesso mais amplo do que o âmbito do paciente atribuído e do estado de rascunho.
- `ciadi_avaliacoes_clinicas`: leitura/actualização para admin/gestor ou profissional associado; inserção por profissional associado; eliminação para admin/gestor. A política de profissional não verifica explicitamente vínculo activo em todas as condições apresentadas.
- `ciadi_formularios_clinicos`: formulários publicados e activos são legíveis por autenticados; gestão por admin/gestor. Distinguir formulários/modelos institucionais de registos clínicos individuais.
- `ciadi_documentos_clinicos_historico`: leitura usa `is_staff()`, herdando o risco de abrangência A.T.

### 3.4 SOS
- `ciadi_sos_alertas`: leitura por admin/gestor/operador/profissional activos e também por titular/gestão; actualização por admin/gestor/operador activos. A política de leitura por perfil não limita o alerta ao polo ou à atribuição. A política de actualização permite a esses perfis actualizarem linhas sem restrição por estado, atribuição ou polo visível no predicado.
- `ciadi_sos_denuncias`: inserção permite denúncia anónima (sem perfil) ou identificada pelo próprio. Leitura do próprio ou gestão; actualização pela função de gestão (admin/gestor). O acesso a denúncias deve ser separado do acesso a alertas operacionais.
- `ciadi_sos_configuracao`: ALL para gestão (admin/gestor).

## 4. Semântica crítica de RLS
As políticas observadas são maioritariamente **PERMISSIVE**. Em PostgreSQL, políticas permissivas aplicáveis são combinadas por OR; adicionar uma política restritiva por perfil não neutraliza automaticamente uma política permissiva ampla já existente. A revisão futura deve avaliar o conjunto completo de políticas por tabela e comando, incluindo `USING` e `WITH CHECK`, e testar cada caminho.

UPDATE requer uma política SELECT compatível; UPDATE deve ter `USING` e `WITH CHECK` que impeçam mudança indevida de proprietário, paciente, funcionário, polo, empresa ou âmbito.

## 5. Funções SECURITY DEFINER observadas
As funções abaixo foram lidas em modo somente de leitura:
- `is_staff()`: SECURITY DEFINER; inclui admin/gestor e A.T. activo.
- `ciadi_finance_staff()` e `ciadi_finance_is_staff()`: SECURITY DEFINER; admin/gestor activos.
- `ciadi_is_management()`: SECURITY DEFINER; admin/gestor activos.
- `ciadi_user_is_patient_of(uuid)`: SECURITY DEFINER; verifica paciente ligado ao auth.uid().
- `ciadi_user_is_professional_for_patient(uuid)`: SECURITY DEFINER; verifica profissional com agendamento para o paciente.
- `ciadi_finance_operator_id()`: SECURITY DEFINER; obtém operador activo do perfil autenticado.

As funções têm `search_path = public`. Antes de reutilizar ou ampliar qualquer função SECURITY DEFINER, rever privilégios EXECUTE, schema exposto, objectos qualificados, owner, comportamento de erro e possibilidade de abuso. Não alterar funções genéricas como `is_staff()` sem mapear todas as suas dependências.

## 6. Decisões de desenho recomendadas
1. Não usar `is_staff()` como autorização transversal para RH, dados bancários ou conteúdo clínico.
2. Criar autorização explícita por recurso/acção e âmbito: pessoa/funcionário, paciente atribuído, empresa, centro de custo, caixa/turno e polo.
3. RH deve ter permissões de gestão laboral sem acesso automático a IBAN, NIF, INSS, salário ou dados bancários extra; estes campos exigem permissão confidencial separada.
4. Financeiro deve separar caixa, contabilidade, faturação, bancos, salários e exportações fiscais.
5. Clínica deve usar atribuição clínica efectiva e finalidade; A.T. só acede aos pacientes/planos atribuídos e às secções necessárias à intervenção.
6. SOS: separar alerta operacional, denúncia/investigação e configuração; restringir actualização a acções de estado e atribuição permitidas, com auditoria.
7. A autorização de polo deve ser avaliada no servidor/RLS. A selecção de polo activo não concede acesso por si só; representação exige delegação activa com validade, âmbito e aprovador.
8. Não tratar esconder menus ou bloquear navegação no browser como controlo de segurança.

## 7. Lacunas que impedem a activação
- Não existem actualmente tabelas de polos/associações de acesso identificadas na leitura anterior; o centro de custo em `ciadi_funcionarios` é texto e não é uma chave de autorização.
- Perfis funcionais RH, Recepção e Suporte não estão contemplados no CHECK actual de `perfis.tipo`.
- Não foi demonstrada autorização por polo nas políticas acima.
- Não foi demonstrada segregação técnica de exportação, aprovação, assinatura, revogação e delegação.
- Não foi testado restore de backup; não se pode assumir reversibilidade operacional.
- É necessário inventariar todas as políticas e grants de cada tabela, incluindo Storage buckets, views, RPCs e Edge Functions, antes de produzir uma migração.

## 8. Próxima fase segura
1. Inventariar grants SQL, políticas RLS completas e privilégios EXECUTE das funções relevantes.
2. Mapear cada módulo do Dashboard para tabelas, RPCs, Storage e acções reais.
3. Preparar casos de teste negativos/positivos por perfil, polo de origem, polo activo e representação.
4. Implementar primeiro em ambiente de desenvolvimento isolado, com dados fictícios e testes RLS; não aplicar em produção.
5. Só depois de revisão, backup com restauro demonstrado e autorização expressa, propor migrações para produção.

**Conclusão:** a implementação de frontend PermissionService continua a negar por defeito sem provedor servidor. Esta auditoria confirma riscos estruturais que impedem ligar o serviço ao Dashboard ou declarar os módulos seguros. Nenhuma política ou dado de produção foi alterado.
