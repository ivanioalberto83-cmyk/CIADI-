# CIADI — homologação de segurança e reconciliação de migrations

## Resultado da inspeção adicional (2026-10-25)

- Supabase reporta histórico de migrations aplicado.
- A árvore `main` do repositório `CIADI-` contém 19 caminhos e não apresenta diretório `supabase/migrations` nem ficheiros SQL de migration; o repositório contém workflows e documentos. Portanto, ainda não existe neste repositório uma fonte versionada completa e verificável para gerar uma migration de correção com segurança.
- A view `v_ciadi_at_pacientes_atribuidos` devolve IDs de paciente/profissional, permissões e nomes.
- A view `v_ciadi_calendario_aniversarios` devolve nomes e datas de nascimento de pessoas ativas, além de flags de visibilidade. É necessário confirmar que as flags são aplicadas no consumo.
- Grants consultados: `anon` tem EXECUTE em `ciadi_registrar_acesso_validacao`, `ciadi_registrar_triagem_publica` e `ciadi_registrar_validacao_documento`. As três são SECURITY DEFINER.
- `ciadi_registrar_validacao_documento` devolve título/número/tipo/data do documento, assinatura e registo profissional, hashes e QR payload. Confirmar se cada campo é intencionalmente público.

## Gate de segurança — não avançar diretamente para DDL

1. Exportar o histórico completo de migrations e obter os SQL originais correspondentes ao ambiente CIADI.
2. Comparar funções, views, grants, policies e triggers com os commits versionados.
3. Identificar consumidores reais de cada RPC/QR e testar contrato de resposta.
4. Fazer snapshot de schema e backup restaurável antes de qualquer alteração em ambiente de homologação.
5. Aplicar apenas mudanças mínimas na homologação, com rollback que restaure as definições e grants anteriores.

## Matriz mínima de testes

| Caso | Resultado esperado |
|---|---|
| anon consulta diretamente tabelas clínicas | Negado por grants/RLS |
| triagem sem consentimento | Rejeitada |
| triagem com data futura ou payload excessivo | Rejeitada com erro controlado |
| rajada de triagens pelo mesmo origem/identificador | Limitada pelo controlo anti-abuso |
| código QR inválido/inativo | Resposta uniforme sem metadados clínicos |
| QR válido | Apenas os campos públicos formalmente aprovados |
| profissional sem atribuição tenta consultar paciente | Sem acesso |
| família tenta consultar outro assistido | Sem acesso |
| portal familiar/Clínica Virtual/validação documental | Sem regressões |

## Estado

Este documento regista observações de catálogo e um plano de homologação. Não contém migration executável e não alterou o projeto Supabase.
