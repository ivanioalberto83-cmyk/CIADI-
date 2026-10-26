# CIADI — comunicação entre Dashboard e Sala Clínica

**Estado: risco identificado; correção ainda não aplicada.**

Data: 2026-10-26  
Ficheiro analisado: `CIADI_DASHBOARD_FINANCEIRO.html`

## Evidência

O listener global de mensagens aceita `CIADI_SALA_READY` sem comparar `event.origin` com a origem esperada nem confirmar que `event.source` corresponde à janela da Sala Clínica que foi aberta pelo Dashboard. A resposta envia o token de acesso usando `postMessage(..., '*')`.

O fluxo de abertura também usa `window.open(..., 'noopener')` e espera receber uma referência utilizável da janela. A combinação merece teste porque `noopener` pode impedir o retorno da referência da janela e interromper o fluxo de autenticação.

## Risco

Uma janela ou origem não autorizada pode tentar iniciar o handshake. A exposição real depende do contexto de origem, da política do navegador e do código da Sala Clínica. O achado deve ser tratado como um risco potencial de transmissão de credenciais, não como prova de exploração.

## Correção proposta

1. Definir e validar a origem exata permitida da Sala Clínica; nunca usar `*` para mensagens que transportam credenciais.
2. Confirmar que a mensagem vem da janela aberta pelo fluxo autorizado e que o agendamento está autorizado no servidor.
3. Rever o desenho de `window.open` e `noopener` para que a autenticação não dependa de uma referência que o navegador deliberadamente suprimiu.
4. Preferir uma sessão curta e limitada para a sala, validada no backend, em vez de enviar o access token geral do Dashboard, se a arquitetura existente permitir.
5. Testar janela legítima, origem externa, janela não registada, sessão expirada, agendamento inválido e tentativa de reutilização.
6. Não registar tokens nos logs nem em relatórios de diagnóstico.

## Limite desta alteração

Esta documentação não altera o código da Sala Clínica nem do Dashboard. A correção deve ser desenvolvida numa alteração separada, com teste de regressão da consulta de vídeo em homologação, antes de qualquer publicação.
