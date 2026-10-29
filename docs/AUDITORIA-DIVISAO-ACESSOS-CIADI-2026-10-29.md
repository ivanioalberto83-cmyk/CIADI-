# CIADI — Relatório de auditoria de divisão de acessos
Data: 2026-10-29
Branch: `audit/divisao-acessos-ciadi-2026-10-29`

## Âmbito e segurança
- Auditoria do HTML do Dashboard, pacote Electron/NSIS e configuração do workflow.
- Consultas ao Supabase limitadas a leitura; nenhuma alteração de dados, esquema ou políticas RLS foi feita.
- A matriz do Dashboard é uma barreira de interface e não substitui a autorização no servidor/RLS.

## Separação de conceitos

### Perfis de estação/instalação (não são permissões de conta)
1. ADM
2. Suporte Informático
3. RH
4. Receção

A auditoria do pacote atual não encontrou um seletor NSIS que grave/identifique estes quatro tipos de estação. O `package.json` mantém atalhos genéricos; `main.cjs` não lê uma configuração de estação. É necessária uma implementação própria e um teste de instalação antes de afirmar que existe.

### Perfis de autenticação encontrados no Dashboard/Supabase
A leitura da tabela `public.perfis` encontrou os tipos `admin`, `operador`, `paciente`, `profissional` e `responsavel`. O código também reconhece `gestor`, mas a consulta não encontrou perfis ativos desse tipo. Não criar nem alterar perfis durante esta auditoria.

## Matriz provisória de visibilidade do Dashboard
- `admin`: todos os módulos da interface.
- `gestor`: todos os módulos no código, mas não foi encontrado perfil ativo deste tipo; confirmar se este papel continua aprovado.
- `operador`: apenas Alertas SOS.
- `profissional`: Agendamentos, Especialidades, Triagens e Clínica Virtual.
- `paciente` e `responsavel`: sem acesso ao Dashboard administrativo.

O perfil profissional foi restringido preventivamente para não expor listagens globais de pacientes, profissionais ou documentos até se confirmar o RLS e a filtragem por atribuição. Esta restrição pode reduzir funcionalidades e precisa de validação funcional com a Direção clínica.

## Alterações propostas nesta branch
- Matriz central de módulos com negação por omissão.
- Verificação da permissão tanto na navegação visível como na função de navegação direta.
- Validação do perfil ativo obtido de `public.perfis`; o seletor de estação não concede permissões.
- Sincronização de `index.html` com `CIADI_DASHBOARD_FINANCEIRO.html`.
- Verificações estáticas no GitHub Actions para os limites da matriz de acesso.

## Limitações e riscos ainda abertos
1. Não foi possível confirmar a eficácia das políticas RLS para todas as tabelas sensíveis nesta fase.
2. Não foram executados testes com sessões reais de cada tipo de utilizador.
3. A matriz da interface não é controlo de segurança suficiente sem RLS correto.
4. O seletor dos quatro perfis de estação ainda não foi implementado no instalador NSIS.
5. O Setup.exe ainda não foi compilado nem instalado em Windows nesta branch.
6. A release principal não foi alterada; esta branch/PR aguarda revisão.

## Critérios para homologação
- Rever as políticas RLS de pacientes, profissionais, agendamentos, documentos, SOS, faturação e auditoria em modo só de leitura.
- Testar cada perfil real com acessos permitidos e negados, incluindo tentativas diretas à API Supabase.
- Implementar o seletor NSIS como identificação de estação sem conceder papéis Supabase.
- Executar build Windows, instalar em ambiente de teste e verificar atualização/desinstalação sem apagar dados.
- Não fazer merge nem publicar até os testes passarem e a Direção aprovar a matriz.
