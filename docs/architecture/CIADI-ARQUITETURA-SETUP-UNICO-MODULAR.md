# CIADI — Arquitetura do Setup único e modular

**Data da auditoria:** 30/10/2026  
**Base observada:** `main` — commit `8530ceb4bc56f3905962ef7a8b3f1ad083e750b0`  
**Branch de trabalho:** `architecture/ciadi-setup-unico-modular-20261030`  
**Estado:** desenho técnico e inventário; não implementado, não homologado e não publicado.

## 1. Decisão arquitectural

O CIADI terá **um único Setup Windows** e uma única aplicação institucional. Os módulos serão componentes independentes da aplicação, apresentados conforme a identidade autenticada, as permissões efectivas e o contexto operacional autorizado.

A selecção de estação no instalador é apenas uma preferência/identificação local. Não é uma função de segurança, não atribui papéis e não substitui a autorização do Supabase. A escolha do polo de trabalho é igualmente distinta da identidade do utilizador e da sua autorização.

## 2. Estado actual confirmado em `main`

- O Dashboard está concentrado em `CIADI_DASHBOARD_FINANCEIRO.html` (cerca de 229 KB), com funções e navegação inline.
- `index.html` existe na raiz, mas o workflow Windows usa `CIADI_DASHBOARD_FINANCEIRO.html` como fonte e copia-o para `ciadi-windows/index.html`.
- O pacote Electron/NSIS está em `ciadi-windows/`; `main.cjs` abre o Dashboard e a página local de homologação biométrica.
- `package.json` empacota `index.html`, `main.cjs`, `preload.cjs`, `package.json`, `electron-updater` e `biometric-k20pro.html`.
- O menu actual contém áreas clínicas, financeiras, institucionais, SOS e auditoria; não contém ainda módulos RH, Aprovisionamento, Polos ou Suporte como áreas independentes no `main`.
- Não existe ainda uma camada comum formal de módulos, autorização por acção e contexto de polo.

## 3. Arquitectura lógica de destino

### 3.1 Shell e Core

O Shell é responsável por iniciar a aplicação, apresentar o utilizador e construir a navegação a partir do manifesto de módulos.

O Core terá responsabilidades separadas:

| Serviço | Responsabilidade |
|---|---|
| `AuthService` | Sessão Supabase, entrada, saída e renovação |
| `ProfileService` | Leitura do perfil activo e dados de identidade |
| `PermissionService` | Consultar autorização por módulo/acção; negar por defeito |
| `PoloContextService` | Resolver polo de origem, polo activo e representação |
| `ModuleRegistry` | Registar módulos, dependências e pontos de entrada |
| `AuditService` | Registar operações relevantes sem expor dados clínicos desnecessários |
| `SyncService` | Coordenar estado online/offline, fila e reconciliação idempotente |

As funções do browser servem para experiência de utilização. A segurança efectiva permanece nas políticas RLS, RPCs e serviços de servidor. Uma verificação no menu ou no dispatcher nunca substitui a autorização da base de dados.

### 3.2 Manifesto de módulos

Cada módulo deve declarar, no mínimo:

- `id` estável e único;
- nome e área institucional;
- ponto de entrada;
- permissões necessárias por acção;
- dependências explícitas;
- rotas/identificadores de navegação;
- capacidade de funcionamento online/offline, quando aplicável;
- estado de disponibilidade: activo, em homologação ou indisponível.

O manifesto não pode conter credenciais, chaves privilegiadas ou regras que concedam acesso por si só.

### 3.3 Módulos institucionais

| Módulo | Âmbito funcional |
|---|---|
| Administração | Direcção, configurações institucionais, utilizadores, auditoria e indicadores consolidados |
| Clínica | Assistidos, famílias, profissionais, especialidades, triagens, agendamentos, avaliações, documentos clínicos e clínica virtual |
| Financeiro | Clientes, documentos, facturação, recebimentos, caixa, bancos, despesas, contabilidade, activos e SAF-T(AO) |
| RH | Funcionários, contratos, assiduidade, férias/licenças, formação, avaliações, competências e benefícios |
| Aprovisionamento | Requisições, aprovações, compras/cotações, recepção, stock, inventário, património e distribuição |
| Polos | Cadastro e estado dos polos, responsáveis, centros de custo, associação de colaboradores e indicadores autorizados |
| SOS | Recepção, triagem operacional, estado e histórico de alertas |
| Comunicação | Conteúdos do site, galeria, multimédia, campanhas e contactos com consentimento |
| Recepção | Atendimento, pedidos recebidos, agenda e encaminhamento autorizado |
| Suporte Informático | Diagnóstico, pedidos técnicos e assistência controlada, sem poderes administrativos implícitos |

A separação funcional não implica duplicar tabelas ou criar dez aplicações. Cada módulo deve reutilizar serviços comuns e as estruturas existentes quando estas forem adequadas.

## 4. Identidade, estação e autorização

São três conceitos distintos:

1. **Identidade/perfil autenticado:** quem é o utilizador e qual o seu perfil activo no Supabase.
2. **Estação instalada:** identificação operacional local escolhida no Setup (por exemplo ADM, RH, Recepção ou Suporte). Esta opção não concede permissões.
3. **Contexto de trabalho:** polo no qual a operação está a ser executada, incluindo representação autorizada.

A autorização deve ser avaliada por utilizador, módulo, acção e âmbito de dados. O modelo recomendado é negar por defeito e permitir apenas acções explicitamente concedidas. A matriz definitiva de papéis e acções exige validação institucional e técnica; não se deve inferir que um nome de perfil concede acesso a todas as tabelas de um departamento.

## 5. Contexto de polos

O contexto de sessão deverá distinguir:

- `origin_polo_id`: associação de origem do colaborador;
- `active_polo_id`: polo de trabalho seleccionado para a sessão;
- `representation_polo_id`: polo em nome do qual trabalha, quando aplicável;
- `context_reason`: motivo ou referência da representação, quando a política institucional o exigir.

Exemplo: um colaborador associado a Jardim de Rosas pode iniciar sessão nesse local e seleccionar Talatona como polo de trabalho em representação, se essa associação estiver autorizada. A operação não altera a associação de origem do colaborador.

A selecção deve ser limitada aos polos autorizados. A alteração do contexto deve ser auditável. Os registos operacionais devem obter o âmbito do contexto validado no servidor, não confiar num identificador enviado livremente pelo browser.

Não assumir que o código textual do centro de custo é a chave de segurança. A associação entre polo, empresa e centro de custo deve ser confirmada no schema e nas relações reais antes de qualquer migração.

## 6. Estrutura de código proposta

A estrutura abaixo é um destino incremental, não corresponde ainda a pastas existentes:

```text
ciadi-windows/
  main.cjs
  preload.cjs
  package.json
  index.html
  renderer/
    core/
      auth-service.js
      profile-service.js
      permission-service.js
      polo-context-service.js
      module-registry.js
      audit-service.js
      sync-service.js
    modules/
      administracao/
      clinica/
      financeiro/
      recursos-humanos/
      aprovisionamento/
      polos/
      sos/
      comunicacao/
      recepcao/
      suporte/
    shared/
      components/
      forms/
      reports/
      utilities/
```

A extracção deve preservar o comportamento actual e ser incremental. Antes de escolher carregamento por ES Modules, avaliar o comportamento de `file://` no Electron, CSP, dependências externas e o mecanismo actual de scripts. O `package.json` deverá incluir explicitamente todos os ficheiros locais necessários no pacote ASAR.

## 7. Interfaces internas recomendadas

Exemplos conceptuais para orientar a implementação, ainda sem compromisso de schema:

- `AuthService.getSession() -> Session | null`
- `ProfileService.getCurrentProfile(userId) -> Profile`
- `PermissionService.can(userId, moduleId, action, context) -> boolean`
- `PoloContextService.getContext() -> { originPoloId, activePoloId, representationPoloId }`
- `PoloContextService.setActivePolo(poloId, representation) -> ValidatedContext`
- `ModuleRegistry.listAvailableModules(session, context) -> ModuleDescriptor[]`
- `AuditService.record(event) -> void`

Estas interfaces não devem ser consideradas uma implementação de segurança no cliente. O servidor deve revalidar a sessão, o âmbito e a autorização em cada leitura/escrita protegida.

## 8. Estratégia de migração

1. Congelar a fonte actual e criar testes de caracterização dos fluxos existentes.
2. Resolver a fonte oficial do Dashboard: actualmente o workflow copia o HTML da raiz, enquanto a documentação do Setup ainda menciona um nome com sufixo `(1)`.
3. Extrair o Core sem alterar o comportamento dos módulos.
4. Criar o registo de módulos e migrar um módulo de cada vez.
5. Integrar RH, Aprovisionamento, Polos e Suporte apenas depois de reconciliar as propostas existentes e as dependências RLS.
6. Introduzir o contexto de polo após auditoria integral das tabelas e políticas.
7. Homologar o Setup único, a autenticação, permissões, isolamento entre polos, sincronização e recuperação.

## 9. Segurança e preservação

- Não alterar a base de dados de produção nem aplicar migrações nesta fase.
- Não alterar políticas RLS, funções globais ou constraints de perfis sem auditoria e autorização específicas.
- Não incluir `service_role`, tokens, palavras-passe ou segredos no HTML, renderer ou instalador.
- Não conceder permissões com base no perfil de estação.
- Não expor dados salariais/bancários do RH à navegação geral.
- Não permitir que a troca de polo altere a identidade de origem ou contorne RLS.
- Não publicar release nem substituir o Setup instalado durante a fase de desenho.

## 10. Critérios de aceitação

- Um único instalador Windows instala o Shell e os módulos disponíveis.
- Os módulos têm entradas e testes independentes.
- Login e permissões são provenientes de identidade autenticada e verificadas no servidor.
- O perfil da estação não altera permissões.
- O utilizador só selecciona polos aos quais está associado/autorizado.
- A representação entre polos mantém a associação de origem e regista o contexto da operação.
- Um utilizador de um polo não consegue ler ou alterar dados operacionais de outro polo sem autorização explícita.
- O Dashboard actual mantém os fluxos existentes durante a migração.
- Build, instalação, actualização e recuperação são testados antes de qualquer release.

## 11. Decisões ainda por validar

1. Matriz final de perfis institucionais e acções por módulo.
2. Quem pode autorizar a representação temporária entre polos e se exige prazo/motivo.
3. Mapeamento canónico de polos para empresas e centros de custo.
4. Quais módulos podem operar offline e quais operações ficam bloqueadas sem rede.
5. Quais módulos e componentes ficam incluídos por defeito no Setup; recomendação: instalar um único pacote integral e controlar disponibilidade por autorização, não por licenciamento local.
