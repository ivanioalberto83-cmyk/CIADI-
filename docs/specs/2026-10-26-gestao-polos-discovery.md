# CIADI — Auditoria read-only para Gestão de Polos

- **Data:** 2026-10-26
- **Projeto Supabase:** `egpkkttbcaukqnnxyhjv`
- **Estado:** auditoria parcial concluída; nenhum dado alterado.
- **Objectivo:** identificar o centro de custo existente e mapear dependências antes de desenhar qualquer migração de polos.

## 1. Resultado principal: centro de custo existente ainda não identificado

A introspecção de esquema confirmou que `public.finance_centros_custo` existe, tem RLS activo e reporta **1 registo**. A ferramenta de listagem não devolveu os valores do registo (código, nome, descrição, empresa e estado). Uma tentativa anterior de consulta SQL de leitura foi bloqueada por controlos de segurança. Não foi usada uma via alternativa para contornar esse bloqueio.

**Decisão aplicada:** não associar o registo existente a nenhum polo até que o seu conteúdo e finalidade sejam confirmados. Não inserir os códigos 1012 ou 1013 na base de dados durante esta fase.

## 2. Esquema confirmado

| Tabela | Contagem indicada | RLS | Observações relevantes |
|---|---:|---|---|
| `public.finance_centros_custo` | 1 | activo | `id` UUID PK; `codigo` e `nome` obrigatórios; `descricao` opcional; `ativo` boolean; `empresa_id` UUID opcional; sem FK listada nesta tabela. |
| `public.finance_despesas` | 0 | activo | `centro_custo` é texto livre; `empresa_id` tem FK para `finance_empresas`; não há FK para `finance_centros_custo`. |
| `public.agendamentos` | 4 | activo | Tem referências para paciente, profissional, especialidade, serviço e triagem; não tem coluna directa de polo. |
| `public.ciadi_triagens` | 0 | activo | Tem referências para paciente, profissional, especialidade, serviço e agendamento; não tem coluna directa de polo. |
| `public.ciadi_sos_alertas` | 0 | activo | Tem referências para perfil, paciente e utilizador que atendeu; não tem coluna directa de polo. |
| `public.ciadi_at_sessoes` | 0 | activo | Tem referências para atribuição, paciente, profissional A.T. e agendamento; não tem coluna directa de polo. |
| `public.pacientes` | 3 | activo | Não tem coluna directa de polo. |
| `public.profissionais` | 5 | activo | Tem referências para perfil e especialidade; não tem coluna directa de polo. |
| `public.perfis` | 9 | activo | O campo `tipo` admite `admin`, `gestor`, `profissional`, `paciente`, `responsavel` e `operador`. |

As contagens são as reportadas pela introspecção de metadados, não uma reconciliação contabilística nem uma validação de integridade dos dados.

## 3. Decisões confirmadas pelo utilizador

- **Centro de custo actual:** identificar primeiro; não associar ainda.
- **Cardinalidade:** cada polo terá um único centro de custo principal.
- **POLO TALATONA:** código 1012; localização fornecida: TALATONA RUA DO CENTRO LOGÍSTICO.
- **POLO JARDIM DE ROSAS:** código 1013; localização de referência fornecida: Condomínio Jardim de Rosas, Talatona, Luanda; confirmar a designação operacional exacta antes do registo.
- Nenhuma migração, alteração de registos ou alteração de permissões está autorizada por esta auditoria.

## 4. Revisão de segurança observada

O Security Advisor devolveu, na consulta de 2026-10-26:

- **2 alertas ERROR** para views SECURITY DEFINER: `public.v_ciadi_at_pacientes_atribuidos` e `public.v_ciadi_calendario_aniversarios`.
- **4 alertas WARN** para funções SECURITY DEFINER executáveis por `anon`: `ciadi_registrar_acesso_validacao`, `ciadi_registrar_triagem_publica`, `ciadi_registrar_validacao_documento` e `finance_bloquear_alteracao_fiscal`.
- **79 alertas WARN** para funções SECURITY DEFINER executáveis por `authenticated`.

Estes alertas não provam, por si só, uma vulnerabilidade explorável em cada objecto; exigem revisão individual de propósito, corpo, privilégios, `search_path`, identidade e autorização. Não revogar permissões em massa nem alterar estas funções como parte da gestão de polos.

## 5. Limitações e próximos passos seguros

1. Obter uma via autorizada para visualizar apenas os campos não sensíveis do único centro de custo — pelo painel Supabase, ou através de uma consulta read-only autorizada. Não contornar o bloqueio do executor SQL.
2. Rever as políticas RLS exactas das tabelas relevantes e as dependências de views, funções e relatórios financeiros. A listagem de esquema confirmou RLS activo, mas não devolveu o conteúdo das políticas.
3. Confirmar a localização operacional exacta do Polo Jardim de Rosas e que papéis podem atribuir utilizadores/profissionais a polos.
4. Aprovar quais tabelas operacionais serão associadas a polos na primeira fase e como tratar despesas históricas sem centro de custo relacional.
5. Só então preparar uma migração versionada e reversível para ambiente não produtivo. Exigir backup recuperável, revisão SQL, testes de RLS e aprovação específica antes de qualquer execução em produção.

## 6. Declaração de não alteração

Esta auditoria usou apenas listagem de metadados/esquema, histórico de migrações e Security Advisor. Não inseriu, actualizou ou apagou registos; não criou tabelas; não aplicou migrações; não alterou RLS; não publicou nem instalou qualquer artefacto.
