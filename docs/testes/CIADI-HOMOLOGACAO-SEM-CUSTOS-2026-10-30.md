# CIADI — Homologação sem custos adicionais
**Data:** 30-10-2026  
**Estado:** plano de execução local; não substitui homologação PostgreSQL/Supabase real.

## 1. Restrições e garantias
- Não criar Supabase branch, projecto pago ou serviço externo.
- Não alterar a branch `main), o projecto Supabase de produção, dados, políticas, grants, funções ou Storage.
- Não copiar dados reais de pacientes, famílias, colaboradores, candidatos ou movimentos financeiros.
- Manter a PR #24 em Draft e sem merge.
- Os testes locais simulam contratos do frontend; não provam que RLS, RPC ou Edge Functions estão seguros.

## 2. Ambiente observado
O ambiente de execução disponível tem Node.js v22.16.0, mas não tem Docker, Supabase CLI, PostgreSQL (`psql`/servidor) nem Podman disponíveis. Assim, não é possível iniciar aqui a stack Supabase local nem executar políticas RLS reais.

## 3. Trabalho que pode ser validado gratuitamente
1. Testes unitários Node.js de AuthService, ProfileService e PermissionService.
2. Testes de navegação, contratos de integração e sintaxe JavaScript.
3. Simulações de perfis, operações, polo activo e delegação com identidades fictícias.
4. Revisão estática de SQL, políticas, funções, grants, Storage e Edge Functions.
5. Testes negativos com providers simulados que falham de forma fechada.

**Execução local efectuada nesta sessão:** 11 testes unitários isolados (AuthService, ProfileService e PermissionService) passaram: 11/11. Estes testes foram executados com Node.js sobre cópias locais dos módulos e testes da PR; não incluem os testes de caracterização que dependem do HTML completo do Dashboard e não constituem prova de RLS real.

Comando no repositório:
```bash
cd ciadi-windows
npm run test:architecture
```

## 4. Polo de origem, polo activo e representação
- O polo de origem é informação administrativa do utilizador e deve ser obtida no servidor; não aceitar o valor enviado pelo browser como prova.
- O polo activo é um contexto operacional solicitado pelo utilizador e tem de ser autorizado no servidor.
- A representação exige polo representado, polo activo correspondente e identificador de delegação explícita.
- O servidor deve verificar a identidade real através da sessão/JWT, o vínculo ao polo de origem, a delegação, o âmbito, o estado e a validade temporal.
- O perfil de estação (por exemplo, RH, recepção ou suporte) não concede permissões.
- A simulação local não cria delegações reais nem altera permissões no Supabase.

## 5. O que continua pendente
Para homologar os achados P0 de RLS/Storage/RPC/Edge é necessário executar testes reais num PostgreSQL/Supabase isolado, com esquema/migrações e dados sintéticos. Não é seguro substituir essa etapa por testes no projecto de produção.

## 6. Critérios para avançar
- Todos os testes locais aplicáveis passam.
- A integração real do provider de autorização ainda não é considerada concluída até existir implementação server-side que valide `auth.uid()`, permissões granulares, polo activo e delegação.
- Os achados P0 continuam abertos até prova por testes de integração isolados.
- Nenhuma migração para produção sem revisão, backup verificável, autorização explícita e plano de reversão.
