# CIADI — Inventário técnico da aplicação e do Setup

**Data:** 30/10/2026  
**Branch de referência:** `main`  
**Commit auditado:** `8530ceb4bc56f3905962ef7a8b3f1ad083e750b0`  
**Método:** leitura do GitHub e dos ficheiros do repositório; sem alterações ao código ou Supabase de produção.

## 1. Resumo executivo

O repositório contém um Dashboard funcional, mas a separação técnica por módulos ainda não está concluída. A aplicação principal está concentrada num único HTML com funções JavaScript inline. O pacote Windows é Electron + electron-builder/NSIS.

O repositório contém propostas em pull requests para perfis de estação, controlo de acessos, RH, polos, Aprovisionamento e Suporte. Estas propostas não devem ser confundidas com funcionalidades integradas em `main`.

## 2. Fontes e empacotamento observados

| Caminho | Responsabilidade observada |
|---|---|
| `CIADI_DASHBOARD_FINANCEIRO.html` | Fonte HTML do Dashboard utilizada pelo workflow |
| `index.html` | Cópia/versão paralela na raiz; exige regra de sincronização |
| `ciadi-windows/main.cjs` | Processo principal Electron, janelas, menu e actualizações |
| `ciadi-windows/preload.cjs` | Preload Electron |
| `ciadi-windows/package.json` | Electron, electron-builder, NSIS e lista de ficheiros do pacote |
| `ciadi-windows/biometric-k20pro.html` | Ferramenta local de homologação biométrica |
| `.github/workflows/ciadi-windows-setup.yml` | Cópia da fonte para `ciadi-windows/index.html`, geração de ícone e build Windows |

### Divergência documental

O workflow usa `CIADI_DASHBOARD_FINANCEIRO.html`, mas o README em `ciadi-windows/README.md` ainda menciona `CIADI_DASHBOARD_FINANCEIRO(1).html`. A regra de fonte única deve ser corrigida antes de alterar a estrutura.

O pacote Electron inclui o ficheiro `ciadi-windows/index.html`, não importa directamente os módulos a partir da raiz. Qualquer novo directório de scripts terá de ser incluído explicitamente no campo `build.files`.

## 3. Áreas e funções actualmente encontradas no Dashboard de main

A navegação actual inclui:

- Visão geral;
- Alertas SOS;
- Pedidos de triagem do site;
- Agendamentos clínicos;
- Financeiro;
- Facturação;
- Caixa & Tesouraria;
- Contabilidade;
- SAF-T(AO);
- Especialidades;
- Triagens;
- Pacientes & famílias;
- Profissionais;
- Documentos & Formulários Clínicos;
- Portal & famílias;
- Conteúdos do site;
- Conteúdos Multimédia;
- Marketing Digital;
- Janeth;
- Utilizadores;
- Instituição & redes;
- Empresas & Emitente;
- Clínica virtual;
- Auditoria;
- Acompanhantes Terapêuticos (A.T.).

As funções de navegação e apresentação são implementadas no mesmo HTML, incluindo `nav()`, `go()`, `visibleMenu()` e funções de cada área.

## 4. Áreas ainda não integradas em main

A auditoria do menu de `main` não encontrou entradas independentes para:

- Recursos Humanos;
- Aprovisionamento;
- Gestão de Polos;
- Centro de Suporte Informático.

Existem propostas em PRs abertas, mas a sua integração, esquema de dados e autorização têm de ser revistos individualmente.

## 5. Pull requests relacionados consultados

| PR | Conteúdo | Situação |
|---|---|---|
| #22 | Quatro perfis de estação e identificação da estação | Aberto; não integrado |
| #21 | Exigir novo login ao iniciar Dashboard | Aberto; não integrado |
| #20 | Auditoria e controlo de acessos, Suporte e RLS | Aberto; não integrado |
| #15 | RH, folha salarial, acessos por polo e Aprovisionamento | Aberto; não integrado |
| #12–13 | Cadastros comerciais, compras e contabilização | Abertos; não integrados |

### Observação crítica sobre PR #22

A PR #22 acrescenta uma selecção de estação (ADM, Suporte Informático, RH, Recepção) e uma matriz de menus associada ao perfil de estação. Isto identifica o posto e condiciona a navegação, mas não pode ser tratado como autorização. A arquitectura aprovada para o Setup único exige que os módulos disponíveis resultem da sessão autenticada, das permissões de servidor e do contexto de polo. A selecção de estação deve permanecer meramente informativa/operacional.

A PR #22 tem testes estáticos e um workflow de validação na sua branch. A execução bem-sucedida nessa branch não significa que a funcionalidade esteja em `main` ou que seja uma release homologada.

### Observação crítica sobre PR #20

A auditoria de acessos descreve perfis e políticas ainda não harmonizados: a constraint de `public.perfis.tipo` não aceitava todos os novos tipos propostos; funções como `is_staff()` e `ciadi_finance_staff()` têm semânticas diferentes e não devem ser alargadas globalmente para facilitar a navegação. A autorização precisa de ser definida por módulo, acção e âmbito, com políticas RLS específicas.

### Observação crítica sobre PR #15

RH e Aprovisionamento incluem propostas de tabelas/migrações e dependências de acesso por polo. Nenhuma migração branch-only deve ser considerada aplicada em produção. A tabela/estrutura de dados de fornecedores e o âmbito de centros de custo precisam de validação antes de consolidar o módulo.

## 6. Evidência de workflows em 30/10/2026

- Workflow de backup de `main`: run `41028752216`, conclusão `success`, commit `8530ceb4bc56f3905962ef7a8b3f1ad083e750b0`.
- Validação Windows de Setup: run `41028276195`, conclusão `success`, branch `fix/ciadi-setup-four-profiles-20261029`, commit `dbe43158a6b7b51490c9bcdf6afbfc18c29cc8c6`.
- Regressão dos perfis na branch #22: runs `41028284024` e `41028284025`, conclusão `success`.

A validação do Setup é evidência de compilação de homologação da branch indicada. Não equivale a merge em `main`, publicação de release, instalação testada em cada posto ou homologação de segurança.

## 7. Riscos técnicos prioritários

1. **Fonte duplicada:** `CIADI_DASHBOARD_FINANCEIRO.html` e `index.html` podem divergir; workflow e README também divergem quanto ao nome da fonte.
2. **Monólito:** navegação, serviços e módulos vivem no mesmo HTML; mudanças locais podem afectar áreas não relacionadas.
3. **Estação vs. permissão:** a matriz de menus da PR #22 pode restringir a experiência, mas não é controlo de segurança e não deve substituir permissões de utilizador.
4. **RLS e perfis:** constraints e funções existentes não estão harmonizadas com todos os perfis propostos.
5. **Escopo por polo:** nem todas as tabelas financeiras e operacionais têm uma coluna de polo/centro de custo consistente; não activar isolamento por UI antes de resolver o modelo de dados.
6. **Pacote Electron:** novos scripts e recursos precisam de inclusão explícita no pacote ASAR e de testes em `file://`.
7. **Dados confidenciais:** dados salariais, bancários e clínicos exigem permissões e consultas específicas.

## 8. Próximos passos técnicos

1. Corrigir a documentação e estabelecer uma única fonte oficial do Dashboard.
2. Criar testes de caracterização para os fluxos actualmente existentes.
3. Implementar o Core de autenticação/permissões/contexto sem alterar as políticas de produção.
4. Extrair os módulos um de cada vez, mantendo os mesmos identificadores de navegação durante a transição.
5. Harmonizar propostas de PR #15, #20 e #22 numa única arquitectura, sem fazer merge automático.
6. Só depois preparar alterações de schema/RLS numa branch separada e com backup restaurável validado.
