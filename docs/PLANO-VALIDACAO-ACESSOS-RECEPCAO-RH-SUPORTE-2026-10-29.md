# CIADI — Plano de validação de acessos: Receção, RH e Suporte
Data: 2026-10-29
Branch: audit/divisao-acessos-ciadi-2026-10-29

## Implementado na branch (interface)
- Menu ordenado: Financeiro → Faturação → Clientes → Fornecedores → Caixa & Tesouraria → Alertas → Aprovisionamento → Recursos Humanos.
- Perfil Receção (rececao) e perfil legado Operador (operador) recebem apenas os módulos operacionais definidos na matriz da interface; Contabilidade e SAF-T não aparecem para estes perfis.
- Recursos Humanos tem uma área de consulta baseada nas tabelas existentes de funcionários, documentos, contratos, férias/licenças, assiduidade, formações, avaliações, competências e benefícios.
- Fornecedores é uma vista de consulta derivada de finance_despesas; não existe uma tabela mestre finance_fornecedores no schema consultado.
- Aprovisionamento consulta ciadi_materiais_apoio, ciadi_solicitacoes_materiais e respetivo histórico.
- O perfil técnico está normalizado como `suporte_informatica` (rótulo: **Suporte Informático**) na matriz de acessos e no seletor de perfis do Dashboard. O Setup identifica a estação e não concede permissões.
- O controlo de navegação bloqueia IDs do Centro de Suporte Informático/agente IA a qualquer perfil diferente de `suporte_informatica`, incluindo `admin`.

## Bloqueios de Supabase encontrados (não alterados em produção)
1. O check constraint de public.perfis.tipo aceita atualmente admin, gestor, profissional, paciente, responsavel e operador. Ainda não aceita `suporte_informatica`, `rh` ou `rececao`; por isso estes perfis não devem ser atribuídos até preparar, rever e aplicar uma migração.
2. A consulta de perfis ativos encontrou 2 administradores, 1 operador, 2 pacientes, 2 profissionais e 2 responsáveis; nenhum perfil gestor ativo/inativo apareceu no resultado consultado.
3. ciadi_finance_staff() permite atualmente apenas admin e gestor. As políticas RLS financeiras usam esta função. A visibilidade no menu não concede acesso real à Receção.
4. is_staff() permite atualmente admin/gestor e profissionais A.T. específicos. Várias tabelas de RH e aprovisionamento usam esta função. Não se deve alargar esta função globalmente para incluir RH/Receção, pois isso pode expor dados de outras áreas.
5. A política de alertas SOS permite atualmente leitura por admin, gestor, operador e profissional; atualizações operacionais estão limitadas a admin, gestor e operador. RH e o novo perfil Receção precisam de regras deliberadas antes de serem ativados.
6. O ficheiro do Dashboard consultado não contém um módulo funcional identificável para o Centro de Suporte Informático nem para o agente IA. A pesquisa de texto no schema público não encontrou o rótulo “Centro de Suporte Técnico” nas tabelas consultadas; a origem exata da designação indicada ainda precisa de ser identificada. A regra de bloqueio de navegação está preparada, mas a separação de qualquer centro externo/API do agente ainda precisa de ser localizada e testada.
7. A tabela ciadi_funcionario_confidencial contém dados identificativos, bancários e salariais. A área RH criada na interface não apresenta essa tabela nem folhas salariais; o acesso a estes dados exige uma regra específica e auditável.

## Próxima fase obrigatória antes da homologação
- Preparar migração para os novos tipos de perfil (`suporte_informatica`, `rh`, `rececao`) e remover o perfil Gestor do fluxo operacional sem apagar/alterar dados históricos.
- Definir políticas RLS por tabela para Receção, RH e Suporte; não reutilizar permissões globais is_staff()/ciadi_finance_staff() para ampliar acessos.
- Definir operações autorizadas (leitura, criação, edição, aprovação, anulação) por módulo, especialmente caixa, faturação, documentos de funcionários, férias/licenças e alertas.
- Testar contas reais de cada perfil, acesso direto por URL, consultas Supabase, atualizações e registos de auditoria.
- Validar o agente IA e confirmar que o perfil Administrador não consegue abrir nem invocar o Centro de Suporte Informático.
- O backup automático do GitHub foi validado, mas cobre o repositório. Ainda não foi verificada uma cópia restaurável da base de dados Supabase; por isso, não aplicar migrações nem alterar RLS em produção até verificar esse backup de base de dados.

## Estado
Alterações de interface na branch; NÃO HOMOLOGADO. A aplicação de RLS e a ativação dos novos tipos de perfil permanecem pendentes.
