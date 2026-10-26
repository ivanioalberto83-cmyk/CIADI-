# CIADI — Gestão de Polos e Separação da Produção

- **Versão:** 1.0
- **Data:** 2026-10-26
- **Estado:** Especificação para revisão; não autoriza alterações na base de dados de produção.
- **Repositório:** `ivanioalberto83-cmyk/CIADI-`

## 1. Objetivo e limites

Permitir que a Direção administre polos operacionais do CIADI, associe cada polo a um centro de custo financeiro existente e consulte resultados por polo e consolidados. A solução deve funcionar no Dashboard Web e no Dashboard Windows (Electron/Setup.exe), reutilizando Supabase Auth e as políticas RLS existentes.

Esta etapa é documental. Não cria tabelas, não altera registos, não aplica migrações, não publica versões e não muda permissões de produção.

## 2. Dados de partida

| Polo | Código indicado | Localização | Confirmação |
|---|---|---|---|
| POLO TALATONA | 1012 | TALATONA RUA DO CENTRO LOGÍSTICO | Nome, código e localização fornecidos |
| POLO JARDIM DE ROSAS | 1013 | Condomínio Jardim de Rosas, Talatona, Luanda | Código confirmado pelo utilizador; localização operacional por confirmar |

A auditoria de esquema identificou `public.finance_centros_custo` (RLS ativo, um registo) e `public.finance_despesas` (RLS ativo, campo textual `centro_custo`). O SQL fornecido para `finance_centros_custo` confirma: `id` UUID como chave primária; `codigo` e `nome` obrigatórios; `codigo` com restrição `UNIQUE`; `descricao` opcional; `ativo` obrigatório por omissão `true`; datas `created_at`/`updated_at` com `now()` por omissão; `empresa_id` opcional; e índice em `empresa_id`. O SQL define a estrutura, não revela os valores do registo existente. As tabelas operacionais examinadas — incluindo `agendamentos`, `ciadi_triagens`, `ciadi_sos_alertas`, `ciadi_at_sessoes`, `pacientes` e `profissionais` — não apresentavam um campo de polo na listagem de colunas consultada. Os dados completos do único centro de custo e as políticas RLS detalhadas ainda não foram confirmados. Não se deve presumir que o centro existente corresponde a qualquer dos polos.

## Decisões confirmadas pelo utilizador — 2026-10-26

- O centro de custo existente deve ser identificado primeiro; não deve ser associado a nenhum polo até se conhecer o seu nome, código e finalidade.
- Cada polo terá **um único centro de custo principal** na primeira versão (decisão confirmada pelo utilizador).
- Os códigos dos polos continuam a ser dados de entrada fornecidos pelo utilizador; não foram inseridos na base de dados.
- A consulta de metadados read-only confirmou que `finance_centros_custo` tem um registo e RLS activo, mas a ferramenta disponível não revelou o conteúdo desse registo. O utilizador forneceu o DDL da tabela, que confirma a restrição `UNIQUE` sobre `codigo` e o índice `idx_fin_centros_empresa`; estes metadados não identificam o registo. A consulta SQL de leitura usada anteriormente foi bloqueada por controlos de segurança; não será contornada por outro executor. A identificação do registo continua pendente.
- A listagem de esquema confirmou que `finance_despesas.centro_custo` é texto livre e que `finance_despesas` tem zero registos nesta contagem. Não se deve converter ou inferir relações a partir do texto.
- `agendamentos`, `ciadi_triagens`, `ciadi_sos_alertas`, `ciadi_at_sessoes`, `pacientes` e `profissionais` não têm uma coluna directa de polo na listagem de esquema consultada; todas estas tabelas têm RLS activo.
- Esta auditoria não expôs o conteúdo das políticas RLS individuais nem prova que a aplicação esteja protegida em todos os caminhos. É necessária revisão de políticas por tabela antes de desenhar a migração.

## 3. Opções de arquitectura

1. **Recomendação — catálogo de polos separado e relação explícita com centros de custo.** Preserva o catálogo financeiro existente e permite que um polo seja associado a um centro de custo sem duplicar dados financeiros.
2. Reutilizar apenas `finance_centros_custo` como se cada centro fosse também um polo. É mais simples, mas mistura a estrutura operacional com a financeira e limita a evolução.
3. Acrescentar campos de texto de polo às tabelas operacionais. É menos consistente, dificulta a integridade referencial e favorece diferenças de escrita.

A opção 1 é a recomendação de desenho, sujeita a revisão do esquema completo, políticas, consultas e dependências antes de qualquer implementação.

## 4. Comportamento funcional

- A Direção autorizada pode consultar, criar, editar, activar e desactivar polos.
- A criação inclui nome, código, localização e associação ao centro de custo existente ou a um centro de custo criado por fluxo autorizado.
- A interface apresenta a acção **“+ Adicionar Polo”**, pesquisa/listagem, estado activo/inactivo e validações compreensíveis.
- Códigos duplicados não podem ser gravados. A verificação deve ocorrer no servidor, com uma restrição de unicidade adequada, para impedir duplicações simultâneas.
- A normalização usada na comparação de nomes/códigos deve ser definida e testada antes da migração; a interface não substitui a validação no servidor.
- Um polo com registos associados não pode ser eliminado fisicamente; deve ser desactivado, preservando o histórico.
- A atribuição de despesas a um polo deve usar uma relação validada, não texto livre como única fonte de verdade.
- Os relatórios por polo e consolidados devem contar cada registo financeiro uma única vez. Despesas sem associação válida devem ser sinalizadas como “não atribuídas”, sem atribuição automática.
- Não reatribuir dados históricos automaticamente. Qualquer migração de histórico requer regra aprovada, relatório de pré-visualização e confirmação explícita.

## 5. Acesso e segurança

- Reutilizar Supabase Auth e o modelo de papéis existente; não criar papéis paralelos sem necessidade demonstrada.
- Direcção/admin: gerir polos e consultar relatórios consolidados, conforme a política de acesso aprovada.
- Gestor: acesso limitado aos polos que lhe forem atribuídos, se a associação utilizador-polo for confirmada e implementada.
- Profissionais e outros utilizadores: acesso apenas aos registos e operações autorizados para a sua função e âmbito.
- Aplicar RLS em todas as novas tabelas expostas e rever políticas de leitura, inserção, actualização e desactivação. As políticas de actualização devem validar tanto a linha de origem como os valores finais.
- Nunca incluir a chave `service_role` no navegador, APK ou aplicação Windows.
- Não usar `SECURITY DEFINER` como atalho para ultrapassar falhas de permissões. Qualquer função privilegiada exige justificação, controlo de `search_path`, verificação de identidade/autorização e revisão de privilégios.
- Registar auditoria para criação, edição, activação/desactivação e alterações de associação, sem incluir dados clínicos desnecessários.

## 6. Integração e experiência

- **Dashboard Web:** disponibilizar gestão de polos a utilizadores autorizados e filtros por polo nas vistas operacionais/financeiras aplicáveis.
- **Dashboard Windows:** manter o padrão de segurança Electron existente (isolamento de contexto, Node desactivado no renderer e navegação externa controlada); a funcionalidade deve usar a mesma API/Supabase e regras de autorização.
- **Actualizações:** qualquer Setup.exe deve ser construído e validado em branch/PR, identificado por versão, commit e SHA-256. Não publicar uma versão nem iniciar actualização automática como parte desta especificação.
- **Resiliência:** erros de rede devem ser visíveis; uma gravação não confirmada não pode ser apresentada como concluída. Realtime pode actualizar listagens, mas a autorização deve ser sempre aplicada no servidor.

## 7. Sequência de implementação proposta

1. Confirmar o conteúdo do centro de custo existente e inspeccionar as políticas RLS, chaves estrangeiras, funções e consultas que dependem de `finance_centros_custo` e `finance_despesas`.
2. Aprovar o modelo de dados, o mapeamento polo-centro de custo, os campos operacionais que necessitam de associação e as regras de acesso por função.
3. Preparar migração versionada, reversível e idempotente onde aplicável, sem apagar nem reatribuir dados existentes; rever o SQL antes de executar.
4. Implementar primeiro a gestão de polos e os testes de autorização; depois integrar filtros e associação em operações específicas.
5. Validar em ambiente não produtivo ou com cópia controlada, incluindo backup recuperável e plano de rollback verificado.
6. Abrir PR para revisão. Só depois de aprovação específica, backup confirmado e validação dos testes se poderá considerar a migração de produção.
7. Construir o Setup.exe a partir do commit aprovado e verificar artefacto, versão, SHA-256 e fluxo de actualização sem instalação forçada.

## 8. Critérios de aceitação e testes

- Criar dois polos válidos e impedir código duplicado, incluindo duas tentativas concorrentes.
- Rejeitar criação/edição por utilizador sem permissão, mesmo através de chamada directa à API.
- Confirmar que gestores não consultam polos fora do âmbito autorizado.
- Confirmar que desactivar um polo preserva os registos associados.
- Confirmar que as despesas aparecem uma única vez nos totais por polo e consolidados.
- Confirmar que despesas não mapeadas são sinalizadas e não atribuídas automaticamente.
- Confirmar que falhas de rede ou de autorização não são apresentadas como gravações bem-sucedidas.
- Executar testes de regressão nas funções financeiras existentes e validar o Dashboard Web e a versão Windows.
- Comparar contagens e identificadores antes/depois; não aceitar perda, duplicação ou alteração silenciosa de dados.
- Verificar as políticas RLS e executar os avisos de segurança do Supabase após alterações de esquema.

## 9. Condições por resolver antes da migração

1. Qual é o nome e o código do centro de custo actualmente existente, e a que finalidade corresponde?
2. Confirmar a localização operacional exacta do POLO JARDIM DE ROSAS.
4. Que funções/papéis podem atribuir utilizadores e profissionais a polos?
5. Que tabelas operacionais devem receber a associação ao polo na primeira fase?
6. Que política aprovada deve ser aplicada às despesas históricas e às despesas ainda sem polo?

Estas condições são bloqueios para a migração de produção, não motivos para alterar os dados por inferência.
