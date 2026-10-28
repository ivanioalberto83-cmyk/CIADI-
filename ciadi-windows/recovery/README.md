# Recuperação segura do CIADI Windows

## Âmbito
Este mecanismo guarda uma cópia local dos ficheiros instalados da aplicação Windows antes de descarregar uma atualização. O ponto de recuperação é destinado a reverter **os ficheiros da aplicação**, não os dados alojados no Supabase.

Local dos pontos de recuperação:
`%LOCALAPPDATA%\CIADI\Recovery\`

Cada ponto contém `app/` e `manifest.json`. O sistema mantém os cinco pontos mais recentes.

## Fluxo
1. Antes de descarregar uma atualização, a aplicação copia a pasta instalada para um ponto de recuperação.
2. Se o backup falhar, a atualização não deve ser descarregada.
3. Se a nova versão apresentar problemas, fechar o CIADI e restaurar a aplicação com o script `Restore-CIADI.ps1`.
4. Abrir a aplicação e validar autenticação, ligação ao Supabase e módulos críticos.

## Restaurar
1. Abrir PowerShell **como Administrador**.
2. Para ver o ponto mais recente sem alterar ficheiros:

   ```powershell
.\Restore-CIADI.ps1
```

3. Depois de verificar o ponto e o destino, executar:

   ```powershell
.\Restore-CIADI.ps1 -ConfirmRestore
```

É possível indicar um ponto específico com `-BackupPath 'C:\caminho\para\o\ponto'`.

## Segurança e limites
- O script faz uma cópia dos ficheiros atuais antes de restaurar.
- A restauração de ficheiros requer privilégios de Administrador e confirmação explícita.
- Não restaura nem apaga dados do Supabase, ficheiros clínicos remotos, configurações secretas ou credenciais.
- Não fazer rollback de esquema/dados Supabase automaticamente: alterações de dados podem ter sido feitas depois do backup e a restauração pode eliminar registos válidos.
- Os backups locais podem conter código interno da aplicação; proteja o perfil Windows e mantenha espaço livre suficiente.
- A cópia de segurança local não substitui o backup remoto nem o teste de restauração do Supabase.
- Antes de declarar recuperação automática validada, testar a cópia, uma atualização de homologação e a restauração num PC de teste.

Este recurso ainda não deve ser considerado mecanismo de rollback totalmente automático: ele cria pontos de recuperação automaticamente, mas a restauração dos ficheiros é deliberadamente assistida para evitar uma substituição incorreta.
