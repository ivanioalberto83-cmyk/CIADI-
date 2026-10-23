# CIADI — QA da exportação PDF (homologação)

## Escopo
- Repositório: `ivanioalberto83-cmyk/CIADI-`
- Branch: `fix/faturacao-exportacao-pdf`
- Ficheiro: `CIADI_DASHBOARD_FINANCEIRO.html`
- Ambiente: homologação, apenas com dados fictícios.
- Produção: não alterada.

## Alterações desta etapa
1. O botão da pré-visualização passa a indicar explicitamente “Imprimir / Guardar como PDF”.
2. A janela do documento apresenta instruções para selecionar “Guardar como PDF” ou “Microsoft Print to PDF”.
3. A instrução explicativa é escondida no documento impresso.
4. O diálogo de impressão aguarda o carregamento das imagens e das fontes disponíveis antes de abrir.

## Testes estáticos executados
- [x] Confirmado que o antigo handler `window.onload` foi substituído.
- [x] Confirmado que existe handler `load` com espera por imagens e fontes.
- [x] Confirmadas instruções para guardar como PDF.
- [x] Confirmado que as instruções não aparecem no PDF impresso.
- [x] Confirmado que o rótulo do botão está atualizado.

## Testes funcionais pendentes em navegador
- [ ] Abrir uma fatura de teste já existente, sem dados reais.
- [ ] Confirmar que o pop-up abre; testar também o bloqueio de pop-ups.
- [ ] Confirmar que logótipo, emitente, cliente, linhas, impostos e totais aparecem.
- [ ] Selecionar “Guardar como PDF” e gravar o ficheiro numa pasta de teste.
- [ ] Abrir o PDF gravado e confirmar A4, margens, páginas, texto e valores.
- [ ] Repetir com fatura-recibo, nota de crédito e recibo de teste, se disponíveis.
- [ ] Confirmar que nenhuma emissão fiscal ou numeração oficial é consumida pelo teste.

## Limitação conhecida
Esta alteração usa o diálogo de impressão do navegador/sistema operativo para gerar PDF. Não implementa ainda descarregamento direto de um ficheiro PDF por JavaScript. Esse requisito só deve ser considerado concluído após validar a solução funcional no navegador e decidir se é necessária uma biblioteca PDF local, com dependências e licenças revistas.
