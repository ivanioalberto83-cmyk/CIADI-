# CIADI — matriz-base de permissões e contexto de polos

Data: 2026-10-30  
Estado: matriz-base aprovada para implementação; ainda não é uma configuração activa em produção.

## 1. Princípios obrigatórios

1. **Negação por defeito:** qualquer módulo, operação, registo ou polo sem autorização explícita é negado.
2. **Servidor como autoridade:** a interface pode esconder ou bloquear navegação por conveniência, mas só o servidor/Supabase pode autorizar dados e operações.
3. **Sem confiança no rótulo do perfil:** perfil, estação Windows e menu visível não são prova suficiente de autorização.
4. **Menor privilégio:** conceder apenas o necessário para a função e para os registos abrangidos.
5. **Separação por operação:** consultar, criar, editar, eliminar, aprovar, anular, exportar, administrar utilizadores e delegar são permissões distintas.
6. **Segregação de dados sensíveis:** dados clínicos, RH confidencial, bancários, remunerações e documentos de identificação requerem regras próprias.
7. **Auditoria:** alterações de permissões, aprovações, exportações sensíveis e representações entre polos devem deixar registo atribuível.

## 2. Matriz funcional de referência

Esta matriz traduz a aprovação da Direcção em limites funcionais. Não concede automaticamente direitos às tabelas ou RPC existentes; cada linha tem de ser mapeada para operações reais e validada contra RLS.

| Perfil | Âmbito funcional de referência | Limites obrigatórios |
|---|---|---|
| Administrador | Administração institucional e gestão dos módulos expressamente atribuídos | Dados clínicos, bancários e RH continuam sujeitos a finalidade, registo e políticas específicas; não usar uma função global de equipa como atalho |
| Gestor | Gestão operacional dos domínios e polos que lhe forem atribuídos | Sem visão global, exportação ou acesso confidencial implícito |
| Operador | Alertas SOS e operações operacionais explicitamente atribuídas | Sem acesso geral a clínica, RH, financeiro ou administração |
| Profissional | Clínica, assistidos e famílias sob acompanhamento/autorização; consulta SOS quando previsto | Sem acesso a outros processos clínicos, RH, financeiro ou dados administrativos não necessários |
| RH | Gestão laboral e processos funcionais autorizados | Dados bancários, remunerações e documentos confidenciais separados por permissão específica |
| Recepção | Atendimento, triagem administrativa e agendamentos autorizados | Sem acesso a notas clínicas, avaliações, RH, financeiro ou exportações sensíveis |
| Suporte Informático | Diagnóstico técnico, estado de serviços e assistência autorizada | Sem leitura de conteúdo clínico, RH, financeiro ou alteração de permissões por defeito |
| Paciente | Os seus próprios dados e serviços disponibilizados | Nunca consultar outros pacientes ou familiares |
| Responsável | Dados e serviços dos assistidos cuja representação esteja validada | Relação de responsabilidade verificada no servidor; sem acesso transversal |

## 3. Catálogo de operações

Cada módulo deverá declarar permissões separadas, conforme aplicável:

- view: consultar/listar;
- create: criar registos;
- update: editar registos;
- delete: eliminar, sujeito a regras de retenção;
- approve: aprovar pedidos, compras, férias, documentos ou operações;
- cancel: anular/cancelar;
- export: exportar ou descarregar dados;
- manage_users: gerir utilizadores e perfis;
- manage_permissions: atribuir ou revogar permissões;
- delegate: conceder representação temporária entre polos.

Operações não declaradas ou não atribuídas ficam negadas. A autorização deve também restringir as linhas/assistidos/documentos que o utilizador pode alcançar.

## 4. Contexto de polo — três conceitos distintos

1. **Polo de origem:** associação administrativa estável do colaborador. Não muda quando este trabalha noutro polo.
2. **Polo activo:** polo seleccionado para o trabalho da sessão. Só pode ser escolhido de entre os polos que o servidor confirmar como autorizados.
3. **Polo representado:** polo em nome do qual o colaborador actua por delegação explícita, com validade e âmbito definidos.

A representação temporária deve ter, no mínimo, identificador, colaborador, polo de origem, polo representado, módulos/operações abrangidos, motivo, início, fim, autor da concessão, estado e registo de auditoria. Expirada ou revogada a concessão, o servidor deve negar a operação.

Exemplo: um colaborador associado ao Jardim de Rosas pode seleccionar Talatona como polo activo se tiver autorização. Se estiver a representar Talatona, a representação é registada separadamente; a associação de origem permanece Jardim de Rosas.

## 5. Contrato técnico do PermissionService

O serviço de interface introduzido nesta fase é apenas um adaptador fail-closed para um fornecedor de decisões do servidor:

- exige userId, moduleId e action;
- delega a decisão num fornecedor explícito;
- só aceita a resposta exacta { allowed: true };
- nega se o fornecedor não estiver configurado, falhar, devolver resposta inválida ou faltar contexto;
- não infere permissões a partir do tipo, nome do perfil, estação ou menu.

**Não está ligado a RPC nem a política de produção**, porque ainda não existe contrato de autorização server-side aprovado e verificado. Não inventar um nome de RPC nem criar uma função SECURITY DEFINER para contornar RLS.

## 6. Bloqueios antes de activar

- Mapear cada módulo para tabelas, views, Storage, RPC, triggers e operações reais.
- Rever policies existentes individualmente; policies permissivas combinam-se por OR.
- Resolver o uso da função is_staff em RH/Aprovisionamento sem quebrar fluxos clínicos e pedidos de materiais.
- Corrigir o caminho geral de autenticação para perfis que venham a ser formalmente habilitados, sem alterar a constraint de produção nesta fase.
- Definir a política de acesso a dados clínicos por relação assistido/profissional/responsável.
- Desenhar e testar o isolamento por polo para documentos, clientes, despesas, pagamentos, caixas, compras, stock e inventário.
- Definir como a Direcção recebe visão consolidada, com permissões explícitas e auditoria.
- Testar tentativas directas de URL, chamada de função, RPC, Storage e alteração de identificadores (IDOR/BOLA).
- Obter backup restaurável e autorização específica antes de qualquer migração ou alteração em produção.

## 7. Estado de execução

- Matriz funcional: aprovada como base de implementação pelo utilizador em 2026-10-30.
- PermissionService: contrato fail-closed em implementação isolada na PR #24.
- Integração com o Dashboard: ainda não activada.
- RPC/funções/policies/RLS de produção: sem alterações.
- Polos e delegações: modelo especificado; ainda sem tabelas ou migrações aplicadas.
- Setup/instalador e publicação: não autorizados por esta decisão.
