# CIADI — Inventário de Tratamentos de Dados Pessoais (modelo APD)

**Estado:** modelo de trabalho; por preencher e validar com a Direção e assessoria jurídica.  
**Âmbito:** exclusivamente CIADI.  
**Ambiente:** documentação e avaliação; não altera a base de dados nem o sistema em produção.  
**Versão:** 2026-10-25.

> Não inserir nomes de crianças, processos clínicos reais, números de identificação, credenciais, tokens ou outros dados pessoais neste documento. Registar apenas categorias e referências de evidência não identificáveis.

## Como preencher
- Criar uma entrada por finalidade/processo de tratamento, não apenas por tabela ou módulo.
- Usar “A CONFIRMAR” quando não houver evidência documental. Não presumir consentimento, fundamento jurídico, prazo de conservação ou autorização da APD.
- Distinguir consentimento para tratamento de dados, consentimento clínico e autorização de divulgação/imagem.
- Identificar especialmente dados de saúde, dados de crianças e dados de representantes legais.
- Guardar evidências em repositório restrito, sem anexar dados clínicos desnecessários.
- A Direção e assessoria jurídica devem confirmar o responsável pelo tratamento, fundamento jurídico aplicável, necessidade de notificação/autorização prévia e transferências internacionais junto da APD.

## Registo de atividades

Copiar a tabela para cada atividade ou preencher uma linha por atividade.

| Campo | Registo |
|---|---|
| ID da atividade | A CONFIRMAR |
| Nome da atividade/processo | A CONFIRMAR |
| Sistema/módulo e ambiente | A CONFIRMAR |
| Finalidade específica | A CONFIRMAR — descrever finalidade concreta e necessária |
| Responsável pelo tratamento (entidade legal) | A CONFIRMAR |
| Responsável interno/área | A CONFIRMAR |
| Fundamento jurídico do tratamento | A CONFIRMAR — validar juridicamente; não presumir consentimento |
| Categorias de titulares | A CONFIRMAR — criança, responsável legal, paciente, profissional, candidato, visitante, etc. |
| Categorias de dados pessoais | A CONFIRMAR |
| Dados sensíveis/de saúde | SIM / NÃO / A CONFIRMAR; especificar categorias, sem valores reais |
| Dados de crianças | SIM / NÃO / A CONFIRMAR |
| Origem dos dados | A CONFIRMAR — titular, representante, profissional, formulário, sistema integrado |
| Campos estritamente necessários e minimização | A CONFIRMAR |
| Destinatários internos e perfis autorizados | A CONFIRMAR |
| Destinatários externos | A CONFIRMAR |
| Subcontratantes/operadores e serviço prestado | A CONFIRMAR — incluir alojamento, correio, SMS, vídeo, análise, suporte |
| Localização/região de armazenamento | A CONFIRMAR com contrato/configuração do fornecedor |
| Transferência internacional ou acesso remoto a partir do estrangeiro | A CONFIRMAR — país, destinatário e mecanismo jurídico |
| Prazo de conservação e evento que o inicia | A CONFIRMAR — fundamentar por categoria documental |
| Procedimento de bloqueio, arquivo e eliminação | A CONFIRMAR |
| Aviso de privacidade aplicável e versão | A CONFIRMAR |
| Prova de informação ao titular/representante | A CONFIRMAR — referência documental, sem anexar dados pessoais |
| Consentimento/autorização aplicável, versão e prova | A CONFIRMAR / NÃO APLICÁVEL COM JUSTIFICAÇÃO |
| Canal para exercer direitos | A CONFIRMAR — contacto e processo operacional |
| Controlos de acesso/RLS e segregação | A CONFIRMAR por teste |
| Registos de auditoria e monitorização | A CONFIRMAR |
| Encriptação, cópias de segurança e teste de restauro | A CONFIRMAR com evidência |
| Riscos específicos e medidas de mitigação | A CONFIRMAR |
| Notificação/autorização APD: situação e referência | A CONFIRMAR com APD/assessoria jurídica |
| Evidência associada | A CONFIRMAR — caminho/ID sem conteúdo pessoal |
| Responsável pela validação e data | A CONFIRMAR |
| Estado | NÃO INICIADO / EM RECOLHA / EM VALIDAÇÃO / VALIDADO / BLOQUEADO |

## Atividades a verificar no CIADI (lista inicial; confirmar existência e âmbito)

| Atividade candidata | Risco que exige avaliação | Evidência a recolher |
|---|---|---|
| Triagem pública e pré-atendimento | Dados de saúde e dados de crianças; exposição pública e abuso automatizado | Aviso apresentado antes do envio, campos, fundamento jurídico, controlo de acesso, proteção contra abuso e retenção |
| Processo clínico e acompanhamento | Dados de saúde; acesso por função e necessidade de conhecimento | Matriz de acessos, políticas RLS, testes com contas de cada perfil, logs e prazos de conservação |
| Agendamentos e consultas online | Identificação, agenda e potencial inferência de cuidados de saúde | Permissões, notificações, fornecedores de vídeo, metadados e retenção |
| Portal familiar e representantes | Relação representante-criança e risco de acesso a criança errada | Verificação de vínculo/autoridade, testes de isolamento entre famílias e procedimento de revogação |
| Gestão de profissionais e recrutamento | Identificação profissional, contactos e dados de candidatos | Aviso, acesso RH, retenção de candidaturas e restrição de consulta pública |
| Validação pública de documentos | Possível divulgação de nomes, registos, assinaturas, hashes ou QR | Dados efetivamente devolvidos, token não enumerável, rate limit e necessidade de cada campo |
| Aniversários/calendário | Divulgação de nomes e datas de nascimento | Necessidade, preferências de visibilidade, destinatários e restrições por perfil |
| Comunicação por e-mail/WhatsApp/SMS | Divulgação a terceiros e transferências internacionais | Conteúdo mínimo, fornecedor, base legal, opt-out quando aplicável e regras para dados clínicos |
| Backups e suporte técnico | Cópias com dados pessoais fora do fluxo normal | Localização, encriptação, acesso, retenção, teste de restauro e eliminação de cópias |
| Alertas SOS, se aplicável ao CIADI | Localização e informação potencialmente sensível em situação de emergência | Categorias, destinatários, fundamento, minimização, logs, retenção e teste de encaminhamento |

## Critérios de conclusão por atividade
- [ ] Finalidade específica e fundamento jurídico documentados e aprovados.
- [ ] Necessidade e minimização de campos demonstradas.
- [ ] Titulares e representantes recebem informação clara antes do tratamento, quando aplicável.
- [ ] Dados de saúde e dados de crianças têm salvaguardas reforçadas e acessos justificados.
- [ ] Operadores, fornecedores, localização e transferências estão documentados e revistos.
- [ ] Prazos de conservação, bloqueio e eliminação foram aprovados e podem ser executados.
- [ ] Direitos dos titulares têm canal, responsável, registo e prazos operacionais.
- [ ] Acesso por função, RLS, endpoints públicos e tokens foram testados com resultados registados.
- [ ] Incidentes têm procedimento de deteção, escalonamento, registo e avaliação de notificação à APD.
- [ ] Backups têm acesso restrito, proteção adequada e restauro comprovado.
- [ ] A necessidade de notificação/autorização prévia foi confirmada com a APD/assessoria jurídica e a evidência foi arquivada.

## Referências oficiais para validação
- APD — Legislação: https://apd.ao/ao/legislacao/
- APD — Direitos do cidadão: https://apd.ao/ao/direitos-do-cidadao/
- APD — Legalização do tratamento de dados: https://apd.ao/ao/catalogo/formularios-apd/legalizacao-do-tratamento-de-dados/
- APD — Circular 02/APD/2024 sobre comunicação de incidentes de cibersegurança/dados: https://apd.ao/fotos/frontend_1/editor2/circular_002.pdf

**Limitação:** este inventário é um instrumento de preparação, não um parecer jurídico, uma notificação à APD nem uma certificação de conformidade.
