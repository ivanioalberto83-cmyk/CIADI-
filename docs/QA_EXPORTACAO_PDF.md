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


## Identidade visual CIADI — documentação

- [x] Logótipo oficial incorporado na pré-visualização A4 de faturação, substituindo o texto simples “CIADI”.
- [x] Função comum `printBase()` usa o mesmo logótipo incorporado para comprovativos, fichas clínicas, triagem e outros documentos encaminhados por essa função.
- [x] Cabeçalho documental padronizado com logótipo, nome institucional, contactos e linha institucional laranja.
- [ ] Teste visual real em navegador e PDF exportado continua pendente.
- [ ] RH e Aprovisionamento: os módulos não constam do menu nem da implementação atual deste Dashboard. Não se deve afirmar que os documentos desses módulos já foram alterados. Quando forem implementados, devem reutilizar o mesmo cabeçalho e `CIADI_LOGO_DATA_URI`, sem duplicar ou substituir o logótipo por texto.

**Regra para os próximos módulos:** toda a documentação imprimível/exportável (faturas, faturas-recibo, recibos, notas de crédito, formulários clínicos, RH e aprovisionamento) deve incluir o logótipo CIADI, identificação institucional, contactos, data de emissão e paginação adequada. Em documentos clínicos, manter a indicação de confidencialidade quando aplicável.


## Correção adicional — bloqueio de pop-up

- [x] A janela de impressão da faturação é aberta sincronamente no clique do utilizador, antes das consultas ao Supabase.
- [x] A janela previamente aberta é reutilizada por `printBase()` para escrever o documento depois de os dados serem carregados.
- [x] Em caso de erro na consulta, a janela apresenta uma mensagem em vez de ficar em branco.
- [x] Verificações estáticas do código confirmam a abertura antecipada e a passagem da janela para a função de impressão.
- [ ] O comportamento real ainda precisa de teste em Chrome/Windows com dados fictícios; esta verificação não foi possível através da inspeção do repositório.
