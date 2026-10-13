# CIADI Dashboard — Plano integrado de correção, formulários e documentos

**Estado:** preparação estática / auditoria somente de leitura.  
**Projeto Supabase:** `egpkkttbcaukqnnxyhjv`.  
**Restrição:** não aplicar DDL/DML, não alterar políticas, funções ou dados de produção; não criar recursos pagos.

## Resultado confirmado na inspeção

As seis vistas abaixo permitem SELECT a `anon` e `authenticated` e não têm a opção `security_invoker=true` configurada:

- `v_ciadi_at_pacientes_atribuidos`
- `v_ciadi_lancamentos_contabeis`
- `v_ciadi_balancete`
- `v_ciadi_dre`
- `v_ciadi_balanco_patrimonial`
- `v_ciadi_calendario_aniversarios`

A inspeção das definições mostrou que as vistas de contabilidade leem movimentos e saldos; a vista de aniversários inclui nomes e datas de nascimento; a vista de atribuições inclui nomes de pacientes/profissionais e permissões. As políticas RLS existentes nas tabelas de origem não bastam, por si só, para garantir isolamento enquanto as vistas usam privilégios do proprietário.

**Não é evidência de acesso indevido.** É uma configuração de risco que deve ser corrigida após testar dependências.

## 1. Segurança das vistas — ordem de correção

1. Mapear chamadas destas seis vistas no dashboard, Edge Functions e RPCs.
2. Testar num ambiente de desenvolvimento já existente (não criar branch paga) uma opção de segurança:
   - `security_invoker=true` onde o RLS das tabelas de origem foi validado; e/ou
   - revogar SELECT direto de `anon` e `authenticated` e expor apenas uma RPC/Edge Function com autorização por perfil.
3. Não confiar apenas no papel `authenticated`: inclui pacientes, familiares e profissionais, não apenas gestão.
4. Não aplicar a correção à vista dependente sem testar também `v_ciadi_balancete` e `v_ciadi_dre`.
5. Fazer rollout só após testes aprovados e plano de reversão.

### Diagnóstico SQL somente de leitura

```sql
SELECT c.relname AS vista,
       c.reloptions,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname IN (
    'v_ciadi_at_pacientes_atribuidos',
    'v_ciadi_lancamentos_contabeis',
    'v_ciadi_balancete',
    'v_ciadi_dre',
    'v_ciadi_balanco_patrimonial',
    'v_ciadi_calendario_aniversarios'
  )
ORDER BY c.relname;
```

### Testes de aceitação

- Anónimo: não obtém dados de pacientes, aniversários nem contabilidade.
- Paciente/familiar: apenas dados autorizados pelo vínculo próprio.
- Profissional: apenas pacientes atribuídos e permissões clínicas necessárias.
- Operador/gestor/admin: apenas dados permitidos pela matriz de funções.
- Contabilidade: utilizadores sem permissão financeira não obtêm movimentos, saldos, DRE ou balanço.
- Regressão: dashboard, agenda, acompanhamento, relatórios e exportações continuam operacionais.

## 2. Contabilidade — validações mínimas

- Confirmar que cada lançamento contabilizado tem linhas e contas válidas.
- Confirmar total de débitos = total de créditos por lançamento e período.
- Comparar os totais da vista de lançamentos com os totais das linhas contabilísticas.
- Confirmar que balancete, DRE e balanço patrimonial filtram a empresa e período corretos.
- Testar anulação/estorno sem apagar histórico.
- Não declarar contas encerradas ou relatórios conformes sem reconciliação com dados reais autorizados.

## 3. Faturação e SAF-T Angola — estado e testes

A Edge Function `ciadi-saft-gerar` exige utilizador com permissão financeira e executa um diagnóstico antes da geração. O próprio código declara que valida XML bem-formado, mas **não executa validação XSD oficial**. Logo, não se deve afirmar conformidade SAF-T apenas porque o XML foi gerado.

Testes pendentes em dados de teste:
- NIF e identificação fiscal da empresa/software;
- séries, numeração, datas e integridade dos documentos;
- notas de crédito/débito ligadas ao documento de origem;
- taxas/códigos de imposto e motivos de isenção;
- pagamentos ligados aos documentos;
- igualdade de totais entre documentos, linhas e exportação;
- validação contra XSD oficial aplicável e revisão fiscal qualificada antes de produção.

## 4. Integração — testes de regressão

Executar, por perfil, login/logout, sessão expirada, navegação no dashboard, consulta de paciente atribuído, criação/consulta de agendamento, gravação de acompanhamento, geração de documento, faturação/pagamento, relatórios financeiros e exportação SAF-T. Verificar respostas 401/403, logs sem dados clínicos desnecessários e ausência de chaves de serviço no frontend.

A Edge Function `ciadi-saft-gerar` está configurada com verificação JWT e valida também a permissão financeira. A função `ciadi-indexacao-auto` tem JWT desligado por desenho, pelo que deve manter autenticação própria por segredo/serviço ou perfil admin/gestor; testar rotação do segredo e rejeição de pedidos não autorizados sem imprimir segredos nos logs.

## 5. Backup e recuperação

- **Código:** workflow de backup do GitHub já tem uma execução bem-sucedida registada; o artefacto é cópia do repositório, não da base de dados nem do Storage.
- **Base de dados:** confirmar plano Supabase e método gratuito disponível; produzir exportação consistente de esquema e dados autorizados, guardada fora do repositório público.
- **Storage:** inventariar objetos e preparar cópia dos ficheiros e metadados; buckets públicos e privados devem conservar as respetivas permissões.
- **Recuperação:** restaurar numa base de teste isolada, validar contagens, relações, políticas RLS, funções e ficheiros; registar duração e limitações.
- Nunca incluir dados clínicos reais, tokens ou segredos num artefacto público do GitHub.

## 6. Formulários e documentos — auditoria e testes

Esta frente cobre os formulários clínicos, administrativos e financeiros do Dashboard, sem substituir avaliação profissional nem alterar dados clínicos em produção durante a auditoria.

### Formulários a inventariar e validar

- Ficha de pré-atendimento / triagem.
- Ficha de avaliação e diagnóstico clínico, com acesso limitado aos profissionais autorizados.
- Acompanhamento clínico e evolução.
- Formulário ABC e acompanhamento ABA, com acesso familiar limitado aos registos expressamente autorizados.
- Registos de consulta e encaminhamento por especialidade.
- Consentimentos e autorizações do responsável, incluindo autorização para partilha de documentos.
- Formulários administrativos: pacientes/famílias, profissionais, equipas, agendamentos e recrutamento, conforme existam no Dashboard.
- Formulários financeiros: faturação, pagamentos, recibos, notas de crédito/débito e dados fiscais.

### Documentos a inventariar e validar

- Relatório de avaliação, plano de intervenção e relatório de acompanhamento.
- Ficha clínica e resumo de consulta.
- Documento de consentimento/autorização.
- Fatura, recibo, nota de crédito/débito e exportação SAF-T.
- PDF para impressão, com cabeçalho/rodapé CIADI, identificação necessária, data, paginação e espaço de assinatura quando aplicável.
- Cópia digital partilhada por e-mail ou WhatsApp apenas após autorização explícita e validação do destinatário.

### Testes de aceitação

- Cada formulário guarda, consulta e atualiza o registo correto, sem duplicação inesperada.
- Campos obrigatórios, formatos, datas e relações com paciente, responsável, profissional, especialidade e agendamento são validados.
- A autorização é verificada no servidor; esconder um botão no frontend não conta como controlo de acesso.
- Paciente/família não consegue abrir fichas clínicas de terceiros nem campos internos reservados ao profissional.
- Profissional só cria/consulta documentos dos pacientes e atendimentos que lhe estão atribuídos.
- PDF/ impressão mantém os dados corretos e não inclui campos internos indevidos.
- E-mail/WhatsApp não envia automaticamente sem confirmação do utilizador; erros de envio são apresentados sem expor dados clínicos em logs.
- Documentos emitidos mantêm histórico, data, autor e ligação ao registo de origem; correções financeiras usam estorno/documento retificativo em vez de apagar o histórico.
- Anexos são armazenados em bucket privado, com políticas de acesso testadas e links temporários quando apropriado.
- Testar criação, leitura, edição, atualização, impressão, download e falhas de rede em cada perfil autorizado.

### Entregável necessário antes de corrigir

Criar uma matriz **formulário/documento × perfil × ação** (ver, criar, editar, assinar, imprimir, descarregar, partilhar e eliminar/retificar). Nenhuma permissão de eliminação ou partilha deve ser presumida. Mapear cada formulário às tabelas, funções, vistas, buckets e páginas que o utilizam antes de modificar código ou políticas.

## Critério de conclusão

Uma frente só fica marcada como **resolvida** depois de: correção aplicada no ambiente autorizado, testes de regressão aprovados, verificação independente dos resultados e plano de reversão disponível. Este documento não aplica nenhuma alteração à produção.
