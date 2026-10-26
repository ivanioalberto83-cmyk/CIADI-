# CIADI Dashboard — Auditoria inicial dos formulários
Data: 2026-10-22
Repositório: https://github.com/ivanioalberto83-cmyk/CIADI-
Branch de trabalho: audit/formularios-ciadi-2026-10-22
Base inspecionada: main, árvore Git SHA 001dd3962539772fcaa121a7cc86dc066e3c8c65
Implementação de correções iniciais: commit cd6776401f28f30c98c4e5c35108595ce1fd3b84
Método: inspeção estática do HTML e da configuração Electron/NSIS. Sem chamadas de escrita ao Supabase e sem alterações aos dados de produção.

## Arquitetura identificada

O Dashboard é um HTML principal servido por Electron. O pacote Windows usa Electron/NSIS e electron-updater. O módulo “Documentos & Formulários Clínicos” já contém lista de formulários, criação de avaliações, Form Builder, documentos clínicos e publicação no Portal da Família; a estratégia é corrigir e completar os módulos existentes, sem reescrever a aplicação.

## Achados e correções já preparadas na branch

1. **Campos radio:** o renderizador tratava `select` e `radio` como uma lista suspensa. Corrigido para gerar botões de opção para o tipo `radio`, mantendo a lista suspensa para `select`.
2. **Impressão de avaliação:** a função ignorava o identificador e chamava a impressão geral da página. Corrigida para carregar a avaliação selecionada e as respostas, montar uma folha de impressão própria com cabeçalho CIADI, paciente, profissional, data, versão, respostas, observações, conclusão, plano de seguimento e espaço de assinatura.
3. **Multisseleção obrigatória:** adicionada validação no modal para exigir pelo menos uma opção nos grupos `multiselect marked como obrigatórios.
4. **Form Builder:** adicionada validação do schema antes da gravação: pelo menos uma secção, `fields[]` por secção, chaves não vazias e únicas, tipos suportados e opções para campos `select`, `radio` e `multiselect`.
5. **Segurança:** as alterações estão numa branch separada. Não foram alterados dados, tabelas, políticas RLS, funções nem configuração de produção do Supabase.

## Riscos e validações pendentes

- A validação do schema é feita no frontend; deve ser complementada por validação/autorização no servidor quando suportada pelo desenho existente.
- A gravação da avaliação usa tabelas separadas para avaliação, respostas e resultados. Testar falhas parciais e prevenir registos incompletos ou duplicados.
- Rever permissões por perfil e acesso aos pacientes atribuídos; ocultar botões no frontend não é controlo de acesso.
- A impressão criada foi verificada por inspeção estática, mas ainda precisa de teste real em navegador/Windows com diferentes tamanhos de avaliação.
- O workflow Windows deve ser executado para validar compilação e instalador. Não foi publicado Setup.exe nem criada release.
- Não foram executados login real, testes com Supabase, testes RLS, testes de PDF ou testes automatizados do JavaScript nesta etapa.

## Próxima etapa de homologação

1. Compilar a aplicação Windows de teste a partir desta branch, sem publicar em produção.
2. Testar com dados fictícios: criação de formulário válido/inválido, chaves duplicadas, campo radio, multisseleção obrigatória, gravação/consulta de avaliação, impressão e sessão expirada.
3. Testar cada perfil e verificar que não consegue ler ou alterar pacientes/documentos não autorizados.
4. Corrigir defeitos encontrados e só depois preparar PR/merge e eventual release.
5. Não executar DDL/DML nem alterar políticas de produção sem backup verificado, migração versionada, plano de reversão e autorização explícita.

## Limites

A auditoria é estática e as correções ainda não foram homologadas em execução. A branch não deve ser considerada pronta para produção até os testes acima passarem.
