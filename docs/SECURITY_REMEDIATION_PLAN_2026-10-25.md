# Plano de remediação de segurança — CIADI
Data: 2026-10-25
Estado: preparação em branch; nenhuma alteração na produção.

## Objetivo
Corrigir os riscos confirmados pela auditoria Supabase sem alterar dados, funcionalidades ou políticas em produção até validação em homologação.

## Findings prioritários
1. Rever as vistas `public.v_ciadi_at_pacientes_atribuidos` e `public.v_ciadi_calendario_aniversarios`, ambas sinalizadas como SECURITY DEFINER. O teste anterior observou duas linhas na primeira vista quando executada como role anon; não foram extraídos nem publicados dados pessoais. Confirmar a necessidade da semântica definer, permissões de SELECT e aplicação de autorização por utilizador.
2. Rever as funções RPC públicas `ciadi_registrar_acesso_validacao`, `ciadi_registrar_triagem_publica`, `ciadi_registrar_validacao_documento` e `finance_bloquear_alteracao_fiscal`. Não revogar EXECUTE de forma indiscriminada: confirmar primeiro os consumidores legítimos e, quando aplicável, limitar grants às roles necessárias.
3. Endurecer `ciadi-recrutamento-consulta`: substituir o código de baixa entropia por identificador não enumerável, adicionar rate limiting, respostas consistentes e limitar os campos devolvidos. Não expor nomes, contactos ou anexos.
4. Confirmar autenticação e autorização em `ciadi-indexacao-auto`, incluindo validação do segredo de cron e gestão segura do segredo; nunca aceitar a service-role key enviada pelo cliente como credencial de chamada.
5. Rever as funções SECURITY DEFINER autenticadas por domínio (clínica, família, SOS, sala de vídeo, caixa e fiscal), priorizando verificação do utilizador atual, papel, vínculo ao paciente/instituição, validação de IDs fornecidos e search_path seguro.

## Testes obrigatórios
- Role anon: não consegue consultar dados clínicos, aniversários identificáveis ou dados internos.
- Paciente/responsável/profissional: só acede aos registos autorizados pelo vínculo e função.
- Códigos de candidatura: código válido consulta apenas estado mínimo; códigos inválidos não permitem enumeração prática; limite de tentativas verificado.
- RPCs: testar chamadas sem sessão, com sessão de papel insuficiente e com IDs de outro paciente.
- Regressão: triagem pública, candidatura, formulários clínicos, Clínica Virtual, SOS e faturação.
- Backup: confirmar cópia não vazia, checksum e restauro num ambiente não produtivo antes de migrações.

## Sequência segura
1. Inspecionar migrations e consumidores no código.
2. Escrever migrations pequenas e reversíveis nesta branch.
3. Executar testes automatizados com dados fictícios em projeto de homologação.
4. Rever diff, permissões e regressão.
5. Criar PR para revisão; não fazer merge nem deploy sem aprovação explícita.
6. Após aprovação, backup verificado, janela de manutenção, plano de rollback e verificação pós-deploy.

## Restrições
- Não executar alterações DDL, grants, políticas RLS, deploy de Edge Functions ou migrações em produção durante esta fase.
- Não usar dados reais de pacientes em testes.
- Não declarar incidente/exploração sem evidência.
- Toda correção deve preservar a estrutura existente e ter rollback documentado.
