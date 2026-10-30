# CIADI — Plano de testes de segurança P0 (RLS, Storage, RPC e Edge)
**Data:** 30-10-2026  
**Destino:** ambiente Supabase de desenvolvimento isolado, nunca produção  
**Estado:** especificação de testes; ainda não executada.

## 1. Regras de execução
- Usar contas e registos totalmente fictícios.
- Não copiar dados reais de pacientes, famílias, colaboradores, candidatos ou movimentos financeiros.
- Cada teste deve registar identidade, perfil, polo de origem, polo activo, eventual delegação, acção e resultado esperado/observado.
- Testes negativos são obrigatórios: provar que o acesso é negado.
- Não aceitar que o frontend esconda botões como prova de autorização.
- Não executar até existir ambiente Supabase de desenvolvimento. A listagem actual mostra apenas a branch `main` do projecto; não foi criada branch de desenvolvimento nem assumido qualquer custo.

## 2. Matriz P0

### A. Conhecimentos CIADI
| Identidade de teste | Classificação do registo | Acção | Resultado esperado |
|---|---|---|---|
| Anónimo | publico | SELECT | Permitido |
| Anónimo | familias | SELECT | Negado |
| Anónimo | interno | SELECT | Negado |
| Paciente/Responsável sem vínculo | familias | SELECT | Negado |
| Responsável com vínculo activo | familias | SELECT | Permitido apenas conforme nível de acesso |
| Profissional/A.T. | interno | SELECT | Negado por defeito |
| Admin/gestor autorizado | interno | SELECT | Permitido, auditado |

Critério: a política pública nunca pode usar apenas `ativo=true`; deve considerar classificação e estado de publicação.

### B. Recrutamento
| Cenário | Resultado esperado |
|---|---|
| Anónimo envia nome/email/telefone/especialidade/mensagem e vaga válida | Criar candidatura com estado `recebida` |
| Anónimo envia `estado='aprovada'` | Rejeitar ou ignorar o campo; estado continua `recebida` |
| Anónimo envia `codigo_candidatura` escolhido | Rejeitar ou substituir por código gerado no servidor |
| Anónimo envia `email_erro` ou `email_enviado_at` | Rejeitar/ignorar |
| Anónimo envia `cv_storage_path` arbitrário | Rejeitar; upload deve usar fluxo autorizado |
| Vaga inactiva/fora de prazo | Negar |
| Consulta com código inválido/aleatório | Resposta uniforme, sem confirmar existência parcial |
| Muitas consultas repetidas | Rate limit/cooldown |
| Candidato com código válido | Devolver apenas estado, vaga e data estritamente necessários |

Critério: colunas internas não podem ter INSERT público; código deve ter entropia suficiente e ser sempre gerado no servidor.

### C. Storage
| Identidade | Bucket/operação | Resultado esperado |
|---|---|---|
| Anónimo | ler `banners`, `galeria`, `logos`, `profissionais` | Permitido apenas para conteúdo público |
| Anónimo | ler `documentos`, `chat-anexos`, `marketing-anexos` | Negado |
| A.T. | carregar/substituir/apagar em `ciadi-app-updates` | Negado |
| A.T. | listar/ler documentos privados fora da sua atribuição | Negado |
| Profissional atribuído | documento clínico do paciente atribuído | Apenas acesso funcional necessário |
| Profissional não atribuído | documento clínico de outro paciente | Negado |
| RH autorizado | documento laboral do âmbito RH | Permitido sem acesso bancário automático |
| Suporte Informático | conteúdo clínico/RH | Negado; apenas metadados técnicos estritamente necessários |
| Admin de release | publicar pacote assinado em `ciadi-app-updates` | Permitido com auditoria e verificação hash/assinatura |

Critério: permissões de upload, download, update e delete devem ser independentes; não reutilizar `is_staff()` transversalmente.

### D. Faturação e financeiro
| Identidade | Operação | Resultado esperado |
|---|---|---|
| A.T. | emitir documento fiscal | Negado |
| Recepção | consultar dados financeiros | Negado por defeito |
| Operador de caixa com `pode_abrir_caixa` | abrir caixa autorizada | Permitido no âmbito atribuído |
| Operador sem `pode_reconciliar` | importar/reconciliar extrato | Negado |
| Operador de outra empresa/polo | aceder à conta/turno | Negado |
| Gestor financeiro | aprovar fecho de turno | Permitido conforme delegação |
| Operador que fechou o turno | aprovar o próprio fecho | Negado (maker-checker) |
| Utilizador sem permissão de exportação | exportar SAF-T/relatórios financeiros | Negado |

Critério: separar consulta, criação, emissão, contabilização, aprovação, reconciliação, fecho e exportação; verificar empresa, centro de custo, polo, conta e turno.

### E. Clínica e A.T.
| Identidade | Operação | Resultado esperado |
|---|---|---|
| A.T. com atribuição activa | criar ficha do paciente atribuído | Permitido apenas nos campos necessários |
| A.T. sem atribuição | criar ficha para paciente não atribuído | Negado |
| A.T. com atribuição expirada/inactiva | consultar ou alterar ficha | Negado |
| Profissional responsável | emitir documento próprio | Permitido |
| Profissional não responsável | emitir documento de outro profissional | Negado |
| Recepção | consultar diagnóstico/conteúdo clínico | Negado |
| Responsável legal | consultar apenas dados autorizados pelo vínculo | Permitido dentro do nível de acesso |
| Suporte Informático | consultar conteúdo clínico | Negado |

### F. SOS
- Testar abertura por paciente/responsável, profissional, A.T., operador e admin.
- Testar paciente inexistente, inactivo, não associado e pertencente a outro polo.
- Testar localização não autorizada, coordenadas omitidas e payload inválido.
- Testar transição de estado, atribuição, encerramento e auditoria.
- **Decisão de negócio ainda necessária:** confirmar se qualquer utilizador autenticado pode abrir SOS para qualquer assistido, ou apenas para assistido próprio/atribuído. A função actual aceita um `p_paciente_id` sem verificar esse vínculo.

### G. Edge Functions / RPC
- Recrutamento: rate limit, código aleatório forte, resposta uniforme e sem enumeração.
- Triagem pública: limites de comprimento, tamanho do array, frequência, consentimento registado com versão do aviso e data.
- Validação documental: limitar tentativas, minimizar metadados e impedir enumeração de códigos.
- Calendário/indexação: token cron inválido/expirado/revogado, rotação, replay e ausência de segredo.
- Marketing webhook: assinatura inválida, timestamp antigo, evento duplicado e idempotência.
- RPC SECURITY DEFINER: cada função deve provar identidade, perfil activo, acção, escopo de linha e validação de todos os IDs recebidos.

## 3. Evidência a recolher
Para cada caso: ID do teste, utilizador fictício, perfil, polo, acção, tabela/RPC/bucket, resultado esperado, resultado real, logs/auditoria e estado PASS/FAIL. Nunca incluir dados pessoais reais nos logs de teste.

## 4. Critérios para aprovação P0
- Nenhum teste negativo permite acesso fora do âmbito.
- Nenhuma operação pública altera estado, código ou campos internos.
- Nenhum perfil A.T. consegue publicar actualizações de software ou aceder a documentos globais.
- Nenhum utilizador não financeiro consegue emitir/postar/fechar/exportar documentos financeiros.
- Todas as acções críticas deixam trilho de auditoria.
- Testes executados com RLS real no ambiente isolado e revisão independente antes de qualquer migração para produção.

**Nota:** este documento não altera políticas, grants, funções ou dados. É um plano de homologação para a futura branch Supabase de desenvolvimento.
