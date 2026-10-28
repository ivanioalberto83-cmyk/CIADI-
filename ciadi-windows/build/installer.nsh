!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var CIADIProfileDialog
Var CIADIProfileADM
Var CIADIProfileSupport
Var CIADIProfileHR
Var CIADIProfileReception
Var CIADIProfileChoice
Var CIADIProfileLabel
Var CIADIProfileExisting

!macro customWelcomePage
  Page custom CIADIProfilePage CIADIProfilePageLeave
!macroend

Function CIADIProfilePage
  nsDialogs::Create 1018
  Pop $CIADIProfileDialog
  ${If} $CIADIProfileDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "Escolha o perfil desta estação CIADI. Esta escolha personaliza a identificação e os atalhos; não altera as permissões da conta."
  Pop $0

  ${NSD_CreateRadioButton} 0 38u 100% 18u "ADM — Administração global"
  Pop $CIADIProfileADM
  ${NSD_CreateRadioButton} 0 62u 100% 18u "Suporte Informático — diagnóstico e suporte"
  Pop $CIADIProfileSupport
  ${NSD_CreateRadioButton} 0 86u 100% 18u "RH — Recursos Humanos"
  Pop $CIADIProfileHR
  ${NSD_CreateRadioButton} 0 110u 100% 18u "Receção — atendimento e registo"
  Pop $CIADIProfileReception

  ReadRegStr $CIADIProfileExisting HKCU "Software\CIADI\Dashboard" "StationProfile"
  ${If} $CIADIProfileExisting == "suporte_informatica"
    ${NSD_Check} $CIADIProfileSupport
  ${ElseIf} $CIADIProfileExisting == "rh"
    ${NSD_Check} $CIADIProfileHR
  ${ElseIf} $CIADIProfileExisting == "rececao"
    ${NSD_Check} $CIADIProfileReception
  ${Else}
    ${NSD_Check} $CIADIProfileADM
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function CIADIProfilePageLeave
  ${NSD_GetState} $CIADIProfileADM $0
  ${If} $0 == 1
    StrCpy $CIADIProfileChoice "admin"
    StrCpy $CIADIProfileLabel "ADM"
  ${Else}
    ${NSD_GetState} $CIADIProfileSupport $0
    ${If} $0 == 1
      StrCpy $CIADIProfileChoice "suporte_informatica"
      StrCpy $CIADIProfileLabel "Suporte Informático"
    ${Else}
      ${NSD_GetState} $CIADIProfileHR $0
      ${If} $0 == 1
        StrCpy $CIADIProfileChoice "rh"
        StrCpy $CIADIProfileLabel "RH"
      ${Else}
        ${NSD_GetState} $CIADIProfileReception $0
        ${If} $0 == 1
          StrCpy $CIADIProfileChoice "rececao"
          StrCpy $CIADIProfileLabel "Receção"
        ${Else}
          MessageBox MB_ICONEXCLAMATION|MB_OK "Seleccione um dos quatro perfis para continuar."
          Abort
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}
FunctionEnd

!macro customInstall
  SetShellVarContext current
  WriteRegStr HKCU "Software\CIADI\Dashboard" "StationProfile" "$CIADIProfileChoice"
  WriteRegStr HKCU "Software\CIADI\Dashboard" "StationProfileLabel" "$CIADIProfileLabel"

  ; Recria apenas o atalho correspondente à escolha actual.
  Delete "$DESKTOP\CIADI - ADM.lnk"
  Delete "$DESKTOP\CIADI - Suporte Informático.lnk"
  Delete "$DESKTOP\CIADI - RH.lnk"
  Delete "$DESKTOP\CIADI - Receção.lnk"
  CreateDirectory "$SMPROGRAMS\CIADI Dashboard"
  Delete "$SMPROGRAMS\CIADI Dashboard\CIADI - ADM.lnk"
  Delete "$SMPROGRAMS\CIADI Dashboard\CIADI - Suporte Informático.lnk"
  Delete "$SMPROGRAMS\CIADI Dashboard\CIADI - RH.lnk"
  Delete "$SMPROGRAMS\CIADI Dashboard\CIADI - Receção.lnk"

  ${If} $CIADIProfileChoice == "admin"
    CreateShortCut "$DESKTOP\CIADI - ADM.lnk" "$INSTDIR\CIADI Dashboard.exe"
    CreateShortCut "$SMPROGRAMS\CIADI Dashboard\CIADI - ADM.lnk" "$INSTDIR\CIADI Dashboard.exe"
  ${ElseIf} $CIADIProfileChoice == "suporte_informatica"
    CreateShortCut "$DESKTOP\CIADI - Suporte Informático.lnk" "$INSTDIR\CIADI Dashboard.exe"
    CreateShortCut "$SMPROGRAMS\CIADI Dashboard\CIADI - Suporte Informático.lnk" "$INSTDIR\CIADI Dashboard.exe"
  ${ElseIf} $CIADIProfileChoice == "rh"
    CreateShortCut "$DESKTOP\CIADI - RH.lnk" "$INSTDIR\CIADI Dashboard.exe"
    CreateShortCut "$SMPROGRAMS\CIADI Dashboard\CIADI - RH.lnk" "$INSTDIR\CIADI Dashboard.exe"
  ${ElseIf} $CIADIProfileChoice == "rececao"
    CreateShortCut "$DESKTOP\CIADI - Receção.lnk" "$INSTDIR\CIADI Dashboard.exe"
    CreateShortCut "$SMPROGRAMS\CIADI Dashboard\CIADI - Receção.lnk" "$INSTDIR\CIADI Dashboard.exe"
  ${EndIf}
!macroend

!macro customUnInstall
  SetShellVarContext current
  Delete "$DESKTOP\CIADI - ADM.lnk"
  Delete "$DESKTOP\CIADI - Suporte Informático.lnk"
  Delete "$DESKTOP\CIADI - RH.lnk"
  Delete "$DESKTOP\CIADI - Receção.lnk"
  Delete "$SMPROGRAMS\CIADI Dashboard\CIADI - ADM.lnk"
  Delete "$SMPROGRAMS\CIADI Dashboard\CIADI - Suporte Informático.lnk"
  Delete "$SMPROGRAMS\CIADI Dashboard\CIADI - RH.lnk"
  Delete "$SMPROGRAMS\CIADI Dashboard\CIADI - Receção.lnk"
  RMDir "$SMPROGRAMS\CIADI Dashboard"
  DeleteRegValue HKCU "Software\CIADI\Dashboard" "StationProfile"
  DeleteRegValue HKCU "Software\CIADI\Dashboard" "StationProfileLabel"
  DeleteRegKey /ifempty HKCU "Software\CIADI\Dashboard"
!macroend
