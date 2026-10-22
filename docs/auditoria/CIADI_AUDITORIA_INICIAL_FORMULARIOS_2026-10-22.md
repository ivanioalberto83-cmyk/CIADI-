# CIADI Dashboard — Auditoria inicial dos formulários
Data: 2026-10-22
Repositório: https://github.com/ivanioalberto83-cmyk/CIADI-
Branch de trabalho: audit/formularios-ciadi-2026-10-22
Base inspecionada: main, árvore Git SHA 001dd3962539772fcaa121a7cc86dc066e3c8c65
Método: inspeção estática do HTML e da configuração Electron/NSIS. Sem chamadas de escrita ao Supabase e sem alterações aos dados de produção.

## Achados confirmados por inspeção estática

1. O Dashboard é um HTML único (raiz `index.html`, também referenciado como `CIADI_DASHBOARD_FINANCEIRO.html`) servido por Electron; a configuração Windows usa Electron/NSIS e `electron-updater`.
2. O módulo “Documentos & Formulários Clínicos” já contém lista de formulários, criação de avaliações, Form Builder, documentos clínicos e publicação no Portal da Família. Não é necessário reconstruir estes módulos do zero.
3. O Form Builder aceita um JSON de schema e verifica se o JSON é sintaticamente válido, mas a inspeção não mostra validação estrutural completa das secções, campos, chaves duplicadas ou tipos de campo antes da gravação.
4. O renderizador de campos trata `select` e `radio` com o mesmo elemento HTML `select`; assim, campos configurados como radio não aparecem como botões de opção.
5. Campos `multiselect` são renderizados como caixas de seleção, mas o atributo obrigatório não é aplicado como validação de grupo. A validação de seleção mínima precisa de ser feita explicitamente.
6. `printClinicalEvaluation(id)` apenas chama `window.print()`; o parâmetro `id` não é usado para preparar um documento de impressão dedicado. É um defeito funcional a corrigir e testar.
7. O fluxo de avaliação usa tabelas separadas para avaliação, respostas e resultados. A gravação precisa de ser testada em caso de falha parcial entre estes passos, para evitar avaliações incompletas ou duplicadas.
8. A função de impressão de documento clínico encaminha para a pré-visualização, mas a inspeção estática não prova que todos os modelos e anexos gerem PDFs corretos em todas as máquinas.
9. O dashboard consulta tabelas clínicas e administrativas diretamente através do cliente Supabase. A autorização real depende também de RLS e de validações do servidor; esconder elementos no frontend não constitui controlo de acesso.
10. A documentação do workflow Windows diz que a compilação copia `CIADI_DASHBOARD_FINANCEIRO.html` para `ciadi-windows/index.html`, enquanto a árvore contém `index.html` e `CIADI_DASHBOARD_FINANCEIRO.html`. É necessário confirmar qual é a fonte canónica e testar o workflow antes de qualquer release.

## Escopo proposto para a próxima etapa

- Criar e validar schemas dos formulários com secções/campos/tipos suportados, chaves únicas e mensagens de erro claras.
- Renderizar corretamente texto, texto longo, número, data, data/hora, seleção única, radio, multisseleção e booleano.
- Reforçar validação obrigatória no cliente sem substituir validação/autorização no servidor.
- Corrigir a impressão de avaliação para imprimir apenas o documento selecionado, com cabeçalho CIADI, identificação mínima necessária, data, secções/respostas, observações e assinatura quando aplicável.
- Rever gravação da avaliação para lidar com falhas parciais e evitar duplicações.
- Mapear cada formulário às tabelas e permissões existentes antes de qualquer alteração SQL/RLS.
- Testar em dados fictícios e manter produção intacta até homologação.

## Limites desta auditoria

Esta é uma auditoria estática do código disponível no GitHub. Não foi executada a aplicação Windows, não foi autenticada uma sessão real, não foram executadas consultas à base de dados nem foram validadas políticas RLS. Os pontos dependentes de execução continuam pendentes de teste.
