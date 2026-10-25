# Evidências e plano de testes de segurança — CIADI
Data: 2026-10-25
Branch: security/remediation-2026-10
Estado: auditoria read-only; sem alterações à base de dados.

## Evidências consultadas no Supabase
- `public.v_ciadi_at_pacientes_atribuidos` usa joins entre atribuições, pacientes e profissionais e foi sinalizada como SECURITY DEFINER. Um teste anterior com role anon observou duas linhas. Tratar como exposição potencial até teste de autorização controlado; não foi feita extração de dados pessoais.
- `public.v_ciadi_calendario_aniversarios` inclui nome de exibição e data de nascimento de pessoas ativas; foi sinalizada como SECURITY DEFINER. Confirmar se visibilidade e consentimentos são aplicados ao consumidor e ao acesso SQL.
- `ciadi_registrar_triagem_publica` é SECURITY DEFINER e tem EXECUTE para anon/authenticated. Grava nome da criança, data de nascimento, responsável, telefone, email, diagnóstico e comportamentos em `ciadi_triagens`; exige consentimento true. Não foi confirmada proteção contra abuso/rate limiting no corpo SQL.
- `ciadi_registrar_acesso_validacao` é SECURITY DEFINER e executável por anon; pesquisa código e incrementa contagem de acesso.
- `ciadi_registrar_validacao_documento` é SECURITY DEFINER e executável por anon; rever campos devolvidos e resistência à enumeração.
- Edge Function `ciadi-recrutamento-consulta` está ativa com `verify_jwt=false`, valida formato `CIADI-[A-F0-9]{8}` e consulta com service role. O código observado não apresenta rate limiting explícito.

## Alterações a preparar (não executar nesta fase)
1. Vistas: preparar mudança para SECURITY INVOKER onde compatível com versão PostgreSQL e RLS, ou retirar acesso direto e expor RPC autorizada; validar consumidores antes de mexer em grants.
2. Triagem: manter fluxo público necessário, mas adicionar mitigação de abuso (rate limiting no servidor/gateway, CAPTCHA se compatível, limites de tamanho/valores, respostas de erro sem detalhe interno, auditoria de consentimento). Não registar dados clínicos em logs.
3. Validação de documentos/candidaturas: gerar códigos com entropia alta em novos registos; aplicar limite de tentativas; respostas uniformes para inválido/inexistente; devolver somente dados mínimos.
4. RPCs: rever grants por função e remover EXECUTE apenas após confirmar todos os consumidores legítimos. Não alterar `finance_bloquear_alteracao_fiscal` sem inspecionar triggers/fluxo fiscal.
5. `ciadi-indexacao-auto`: verificar autenticação própria e segredo de cron; manter `verify_jwt=false` apenas se o endpoint usar controlo forte independente de JWT.

## Testes de aceitação obrigatórios
- anon não consegue ler pacientes, aniversários identificáveis nem atribuições clínicas diretamente.
- triagem pública só aceita campos válidos e consentimento afirmativo; abusos repetidos são limitados.
- profissional/responsável vê apenas dados ligados ao seu perfil.
- códigos inválidos e válidos não permitem enumeração prática; resposta só contém dados mínimos.
- regressão: triagem, validação QR, documentos clínicos, portal da família, sala virtual e fluxo fiscal.
- backup não vazio, checksum e restauro em ambiente não produtivo antes de migração.

## Bloqueio atual
O repositório principal não contém uma pasta `supabase/migrations` confirmada. Não criar uma migration SQL operacional até existir uma fonte versionada clara e até comparar as migrações existentes com as definições atuais. Nenhuma alteração de produção foi executada.
