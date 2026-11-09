!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

Var StationProfile
Var StationRadioAdm
Var StationRadioSupport
Var StationRadioRh
Var StationRadioReception

!macro customHeader
  Page custom StationPageCreate StationPageLeave
!macroend

Function StationPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 30u "Selecione o perfil desta estação. Esta escolha identifica o posto de trabalho e não concede permissões de utilizador."
  Pop $1
  ${NSD_CreateRadioButton} 0 38u 100% 14u "Administrador (ADM)"
  Pop $StationRadioAdm
  ${NSD_CreateRadioButton} 0 58u 100% 14u "Suporte Informático"
  Pop $StationRadioSupport
  ${NSD_CreateRadioButton} 0 78u 100% 14u "Recursos Humanos (RH)"
  Pop $StationRadioRh
  ${NSD_CreateRadioButton} 0 98u 100% 14u "Receção"
  Pop $StationRadioReception

  ReadINIStr $StationProfile "$LOCALAPPDATA\CIADI\station-profile.ini" "Station" "profile"
  ${If} $StationProfile == "adm"
    ${NSD_Check} $StationRadioAdm
  ${ElseIf} $StationProfile == "suporte"
    ${NSD_Check} $StationRadioSupport
  ${ElseIf} $StationProfile == "rh"
    ${NSD_Check} $StationRadioRh
  ${ElseIf} $StationProfile == "rececao"
    ${NSD_Check} $StationRadioReception
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function StationPageLeave
  StrCpy $StationProfile ""
  ${NSD_GetState} $StationRadioAdm $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $StationProfile "adm"
  ${EndIf}
  ${NSD_GetState} $StationRadioSupport $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $StationProfile "suporte"
  ${EndIf}
  ${NSD_GetState} $StationRadioRh $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $StationProfile "rh"
  ${EndIf}
  ${NSD_GetState} $StationRadioReception $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $StationProfile "rececao"
  ${EndIf}

  ${If} $StationProfile == ""
    MessageBox MB_ICONEXCLAMATION|MB_OK "Selecione um perfil de estação para continuar."
    Abort
  ${EndIf}
FunctionEnd

!macro customInstall
  CreateDirectory "$LOCALAPPDATA\CIADI"
  WriteINIStr "$LOCALAPPDATA\CIADI\station-profile.ini" "Station" "profile" "$StationProfile"
!macroend
