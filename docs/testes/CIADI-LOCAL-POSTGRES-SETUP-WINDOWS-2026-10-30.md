# CIADI — Preparar homologação local Supabase/PostgreSQL sem branch paga
**Data:** 30-10-2026  
**Estado:** guia preparado; ainda não executado no computador do utilizador.

## Objectivo
Reproduzir os achados de segurança P0 num ambiente local, sem criar branch Supabase, sem contratar serviço e sem utilizar dados pessoais/clínicos reais.

## Situação do repositório
A branch de implementação não contém actualmente `supabase/migrations`, `supabase/config.toml` nem um baseline SQL completo. Por isso, ainda não é possível executar `supabase start` e obter uma réplica fiel apenas com o repositório actual.

## Pré-requisitos no Windows
- Windows 10/11 compatível com WSL2.
- Git e Node.js LTS.
- Supabase CLI.
- Docker Engine/Desktop apenas se a respectiva licença for gratuita para a utilização concreta. Não subscrever plano pago nem activar serviços pagos.
- Espaço em disco para containers e base de dados local.

**Alternativa:** se Docker Desktop não for gratuito/licenciado para a organização, não o instalar para este trabalho. Pode usar-se PostgreSQL local para testes SQL limitados, mas isso não reproduz integralmente Auth, Storage, PostgREST e Edge Functions do Supabase.

## Fase A — Obter apenas o esquema, sem dados
1. Abrir uma cópia local do repositório e mudar para a branch de implementação.
2. Instalar/validar a Supabase CLI e iniciar o projecto local.
3. Autenticar na Supabase CLI e ligar o projecto CIADI usando o ref já conhecido.
4. Executar `supabase db pull` para gerar um baseline de esquema/migração local.
5. Se a CLI perguntar se deve actualizar a tabela de histórico de migrações do projecto remoto, responder **N**. Não aceitar qualquer reparação/actualização do histórico remoto.
6. Inspeccionar o ficheiro gerado antes de o adicionar ao Git. Confirmar que não contém INSERT/COPY de dados, passwords, tokens ou segredos.
7. Capturar/verificar também as personalizações de RLS em `auth` e `storage`, porque a CLI pode excluir schemas geridos no dump inicial; seguir a versão actual da CLI e comparar as policies/trigger customizadas com o inventário de auditoria.

Comandos de referência (executar apenas na cópia local):
```powershell
git switch implementation/ciadi-modular-shell-clean-20261030
npx supabase --version
npx supabase init
npx supabase login
npx supabase link --project-ref egpkkttbcaukqnnxyhjv
npx supabase db pull
```

O comando `db pull` destina-se a trazer alterações de esquema para ficheiros locais. **Não executar** `supabase db push`, `supabase migration up --linked`, `supabase db reset --linked` ou qualquer comando que aplique migrações ao projecto remoto.

Não colocar a palavra-passe da base de dados, access token ou `.env` no Git, em mensagens ou nesta conversa. Introduzir credenciais apenas no terminal local quando estritamente necessário.

## Fase B — Inicializar apenas o ambiente local
Depois de rever o baseline:
```powershell
npx supabase start
npx supabase status
npx supabase db reset
```
Atenção: `db reset` sem `--linked` destrói e recria a base **local**. Confirmar que o CLI indica explicitamente o ambiente local antes de executar. Nunca usar `--linked`.

Não criar ainda dados de teste automaticamente: primeiro é necessário rever as definições das tabelas, constraints, triggers, funções, extensões e dependências do schema CIADI. Os dados sintéticos devem ser construídos manualmente e identificados como fictícios.

## Fase C — Testes P0 a executar localmente
### 1. Conhecimentos CIADI
- Anónimo: só deve conseguir ler registos activos explicitamente classificados como públicos e publicados.
- Anónimo: não deve conseguir ler classificações `familias`, `interno` ou `todos`.
- Utilizador autenticado sem vínculo: não deve obter conteúdos familiares nem internos.
- Responsável autenticado e ligado ao assistido: apenas conteúdos familiares autorizados para esse vínculo.
- Colaborador: apenas conteúdos internos da área e do polo para os quais tem permissão.

### 2. Recrutamento
- Anónimo: INSERT permitido apenas nas colunas públicas estritamente necessárias ao formulário.
- Anónimo: não pode definir `estado`, código de candidatura, caminho de CV, estado de envio de email ou campos de controlo interno.
- Código de candidatura: gerado no servidor com entropia adequada e não controlável pelo cliente.
- Consulta pública: testar limitação de tentativas, respostas uniformes e resistência à enumeração.

### 3. Storage
- A.T. não deve ter acesso geral a todos os documentos por pertencer a `is_staff()`.
- Testar acesso a documentos apenas quando existe atribuição/autorização explícita para aquele assistido/documento.
- Escrita/actualização de `ciadi-app-updates` deve ser exclusiva de um processo de publicação controlado, com artefactos assinados e revisão de release.
- Confirmar que utilizadores sem permissão não conseguem listar, ler, criar, substituir ou apagar objectos.

## Critérios de aprovação
- Os testes positivos e negativos devem ser executados com roles/sessões reais do ambiente local, não apenas com mocks JavaScript.
- Cada teste deve guardar resultado, role, identidade sintética, operação e evidência SQL.
- Todas as tentativas não autorizadas devem falhar no servidor, mesmo que se chame directamente à API sem usar o Dashboard.
- Sem dados reais, sem chamadas a funções de produção e sem escrita remota.
- Os achados P0 só podem ser marcados corrigidos depois dos testes locais reais passarem e a revisão do SQL confirmar o âmbito correcto.

## Bloqueios conhecidos
- O repositório ainda não tem baseline completo de migrações Supabase.
- O ambiente ChatGPT usado nesta sessão não dispõe de Docker, Supabase CLI ou PostgreSQL; este guia não foi executado aqui.
- Não foi criada branch Supabase nem foi alterado o projecto remoto.
- A auditoria anterior identificou os problemas; não aplicou correcções.
- As políticas e funções de produção não devem ser copiadas cegamente nem corrigidas sem testes, revisão e autorização.

## Fontes oficiais
- Supabase CLI — referência `db dump`, `db pull`, `db reset`: https://supabase.com/docs/reference/cli/global-flags
- Fluxo de desenvolvimento local e migrações: https://supabase.com/docs/guides/local-development/cli-workflows
- A CLI documenta que o dump padrão é de esquema, sem dados; `--data-only` é opção separada. As personalizações em `auth` e `storage` devem ser verificadas à parte.
