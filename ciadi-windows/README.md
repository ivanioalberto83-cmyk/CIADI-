# CIADI Dashboard para Windows

Este diretório empacota o dashboard existente como aplicação Windows (Electron/NSIS). A camada Electron fornece instalação, diagnóstico técnico local e atualização assistida; não reescreve os módulos nem migra automaticamente o Supabase.

## Fonte da aplicação
- A raiz do repositório deve conter `CIADI_DASHBOARD_FINANCEIRO.html`.
- O workflow de compilação copia esse ficheiro para `ciadi-windows/index.html` sem editar o original.
- Não substitua nem reorganize a estrutura do dashboard para publicar uma atualização. Faça alterações funcionais no ficheiro original, teste-as e mantenha uma cópia/commit da versão anterior.

## Compilação e validação gratuitas
- O workflow `CIADI Windows - validação gratuita` valida a sintaxe JavaScript e tenta compilar o instalador em cada pull request relevante para `main`.
- Após uma execução bem-sucedida, descarregue o artefacto `CIADI-Windows-Setup-homologacao` na página da execução. É um instalador de teste, disponível por 7 dias.
- Também pode iniciar esse workflow manualmente em **Actions**.
- O GitHub Actions tem limites de utilização que dependem do tipo de repositório e da conta. Não foi contratado nenhum serviço pago para esta etapa.

## Publicar uma atualização automática
1. Confirme que o HTML atualizado está na raiz e que foi testado.
2. Crie e envie uma tag de versão no formato `ciadi-vMAJOR.MINOR.PATCH`, por exemplo `ciadi-v1.0.1`.
3. O workflow de release sincroniza a versão do pacote, compila o instalador e publica a release com `CIADI-Setup-*.exe`, `latest.yml` e os ficheiros `*.blockmap`.
4. As instalações existentes verificam a GitHub Release através de `electron-updater`; o utilizador decide quando descarregar e instalar.

**Não criar uma tag de produção nem publicar uma release antes de concluir a homologação num PC de teste.** A validação automática de compilação não substitui testes de instalação, atualização, persistência e recuperação.

## Diagnóstico técnico
No menu **Ajuda → Exportar diagnóstico técnico…**, o utilizador pode guardar localmente um relatório JSON com versão da aplicação, sistema operativo e estado do atualizador. O relatório não é enviado automaticamente. Reveja o conteúdo antes de o partilhar com o suporte.

## Proteção dos dados e do Supabase
- O atualizador substitui ficheiros da aplicação; o instalador está configurado para não eliminar dados da aplicação ao desinstalar.
- Não faça alterações destrutivas ao esquema do Supabase como parte de uma atualização normal. Se uma funcionalidade exigir mudanças de base de dados, use migrações SQL versionadas, compatibilidade retroativa, backup e validação antes de produção.
- Não coloque service-role keys, palavras-passe, tokens, certificados ou chaves privadas no HTML, repositório ou pacote. O browser não deve receber credenciais administrativas do Supabase.
- A manutenção remota assistida (controlo do ecrã/teclado) ainda não está implementada. Não existe agente oculto nem acesso remoto persistente nesta alteração.

## Assinatura
A assinatura de produção do executável requer um certificado de assinatura de código válido. Sem esse certificado, o Windows poderá apresentar avisos de editor desconhecido. Para começar, usamos ferramentas gratuitas e não ativamos serviços pagos sem autorização.

## Estado
A compilação e os testes de Windows ainda precisam de ser executados pelo workflow e validados num PC de homologação. Não considerar o instalador pronto para produção apenas porque o código foi enviado.
