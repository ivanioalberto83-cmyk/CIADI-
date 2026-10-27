!include "nsDialogs.nsh"
!include "WinMessages.nsh"

Var CIADIModuleDialog
Var CIADIModuleADM
Var CIADIModuleSupport
Var CIADIModuleHR
Var CIADIModuleReception

!macro customPageAfterChangeDir
  Page custom CIADIModulePageCreate CIADIModulePageLeave
!macroend

Function CIADIModulePageCreate
  nsDialogs::Create 1018
  Pop $CIADIModuleDialog
  ${If} $CIADIModuleDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "Selecione os módulos CIADI que serão instalados neste computador. Cada módulo selecionado terá atalhos próprios no Ambiente de Trabalho e no menu Iniciar."
  Pop $0

  ${NSD_CreateCheckbox} 0 34u 100% 14u "CIADI ADM — Administração"
  Pop $CIADIModuleADM
  ${NSD_CreateCheckbox} 0 56u 100% 14u "Suporte Informático"
  Pop $CIADIModuleSupport
  ${NSD_CreateCheckbox} 0 78u 100% 14u "Recursos Humanos"
  Pop $CIADIModuleHR
  ${NSD_CreateCheckbox} 0 100u 100% 14u "Receção"
  Pop $CIADIModuleReception

  ReadRegStr $0 HKCU "Software\CIADI\ModuleSelection" "initialized"
  ${If} $0 == "1"
    ReadRegDWORD $1 HKCU "Software\CIADI\ModuleSelection" "adm"
    ReadRegDWORD $2 HKCU "Software\CIADI\ModuleSelection" "suporte"
    ReadRegDWORD $3 HKCU "Software\CIADI\ModuleSelection" "rh"
    ReadRegDWORD $4 HKCU "Software\CIADI\ModuleSelection" "recepcao"
    ${NSD_SetState} $CIADIModuleADM $1
    ${NSD_SetState} $CIADIModuleSupport $2
    ${NSD_SetState} $CIADIModuleHR $3
    ${NSD_SetState} $CIADIModuleReception $4
  ${Else}
    ${NSD_SetState} $CIADIModuleADM ${BST_CHECKED}
    ${NSD_SetState} $CIADIModuleSupport ${BST_CHECKED}
    ${NSD_SetState} $CIADIModuleHR ${BST_CHECKED}
    ${NSD_SetState} $CIADIModuleReception ${BST_CHECKED}
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function CIADIModulePageLeave
  ${NSD_GetState} $CIADIModuleADM $0
  ${NSD_GetState} $CIADIModuleSupport $1
  ${NSD_GetState} $CIADIModuleHR $2
  ${NSD_GetState} $CIADIModuleReception $3
  IntOp $4 $0 + $1
  IntOp $4 $4 + $2
  IntOp $4 $4 + $3
  ${If} $4 == 0
    MessageBox MB_ICONEXCLAMATION|MB_OK "Selecione pelo menos um módulo CIADI para continuar."
    Abort
  ${EndIf}
FunctionEnd

!macro customInstall
  ; Limpar atalhos anteriores, incluindo o atalho genérico de versões antigas.
  Delete "$DESKTOP\CIADI Dashboard.lnk"
  Delete "$SMPROGRAMS\CIADI Dashboard.lnk"
  Delete "$DESKTOP\CIADI ADM.lnk"
  Delete "$DESKTOP\CIADI Suporte Informático.lnk"
  Delete "$DESKTOP\CIADI Recursos Humanos.lnk"
  Delete "$DESKTOP\CIADI Receção.lnk"
  CreateDirectory "$SMPROGRAMS\CIADI"
  Delete "$SMPROGRAMS\CIADI\CIADI ADM.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI Suporte Informático.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI Recursos Humanos.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI Receção.lnk"

  ${NSD_GetState} $CIADIModuleADM $0
  ${NSD_GetState} $CIADIModuleSupport $1
  ${NSD_GetState} $CIADIModuleHR $2
  ${NSD_GetState} $CIADIModuleReception $3

  WriteRegStr HKCU "Software\CIADI\ModuleSelection" "initialized" "1"
  WriteRegDWORD HKCU "Software\CIADI\ModuleSelection" "adm" $0
  WriteRegDWORD HKCU "Software\CIADI\ModuleSelection" "suporte" $1
  WriteRegDWORD HKCU "Software\CIADI\ModuleSelection" "rh" $2
  WriteRegDWORD HKCU "Software\CIADI\ModuleSelection" "recepcao" $3

  ${If} $0 == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\CIADI ADM.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--ciadi-module=adm"
    CreateShortCut "$SMPROGRAMS\CIADI\CIADI ADM.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--ciadi-module=adm"
  ${EndIf}
  ${If} $1 == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\CIADI Suporte Informático.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--ciadi-module=suporte"
    CreateShortCut "$SMPROGRAMS\CIADI\CIADI Suporte Informático.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--ciadi-module=suporte"
  ${EndIf}
  ${If} $2 == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\CIADI Recursos Humanos.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--ciadi-module=rh"
    CreateShortCut "$SMPROGRAMS\CIADI\CIADI Recursos Humanos.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--ciadi-module=rh"
  ${EndIf}
  ${If} $3 == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\CIADI Receção.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--ciadi-module=recepcao"
    CreateShortCut "$SMPROGRAMS\CIADI\CIADI Receção.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "--ciadi-module=recepcao"
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$DESKTOP\CIADI ADM.lnk"
  Delete "$DESKTOP\CIADI Suporte Informático.lnk"
  Delete "$DESKTOP\CIADI Recursos Humanos.lnk"
  Delete "$DESKTOP\CIADI Receção.lnk"
  Delete "$DESKTOP\CIADI Dashboard.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI ADM.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI Suporte Informático.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI Recursos Humanos.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI Receção.lnk"
  RMDir "$SMPROGRAMS\CIADI"
  DeleteRegKey HKCU "Software\CIADI\ModuleSelection"
!macroend
