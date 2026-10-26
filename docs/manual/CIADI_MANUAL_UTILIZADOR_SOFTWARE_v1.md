# CIADI — Manual do Utilizador do Software
**Versão documental:** 1.0 — 26 de outubro de 2026  
**Produto documentado:** CIADI Dashboard Clínico & Administrativo (interface Web/HTML do repositório)  
**Base de dados:** Supabase — projeto `egpkkttbcaukqnnxyhjv`  
**Estado:** manual de referência baseado na inspeção do código e do esquema; validar os passos no ambiente de homologação antes de distribuir como manual operacional final.

> **Nota importante sobre o âmbito:** este documento distingue funcionalidades visíveis na versão principal do Dashboard de tabelas existentes na base de dados e de módulos ainda não confirmados na interface. RH tem tabelas dedicadas, mas não foi encontrado um menu de RH na interface `index.html` da branch `main`. Aprovisionamento possui catálogo e solicitações de materiais; compras, fornecedores, receções e gestão integrada de stock não foram confirmados como módulo completo. Não considerar essas funcionalidades disponíveis até serem implementadas e testadas.

---

## 1. Objetivo e público-alvo

Este manual orienta administradores, gestores, profissionais e utilizadores autorizados na navegação e operação do CIADI. Abrange o Dashboard Web, os fluxos clínicos e administrativos que aparecem no menu da versão analisada, os materiais e as conclusões da auditoria dos módulos de Recursos Humanos (RH) e Aprovisionamento.

### 1.1 Regras de utilização
- Usar apenas uma conta individual autorizada. Não partilhar palavras-passe nem sessões.
- Confirmar o paciente, profissional, data e documento antes de guardar ou emitir.
- Introduzir dados verdadeiros e estritamente necessários; em formação e testes usar dados fictícios.
- Não descarregar, exportar ou partilhar informação clínica, financeira ou laboral sem autorização.
- Sair da sessão em computadores partilhados e bloquear o posto quando se ausentar.
- Se a informação estiver errada, não criar registos duplicados para contornar o problema: comunicar ao administrador e seguir o procedimento de correção autorizado.
- A interface e os nomes dos botões podem mudar entre versões. Este manual deve ser atualizado após cada versão homologada.

## 2. Acesso e navegação

1. Abrir a URL institucional autorizada ou o atalho instalado pela equipa técnica.
2. Confirmar que a página apresenta a identidade CIADI e que a ligação é HTTPS quando acedida pela Web.
3. Iniciar sessão com as credenciais fornecidas pelo administrador.
4. Se o acesso falhar, confirmar a ligação à Internet, a conta e o estado da sessão; não tentar contornar permissões.
5. Após entrar, usar o menu lateral. O menu da versão analisada contém as áreas listadas abaixo.
6. A opção **Acompanhantes Terapêuticos (A.T.)** é apresentada apenas a perfis que passam a verificação de acesso da interface. A visibilidade do menu não substitui as políticas de segurança da base de dados.

### 2.1 Menu confirmado na interface analisada
- Visão geral
- Alertas SOS
- Pedidos de triagem (site)
- Agendamentos Clínicos
- Financeiro
- Faturação
- Caixa & Tesouraria
- Contabilidade
- SAF-T(AO)
- Especialidades
- Triagens
- Pacientes & famílias
- Profissionais
- Documentos & Formulários Clínicos
- Portal & famílias
- Conteúdos do site
- Conteúdos Multimédia
- Marketing Digital
- Janeth
- Utilizadores
- Instituição & redes
- Empresas & Emitente
- Clínica virtual
- Auditoria
- Acompanhantes Terapêuticos (A.T.), sujeito a autorização

## 3. Visão geral

A página inicial apresenta indicadores operacionais e atalhos para áreas clínicas e administrativas. Os indicadores dependem dos dados que a conta tem autorização para consultar e da disponibilidade do Supabase.

**Procedimento**
1. Entrar em **Visão geral**.
2. Verificar se os cartões carregam números e se não existe aviso de erro.
3. Usar os atalhos para abrir pacientes, profissionais, documentos, materiais, conteúdos ou marketing.
4. Se um número parecer incorreto, registar a data/hora e o nome do indicador e solicitar validação ao administrador. Não corrigir diretamente a base de dados.

## 4. Operações clínicas

### 4.1 Pacientes & famílias
1. Abrir **Pacientes & famílias**.
2. Pesquisar o paciente existente antes de iniciar um novo registo.
3. Confirmar a identidade com os dados autorizados e evitar duplicados.
4. Consultar ou editar apenas os campos permitidos ao seu perfil.
5. Guardar e confirmar se o sistema apresenta mensagem de sucesso.
6. Se o paciente não aparecer, confirmar os filtros e a autorização; não criar um duplicado como alternativa.

### 4.2 Profissionais
1. Abrir **Profissionais**.
2. Pesquisar pelo nome ou registo profissional.
3. Confirmar especialidade, estado ativo e dados de identificação.
4. Alterações de registo, estado ou permissões devem ser feitas apenas por utilizador autorizado e documentadas conforme o procedimento interno.

### 4.3 Especialidades
1. Abrir **Especialidades**.
2. Consultar o catálogo existente antes de adicionar uma especialidade.
3. Ao criar/editar, preencher nome, descrição e estado conforme os campos apresentados.
4. Não duplicar especialidades com grafias diferentes; pedir ao administrador para normalizar o catálogo.

### 4.4 Agendamentos Clínicos
A interface analisada inclui consulta, criação, edição, cancelamento e impressão/PDF de agendamentos; para consultas online pode existir ação para iniciar a consulta.

1. Abrir **Agendamentos Clínicos**.
2. Confirmar paciente, profissional, especialidade, data/hora, duração e tipo de atendimento.
3. Selecionar **Novo agendamento** para criar ou **Editar** num registo existente, conforme a autorização.
4. Confirmar os dados antes de guardar.
5. Para cancelar, usar a ação de cancelamento disponível e confirmar o registo correto. Não apagar o histórico para ocultar um cancelamento.
6. Para imprimir, usar a opção PDF e verificar o resultado antes de entregar.
7. Para consulta online, usar o botão de iniciar consulta apenas no momento previsto e verificar se a sala abre corretamente. Se aparecer “agendamento inválido”, URL inseguro ou falha de sessão, parar e reportar à equipa técnica.

### 4.5 Triagens e pedidos do site
- **Pedidos de triagem (site):** consultar pedidos recebidos, verificar duplicados e encaminhar conforme o procedimento clínico.
- **Triagens:** abrir o registo, rever a informação e preencher apenas os campos que competem ao seu perfil.
- Não usar a triagem como diagnóstico definitivo. Encaminhar decisões clínicas para o profissional responsável.
- Se um pedido não puder ser aberto, registar o identificador do pedido sem divulgar dados pessoais em canais não autorizados.

### 4.6 Documentos & Formulários Clínicos
1. Abrir **Documentos & Formulários Clínicos**.
2. Selecionar o tipo de documento adequado e confirmar o paciente associado.
3. Preencher todos os campos obrigatórios com informação verificável.
4. Rever conteúdo, datas, autor e destinatário antes de guardar, assinar ou gerar PDF.
5. Confirmar que o documento foi guardado e que o ficheiro gerado abre corretamente.
6. Não assinar em nome de outro profissional nem alterar um documento finalizado sem o procedimento de retificação previsto.
7. Se a impressão, assinatura, PDF ou validação QR falhar, preservar o registo e comunicar o erro; evitar várias emissões que possam gerar duplicados.

### 4.7 Portal & famílias
Usar esta área para as funções de portal disponibilizadas à conta. Confirmar sempre que o paciente/criança associado é o correto e que o vínculo familiar está autorizado. Não assumir que o utilizador tem acesso a todos os pacientes.

### 4.8 Acompanhantes Terapêuticos (A.T.)
1. Abrir a área apenas se o menu estiver disponível e o acesso tiver sido autorizado.
2. Confirmar o paciente, profissional A.T., período e permissões da atribuição.
3. Rever as atribuições ativas antes de criar ou alterar uma.
4. Registar apenas informação operacional necessária, respeitando as permissões clínicas.
5. Se o paciente ou profissional esperado não aparecer, não contornar os filtros nem reutilizar uma atribuição de outra pessoa. Solicitar revisão ao administrador.
6. A disponibilidade do menu não prova que todos os controlos de acesso na base de dados estão corretos; a homologação de segurança é obrigatória.

## 5. Alertas SOS

1. Abrir **Alertas SOS**.
2. Consultar os alertas apresentados e priorizar conforme o protocolo interno de segurança.
3. Confirmar o estado do alerta e a pessoa responsável pelo seguimento.
4. Registar atendimento ou encaminhamento apenas se a interface permitir e de acordo com a função atribuída.
5. Um alerta não deve ser considerado resolvido apenas por ter sido visualizado. Confirmar a resposta efetiva.
6. Em perigo imediato, aplicar o protocolo de emergência do CIADI e os contactos locais adequados; não depender exclusivamente da aplicação.
7. Se os alertas em tempo real não atualizarem, atualizar a vista uma vez, verificar a ligação e comunicar a falha. Não criar alertas duplicados sem confirmar o estado anterior.

## 6. Gestão de materiais e Aprovisionamento

### 6.1 Funcionalidades confirmadas
A base de dados contém:
- `ciadi_materiais_apoio`: catálogo de materiais de apoio.
- `ciadi_solicitacoes_materiais`: pedidos/solicitações de materiais.
- `ciadi_solicitacoes_materiais_historico`: histórico das solicitações.

A interface da versão principal inclui uma contagem de materiais no painel e uma ligação do cartão para a área de famílias/materiais. As políticas existentes permitem leitura pública apenas de materiais publicados, ativos e disponíveis; a escrita está limitada a utilizadores autorizados pela função de equipa. As solicitações podem ser consultadas por equipa e por utilizadores ligados ao pedido, de acordo com as políticas.

### 6.2 Consultar o catálogo
1. Aceder à área da interface onde os materiais de apoio são apresentados.
2. Pesquisar o material antes de solicitar outro semelhante.
3. Confirmar descrição, disponibilidade e estado publicado/ativo.
4. Se o material estiver indisponível, não assumir que existe stock físico. O catálogo de materiais de apoio não é, por si só, um inventário de armazém.

### 6.3 Criar ou acompanhar uma solicitação
1. Abrir a função de solicitação disponibilizada à sua conta.
2. Selecionar o material e preencher a quantidade e a justificação, quando solicitadas.
3. Confirmar o paciente, profissional ou responsável associado, se aplicável.
4. Submeter uma única vez e aguardar a confirmação.
5. Consultar o estado do pedido e o histórico antes de repetir a submissão.
6. Se o pedido estiver incorreto, pedir a correção pelo fluxo autorizado; não apagar o histórico nem alterar diretamente dados.

### 6.4 Limites atuais do módulo
Não foi confirmado na interface principal nem no esquema consultado um módulo completo com fornecedores, pedidos de compra, aprovações de compra, receções, armazéns, movimentos de stock e inventário. Esses fluxos são **pendentes de implementação/validação**. Até serem homologados:
- não registar uma encomenda como se fosse uma compra aprovada;
- não assumir que uma solicitação desconta automaticamente o stock;
- não usar o catálogo como registo contabilístico;
- não declarar controlo de lote, validade ou stock mínimo como funcionalidade disponível.

## 7. Recursos Humanos (RH)

### 7.1 O que existe na base de dados
Foram identificadas tabelas dedicadas a:
- colaboradores (`ciadi_funcionarios`);
- contratos (`ciadi_funcionario_contratos`);
- documentos (`ciadi_funcionario_documentos`);
- assiduidade (`ciadi_funcionario_assiduidade`);
- férias e licenças (`ciadi_funcionario_ferias_licencas`);
- avaliações (`ciadi_funcionario_avaliacoes`);
- benefícios (`ciadi_funcionario_beneficios`);
- competências (`ciadi_funcionario_competencias`);
- formação (`ciadi_funcionario_formacoes`);
- histórico (`ciadi_funcionario_historico`);
- informação confidencial (`ciadi_funcionario_confidencial`).

### 7.2 Estado da interface
Na versão `main` de `index.html` analisada, não foi encontrado um item de menu RH nem foi confirmada uma interface de utilizador operacional para gerir estas tabelas. Por isso, esta secção é uma orientação de processo e não uma afirmação de que os ecrãs já estão disponíveis.

### 7.3 Procedimento operacional previsto — apenas após disponibilização da interface
- **Admissão/cadastro:** validar identidade e dados necessários, associar cargo/departamento e estado, e verificar duplicados.
- **Contrato:** anexar ou registar o contrato aprovado, datas e estado; restringir o acesso a pessoas autorizadas.
- **Assiduidade:** registar data, entrada/saída e ocorrências com justificação; corrigir erros pelo mecanismo auditável.
- **Férias/licenças:** submeter pedido, obter aprovação de responsável diferente do solicitante quando exigido e confirmar o saldo/registo.
- **Formação/competências:** registar formação concluída e competências verificadas, com evidência quando aplicável.
- **Avaliação:** indicar período e avaliador, documentar resultados e objetivos, e respeitar o processo de revisão.
- **Documentos/histórico:** manter versões e rastreabilidade, sem apagar registos relevantes.

### 7.4 Proteção de dados laborais
A auditoria de leitura encontrou políticas `is_staff()` com permissões amplas em várias tabelas de RH, enquanto tabelas de dados confidenciais e benefícios têm políticas mais restritas para admin/gestor. Antes de ativar ou divulgar o módulo RH:
- rever o alcance real de `is_staff()` e a matriz de funções;
- confirmar que profissionais clínicos não recebem automaticamente acesso a contratos, remuneração, NIF, IBAN ou documentos laborais;
- testar admin, gestor, profissional A.T., profissional não A.T., paciente e responsável com contas fictícias;
- manter documentos pessoais em armazenamento privado e autorizar downloads de forma temporária;
- verificar auditoria de consultas, alterações, exportações e aprovações.
**Não inserir dados laborais reais até a revisão de permissões estar concluída.**

## 8. Financeiro, faturação, tesouraria e contabilidade

> As áreas abaixo constam no menu. A disponibilidade de cada operação depende das permissões, da configuração e da homologação fiscal. A presença de um ecrã não significa, por si só, conformidade fiscal ou contabilística.

### 8.1 Financeiro
1. Abrir **Financeiro**.
2. Rever indicadores e período de referência.
3. Abrir os detalhes antes de usar os valores em relatórios ou decisões.
4. Se os totais não coincidirem com documentos e pagamentos, suspender a divulgação e solicitar reconciliação.

### 8.2 Faturação
1. Abrir **Faturação**.
2. Confirmar entidade/cliente, serviço, valor, data e série autorizada.
3. Verificar se já existe documento para a mesma operação antes de emitir.
4. Rever todos os campos antes de confirmar a emissão.
5. Guardar o número do documento e conferir PDF/visualização.
6. Para anulação, correção ou nota de crédito/débito, seguir o procedimento contabilístico aprovado; não apagar o documento original.

### 8.3 Caixa & Tesouraria
- Registar movimentos apenas com documento de suporte.
- Conferir caixa/conta, data, valor, moeda e referência.
- Conciliar recebimentos com os documentos correspondentes.
- Diferenças de caixa devem ser justificadas e escaladas, nunca compensadas com lançamentos sem suporte.

### 8.4 Contabilidade
- Confirmar empresa, período, contas e documento de origem.
- Validar que débitos e créditos equilibram antes de finalizar o lançamento.
- Usar estorno documentado em vez de apagar um lançamento já contabilizado.
- Conferir balancete, DRE e balanço com os registos de origem antes de distribuir relatórios.

### 8.5 SAF-T(AO)
- Aceder apenas com perfil financeiro autorizado.
- Confirmar período, identificação fiscal, séries e documentos antes de gerar uma exportação.
- Verificar o ficheiro e os registos de diagnóstico.
- A geração de XML bem-formado não prova, isoladamente, validação XSD oficial nem conformidade fiscal. Não apresentar a exportação como validada pela AGT sem validação técnica/fiscal apropriada.

### 8.6 Empresas & Emitente
- Confirmar a entidade emissora correta antes de emitir documentos.
- Verificar identificação fiscal, morada, contactos, logótipo e dados de faturação.
- Alterações a dados fiscais ou séries devem ser autorizadas e testadas antes de uso real.

## 9. Conteúdos, comunicação e apoio

### 9.1 Conteúdos do site e Conteúdos Multimédia
1. Abrir a área correspondente.
2. Rever o conteúdo existente antes de criar uma versão nova.
3. Confirmar texto, imagem, autorização de publicação e estado.
4. Não publicar dados pessoais, fotografias de crianças ou informação clínica sem base legal, autorização e validação institucional.

### 9.2 Marketing Digital
- Rever campanhas, destinatários e conteúdos antes de qualquer envio.
- Usar apenas listas de contactos autorizadas e respeitar preferências de comunicação.
- Não exportar contactos clínicos para campanhas sem autorização específica.

### 9.3 Janeth
Usar a assistente como apoio informativo, não como substituta de avaliação profissional, decisão clínica, aconselhamento jurídico ou validação fiscal. Não inserir segredos, palavras-passe, tokens ou dados pessoais desnecessários.

### 9.4 Instituição & redes
Manter contactos, ligações e dados institucionais atualizados. Confirmar os endereços antes de publicar e não alterar credenciais de contas externas dentro de campos públicos.

### 9.5 Clínica virtual
Antes da consulta, confirmar agendamento, participante, ligação segura, microfone/câmara e consentimentos aplicáveis. Após a consulta, fechar a sala de forma segura. Se a sala abrir para o agendamento errado ou falhar a validação, interromper o procedimento e contactar suporte.

## 10. Utilizadores, permissões e auditoria

### 10.1 Utilizadores
- Criar ou alterar contas apenas quando autorizado.
- Atribuir o perfil mínimo necessário para a função.
- Remover ou desativar acessos quando deixam de ser necessários, seguindo o procedimento institucional.
- Não conceder privilégios de admin para resolver problemas temporários.

### 10.2 Auditoria
A área **Auditoria** destina-se à consulta de eventos e alterações que estejam registados. Usá-la para investigar uma ocorrência com data/hora, utilizador e registo afetado. A ausência de um evento na lista não prova que nenhuma ação ocorreu se a funcionalidade não tiver registado esse tipo de evento.

## 11. Erros frequentes e resposta

| Sintoma | O que fazer |
|---|---|
| Ecrã fica em “A carregar…” | Verificar a ligação, aguardar brevemente e atualizar uma vez. Se persistir, registar módulo, data/hora e erro visível. |
| Sessão expirada ou acesso negado | Iniciar sessão novamente. Se continuar, pedir revisão de perfil; não partilhar credenciais. |
| Paciente/profissional não aparece | Confirmar filtros, estado ativo, vínculo/atribuição e permissões. Não criar duplicados. |
| Registo não guarda | Confirmar campos obrigatórios e mensagem de erro; não repetir várias vezes sem verificar se o registo foi criado. |
| PDF não abre ou sai incompleto | Confirmar bloqueio de pop-ups/impressão, tentar a pré-visualização uma vez e reportar. Não emitir documentos duplicados. |
| Consulta online inválida | Confirmar agendamento e sessão. Não alterar manualmente parâmetros de URL nem partilhar tokens. |
| Alerta SOS não atualiza | Atualizar a vista uma vez e reportar; aplicar também o protocolo operacional de emergência. |
| Stock ou compra não aparece | Distinguir catálogo/solicitação de materiais de um módulo de compras/stock, ainda não confirmado como completo. |

### 11.1 Como reportar um incidente
Enviar ao suporte: módulo, passos que antecederam o erro, data/hora local, mensagem exata, navegador/versão e identificador interno do registo quando autorizado. Anexar captura de ecrã apenas se não expuser dados pessoais, clínicos, financeiros ou credenciais.

## 12. Segurança e privacidade

- Usar HTTPS e dispositivos atualizados.
- Nunca copiar chaves secretas, tokens JWT, palavras-passe ou dados de sessão para mensagens, capturas ou tickets.
- Não colocar a chave `service_role` em HTML, aplicações móveis ou outros clientes públicos.
- Tratar dados clínicos, familiares, laborais e financeiros como confidenciais.
- Verificar destinatários antes de exportar ou imprimir.
- Guardar documentos apenas nos locais institucionais aprovados.
- Comunicar imediatamente suspeita de acesso indevido, perda de dispositivo, envio errado ou exposição de dados.
- Fazer cópias de segurança e testar restauro segundo o procedimento técnico; uma cópia não testada não deve ser considerada recuperável.
- Não executar SQL, alterar políticas RLS ou modificar dados de produção a partir de instruções deste manual.

## 13. Lista de verificação por função

### Profissional clínico
- [ ] Confirmar paciente e agendamento antes do atendimento.
- [ ] Registar apenas informação necessária ao atendimento.
- [ ] Rever documentos antes de finalizar.
- [ ] Proteger e encerrar a sessão no fim do turno.

### Receção/administrativo
- [ ] Pesquisar antes de criar paciente ou agendamento.
- [ ] Confirmar dados e estado antes de guardar.
- [ ] Não alterar dados clínicos sem autorização.
- [ ] Encaminhar falhas de faturação ao responsável financeiro.

### Financeiro/contabilidade
- [ ] Confirmar emitente, série, período e documento de origem.
- [ ] Conferir totais e reconciliações.
- [ ] Preservar o histórico de anulações/estornos.
- [ ] Não declarar conformidade AGT/SAF-T sem validação apropriada.

### Administrador técnico
- [ ] Rever acessos e perfis periodicamente.
- [ ] Testar RLS com perfis fictícios.
- [ ] Confirmar backups e restauro.
- [ ] Manter migrações versionadas, testes e plano de reversão.
- [ ] Separar homologação de produção.

## 14. Pendências para a próxima versão do manual

Antes de designar este documento como manual final de produção, concluir:
1. Confirmar a versão exata do Dashboard Windows e do instalador em uso.
2. Mapear e testar todos os formulários e ações de cada ecrã.
3. Construir e homologar a interface RH e a matriz de acesso, sem expor dados confidenciais.
4. Definir se Aprovisionamento será apenas gestão de materiais/solicitações ou também compras, fornecedores, receções e inventário; implementar apenas após desenho e aprovação.
5. Testar permissões RLS com contas fictícias para todos os perfis.
6. Validar criação, edição, impressão/PDF, auditoria, notificações e comportamento em caso de falha.
7. Rever os procedimentos financeiros e a validação fiscal com responsável qualificado.
8. Produzir uma versão PDF com logótipo CIADI, capturas reais de homologação e controlo de versão depois dos testes.

---

**Controlo documental**  
Responsável institucional: CIADI  
Documento: Manual do Utilizador do Software CIADI  
Versão: 1.0 (rascunho de homologação)  
Data: 26/10/2026  
Estado de aprovação: pendente de validação funcional e institucional  


## 8. Documentos complementares e estado de aprovação

A documentação associada a esta versão está na mesma branch de revisão:

- **Base Institucional de Procedimentos (BIP), versão 0.1:** [abrir documento](../procedimentos/CIADI_BASE_INSTITUCIONAL_PROCEDIMENTOS_v0.1.md).
- **Plano de testes de segurança de RH e Aprovisionamento:** [abrir documento](../security/2026-10-26-plano-testes-rh-aprovisionamento.md).

Estes documentos são minutas para revisão. A base de procedimentos ainda requer aprovação da Direção, validação clínica/técnica, nomeação de responsáveis e confirmação dos contactos de emergência e salvaguarda. O manual deve ser considerado documento de referência em revisão até a homologação confirmar os passos no software real.

