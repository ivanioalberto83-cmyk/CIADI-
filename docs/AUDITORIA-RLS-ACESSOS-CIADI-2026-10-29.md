# CIADI — resultados adicionais da auditoria RLS
Data: 29/10/2026
Projeto: Supabase `egpkkttbcaukqnnxyhjv`
Estado: somente leitura; nenhuma política ou dado de produção foi alterado.

## Evidência confirmada

1. `public.perfis_tipo_check` aceita atualmente `admin`, `gestor`, `profissional`, `paciente`, `responsavel` e `operador`. Ainda não aceita `suporte_informatica`, `rh` ou `rececao`.
2. `public.ciadi_finance_staff()` autoriza somente perfis ativos `admin` e `gestor`. Tornar menus visíveis à Receção não concede, por si só, acesso real às tabelas financeiras.
3. `public.is_staff()` inclui perfis ativos `admin`/ `gestor` e profissionais ativos marcados como A.T. Esta função é usada por várias políticas de RH e aprovisionamento; alargá-la globalmente para RH ou Receção poderia dar acesso indevido a outras tabelas.
4. As tabelas `ciadi_funcionario_assiduidade`, `ciadi_funcionario_avaliacoes`, `ciadi_funcionario_competencias`, `ciadi_funcionario_contratos`, `ciadi_funcionario_documentos`, `ciadi_funcionario_ferias_licencas`, `ciadi_funcionario_formacoes`, `ciadi_funcionario_historico` e `ciadi_funcionarios` usam políticas ALL apoiadas em `is_staff()`. Isso requer revisão individual antes de ativar RH.
5. `ciadi_funcionario_beneficios` e `ciadi_funcionario_confidencial` têm políticas adicionais restritas a `admin`/ `gestor`. Não conceder estes dados a Receção nem RH por inferência.
6. `ciadi_materiais_apoio` tem SELECT público apenas para materiais publicados, ativos e disponíveis; a escrita usa `is_staff()`.
7. As políticas de `ciadi_solicitacoes_materiais` incluem acesso familiar/profissional às próprias solicitações e operações de equipa via `is_staff()`. Alterar a função comum sem testes pode afetar estes fluxos.
8. As políticas atuais de `ciadi_sos_alertas` permitem leitura a perfis ativos `admin`, `gestor`, `operador` e `profissional`; atualizações operacionais ficam em `admin`/ `gestor`/ `operador`. A inclusão de Receção/RH deve ser deliberada e limitada ao necessário.

## Plano seguro de implementação

- Primeiro: confirmar cópia restaurável da base de dados e exportação separada dos objetos do Storage.
- Segundo: adicionar os novos tipos de perfil por migração versionada e validada.
- Terceiro: criar funções auxiliares específicas por domínio (financeiro, RH, aprovisionamento e SOS), evitando alargar `is_staff()` globalmente.
- Quarto: escrever políticas por tabela e operação (SELECT/INSERT/UPDATE/DELETE), com restrição de linhas quando aplicável.
- Quinto: validar com contas de teste independentes para Admin, Suporte Informático, RH, Receção, A.T., Paciente e Responsável.
- Sexto: só depois de testes de negação e autorização aprovados, solicitar/aplicar alterações em produção.

## Critérios de aceitação obrigatórios

- Admin: gestão global dos polos, sem acesso ao Centro de Suporte Informático nem ao agente de suporte.
- Suporte Informático: acesso técnico ao centro e agente, sem privilégios concedidos pelo Setup; as permissões efetivas continuam dependentes do perfil autenticado no Supabase.
- Receção: apenas operações autorizadas de atendimento, caixa/financeiro/faturação e alertas conforme a matriz aprovada; sem contabilidade/SAF-T ou dados clínicos não necessários.
- RH: dados laborais necessários, sem acesso automático a informação salarial confidencial ou dados clínicos.
- A.T.: apenas assistidos atribuídos e funções clínicas autorizadas.
- Paciente/Responsável: apenas os próprios dados e vínculos autorizados.
- Verificar ausência de acesso anónimo a dados sensíveis e testar que todas as negações funcionam.

## Bloqueios atuais

- Não foi comprovada nesta sessão uma cópia restaurável da base de dados de produção.
- A cópia do repositório GitHub não é cópia da base de dados Supabase.
- O Storage precisa de cópia independente: os backups da base de dados não incluem os ficheiros binários do Storage.
- O Centro de Suporte Informático/agente de IA não foi localizado como módulo funcional no Dashboard inspecionado; não declarar esse fluxo implementado até localizar, ligar e testar a interface e o serviço correspondente.
- Não aplicar esta migração nem políticas RLS em produção enquanto o bloqueio do backup persistir.
