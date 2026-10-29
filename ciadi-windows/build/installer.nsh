!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!ifndef BUILD_UNINSTALLER
Var CIADIProfile
Var CIADIProfileDialog
Var CIADIProfileRadioADM
Var CIADIProfileRadioSupport
Var CIADIProfileRadioRH
Var CIADIProfileRadioReception

!macro customWelcomePage
  Page custom CIADIProfilePageCreate CIADIProfilePageLeave
!macroend

Function CIADIProfilePageCreate
  nsDialogs::Create 1018
  Pop $CIADIProfileDialog
  ${If} $CIADIProfileDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 20u "Selecione o perfil desta estação CIADI:"
  Pop $0
  ${NSD_CreateLabel} 0 20u 100% 32u "Esta opção identifica a estação. Não concede permissões nem substitui o login CIADI."
  Pop $0

  ${NSD_CreateRadioButton} 0 58u 100% 16u "ADM — Administração"
  Pop $CIADIProfileRadioADM
  ${NSD_CreateRadioButton} 0 82u 100% 16u "Suporte Informático"
  Pop $CIADIProfileRadioSupport
  ${NSD_CreateRadioButton} 0 106u 100% 16u "Recursos Humanos (RH)"
  Pop $CIADIProfileRadioRH
  ${NSD_CreateRadioButton} 0 130u 100% 16u "Receção"
  Pop $CIADIProfileRadioReception

  ${NSD_Check} $CIADIProfileRadioADM
  nsDialogs::Show
FunctionEnd

Function CIADIProfilePageLeave
  ${NSD_GetState} $CIADIProfileRadioADM $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADIProfile "adm"
    Return
  ${EndIf}

  ${NSD_GetState} $CIADIProfileRadioSupport $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADIProfile "suporte_informatica"
    Return
  ${EndIf}

  ${NSD_GetState} $CIADIProfileRadioRH $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADIProfile "rh"
    Return
  ${EndIf}

  ${NSD_GetState} $CIADIProfileRadioReception $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADIProfile "recepcao"
    Return
  ${EndIf}

  MessageBox MB_ICONEXCLAMATION|MB_OK "Selecione um perfil para continuar."
  Abort
FunctionEnd
!endif

!macro customInstall
  ${If} $CIADIProfile == ""
    StrCpy $CIADIProfile "adm"
  ${EndIf}
  FileOpen $0 "$INSTDIR\\ciadi-install-profile.txt" w
  FileWrite $0 "$CIADIProfile"
  FileClose $0
!macroend
