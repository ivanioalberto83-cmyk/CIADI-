# CIADI — Arquitetura de Setup único com seleção de módulos

**Estado:** proposta técnica aprovada para desenvolvimento; não implementada nem homologada.  
**Branch:** `feature/ciadi-compras-contabilidade-integrada`  
**Objetivo:** manter um único `CIADI-Setup.exe` e permitir ao técnico escolher os módulos a instalar, sem criar bases de dados separadas por polo.

## 1. Opções no instalador

O assistente NSIS deverá apresentar caixas de seleção:

- **CIADI ADM** — ferramentas de administração, gestão de acessos, auditoria, relatórios consolidados e monitorização.
- **CIADI Comercial** — ferramentas de faturação e operação comercial autorizadas, incluindo clientes, serviços, documentos, pagamentos, despesas, compras e caixas.
- **CIADI Completo (ADM + Comercial)** — instala ambos os conjuntos de ferramentas para computadores técnicos ou autorizados.

A opção por omissão deve ser a instalação mínima apropriada, não a concessão automática de privilégios. O instalador deve explicar que a seleção determina componentes/atalhos disponíveis no computador, e não o nível de autorização do utilizador.

## 2. Comportamento depois da instalação

- Um pacote e uma linha de atualização mantêm a distribuição simples.
- O menu e a interface são montados conforme os módulos instalados, mas o servidor continua a validar todas as permissões.
- Após autenticação, o utilizador só pode escolher entre os polos para os quais tem associação ativa: CIADI Polo Talatona e CIADI Polo Jardim de Rosas.
- A Direção/Administração pode consultar dados consolidados apenas quando a conta tiver autorização explícita.
- Um computador com instalação Completa não concede automaticamente acesso a funções ADM; um computador Comercial não pode contornar as permissões do servidor.

## 3. Fonte de verdade e isolamento

- Os dois polos utilizam o mesmo projeto Supabase e o mesmo modelo de dados central, com identificação consistente do centro de custo.
- A segurança deve ser imposta no servidor/RLS e validada em cada operação. Ocultar menus, criar atalhos diferentes ou escolher módulos no NSIS não é uma fronteira de segurança.
- Antes de ativar o seletor de polo, é necessário auditar as políticas atuais, as relações entre documentos, pagamentos, despesas, caixa e centro de custo, e preparar migrações compatíveis com rollback.
- Não incluir chaves `service_role`, segredos ou credenciais administrativas no pacote Windows ou no HTML.
- Não aplicar migrações, alterar políticas, reclassificar dados históricos nem modificar produção sem backup, validação e autorização explícita.

## 4. Sincronização

A base central é a fonte de verdade. Se o modo offline for suportado, as operações locais precisam de identificadores UUID estáveis, fila de sincronização, idempotência, estado pendente/sincronizado/erro e tratamento explícito de conflitos. Documentos fiscais e pagamentos não podem ser duplicados por uma repetição de sincronização.

## 5. Plano de implementação

1. Rever o `ciadi-windows/package.json`, o `main.cjs`, o HTML efetivamente empacotado e o workflow `.github/workflows/ciadi-windows-setup.yml`.
2. Corrigir/confirmar a fonte de HTML usada pelo workflow: atualmente o workflow procura `CIADI_DASHBOARD_FINANCEIRO.html` na raiz e copia-a para `ciadi-windows/index.html`. O `package.json` empacota `ciadi-windows/index.html`; o `README.md` contém referência diferente a `CIADI_DASHBOARD_FINANCEIRO(1).html`. Esta divergência deve ser resolvida e testada antes de compilar.
3. Implementar a página de seleção NSIS para ADM, Comercial ou Completo e definir componentes/atalhos de forma reversível.
4. Separar a visibilidade dos módulos na interface, sem substituir autorização no servidor.
5. Completar o desenho e os testes de isolamento dos polos e permissões antes de ativar operações de produção.
6. Executar testes de instalação, atualização, desinstalação preservando dados, autenticação, permissões, sincronização, faturação, pagamentos, caixa, compras e relatórios.
7. Compilar em Windows e verificar o executável, versão, hash e logs do workflow; só então disponibilizar o Setup de teste. Não publicar uma release de produção sem homologação.

## 6. Critérios de aceitação

- Existe apenas um instalador distribuído, com seleção explícita de módulos.
- As três opções instalam os componentes e atalhos esperados.
- A escolha de módulos não aumenta privilégios da conta autenticada.
- Utilizadores de cada polo não conseguem ler nem alterar operações do outro polo, inclusive por chamadas diretas ao Supabase.
- A Direção só vê relatórios consolidados quando autorizada.
- A atualização não apaga dados locais; a desinstalação mantém dados por omissão.
- A sincronização repetida não duplica documentos, pagamentos ou movimentos.
- O artefacto final foi compilado e testado; documentação ou código no GitHub, por si só, não contam como Setup validado.

## 7. Estado atual conhecido

A estrutura existente utiliza Electron e electron-builder/NSIS, e há um workflow de GitHub Actions para compilar `CIADI-Setup-${version}.exe`. A configuração atual não demonstra ainda uma página de seleção de módulos. O workflow e o pacote precisam de ser alinhados e testados. Este documento não declara que o Setup com seleção já foi implementado ou compilado.
