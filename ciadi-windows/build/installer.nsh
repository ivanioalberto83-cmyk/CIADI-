!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

Var CIADIProfile
Var CIADIProfileDialog
Var CIADIProfileRadioPolo001
Var CIADIProfileRadioPolo002
Var CIADIProfileRadioAdm
Var CIADIProfileRadioSupport

!macro customPageAfterChangeDir
  Page custom CIADIProfilePageCreate CIADIProfilePageLeave
!macroend

Function CIADIProfilePageCreate
  nsDialogs::Create 1018
  Pop $CIADIProfileDialog
  ${If} $CIADIProfileDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 20u "Selecione o perfil de instalação do CIADI:"
  Pop $0
  ${NSD_CreateLabel} 0 18u 100% 28u "Esta escolha configura o perfil da aplicação; não substitui o login nem as permissões do Supabase."
  Pop $0

  ${NSD_CreateRadioButton} 0 52u 100% 16u "Polo 001"
  Pop $CIADIProfileRadioPolo001
  ${NSD_CreateRadioButton} 0 76u 100% 16u "Polo 002"
  Pop $CIADIProfileRadioPolo002
  ${NSD_CreateRadioButton} 0 100u 100% 16u "ADM — Administração"
  Pop $CIADIProfileRadioAdm
  ${NSD_CreateRadioButton} 0 124u 100% 16u "Suporte Informática — acesso ao agente"
  Pop $CIADIProfileRadioSupport

  ${NSD_Check} $CIADIProfileRadioPolo001
  nsDialogs::Show
FunctionEnd

Function CIADIProfilePageLeave
  ${NSD_GetState} $CIADIProfileRadioPolo001 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADIProfile "polo001"
    Return
  ${EndIf}

  ${NSD_GetState} $CIADIProfileRadioPolo002 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADIProfile "polo002"
    Return
  ${EndIf}

  ${NSD_GetState} $CIADIProfileRadioAdm $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADIProfile "adm"
    Return
  ${EndIf}

  ${NSD_GetState} $CIADIProfileRadioSupport $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADIProfile "suporte_informatica"
    Return
  ${EndIf}

  MessageBox MB_ICONEXCLAMATION|MB_OK "Selecione um perfil para continuar."
  Abort
FunctionEnd

!macro customInstall
  ${If} $CIADIProfile == ""
    StrCpy $CIADIProfile "polo001"
  ${EndIf}
  FileOpen $0 "$INSTDIR\ciadi-install-profile.txt" w
  FileWrite $0 "$CIADIProfile"
  FileClose $0
!macroend
