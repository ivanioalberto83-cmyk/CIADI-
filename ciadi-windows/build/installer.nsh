!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!ifndef BUILD_UNINSTALLER
Var CIADIPolo
Var CIADIProfileDialog
Var CIADIPoloDialog
Var CIADIProfileCheckADM
Var CIADIProfileCheckSupport
Var CIADIProfileCheckRH
Var CIADIProfileCheckReception
Var CIADISelectADM
Var CIADISelectSupport
Var CIADISelectRH
Var CIADISelectReception
Var CIADIPoloRadioTalatona
Var CIADIPoloRadioRosas

!macro customWelcomePage
  Page custom CIADIProfilePageCreate CIADIProfilePageLeave
  Page custom CIADIPoloPageCreate CIADIPoloPageLeave
!macroend

Function CIADIProfilePageCreate
  ${If} $CIADISelectADM == ""
    StrCpy $CIADISelectADM "0"
    StrCpy $CIADISelectSupport "0"
    StrCpy $CIADISelectRH "0"
    StrCpy $CIADISelectReception "0"
  ${EndIf}
  nsDialogs::Create 1018
  Pop $CIADIProfileDialog
  ${If} $CIADIProfileDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 18u "Seleccione as estações CIADI que pretende instalar:"
  Pop $0
  ${NSD_CreateLabel} 0 20u 100% 24u "Pode seleccionar uma, várias ou todas. O atalho identifica a estação; não concede permissões."
  Pop $0
  ${NSD_CreateCheckbox} 0 50u 100% 14u "CIADI ADM — Administração"
  Pop $CIADIProfileCheckADM
  ${If} $CIADISelectADM == "1"
    SendMessage $CIADIProfileCheckADM ${BM_SETCHECK} ${BST_CHECKED} 0
  ${EndIf}
  ${NSD_CreateCheckbox} 0 70u 100% 14u "CIADI Suporte Informático"
  Pop $CIADIProfileCheckSupport
  ${If} $CIADISelectSupport == "1"
    SendMessage $CIADIProfileCheckSupport ${BM_SETCHECK} ${BST_CHECKED} 0
  ${EndIf}
  ${NSD_CreateCheckbox} 0 90u 100% 14u "CIADI Recursos Humanos (RH)"
  Pop $CIADIProfileCheckRH
  ${If} $CIADISelectRH == "1"
    SendMessage $CIADIProfileCheckRH ${BM_SETCHECK} ${BST_CHECKED} 0
  ${EndIf}
  ${NSD_CreateCheckbox} 0 110u 100% 14u "CIADI Receção"
  Pop $CIADIProfileCheckReception
  ${If} $CIADISelectReception == "1"
    SendMessage $CIADIProfileCheckReception ${BM_SETCHECK} ${BST_CHECKED} 0
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function CIADIProfilePageLeave
  StrCpy $CIADISelectADM "0"
  StrCpy $CIADISelectSupport "0"
  StrCpy $CIADISelectRH "0"
  StrCpy $CIADISelectReception "0"
  ${NSD_GetState} $CIADIProfileCheckADM $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADISelectADM "1"
  ${EndIf}
  ${NSD_GetState} $CIADIProfileCheckSupport $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADISelectSupport "1"
  ${EndIf}
  ${NSD_GetState} $CIADIProfileCheckRH $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADISelectRH "1"
  ${EndIf}
  ${NSD_GetState} $CIADIProfileCheckReception $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADISelectReception "1"
  ${EndIf}
  ${If} $CIADISelectADM == "0"
  ${AndIf} $CIADISelectSupport == "0"
  ${AndIf} $CIADISelectRH == "0"
  ${AndIf} $CIADISelectReception == "0"
    MessageBox MB_ICONEXCLAMATION|MB_OK "Seleccione pelo menos uma estação CIADI para continuar."
    Abort
  ${EndIf}
FunctionEnd

Function CIADIPoloPageCreate
  ${If} $CIADISelectRH != "1"
  ${AndIf} $CIADISelectReception != "1"
    Abort
  ${EndIf}
  nsDialogs::Create 1018
  Pop $CIADIPoloDialog
  ${If} $CIADIPoloDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 18u "Seleccione o polo para as estações RH e/ou Receção:"
  Pop $0
  ${NSD_CreateLabel} 0 20u 100% 14u "Esta indicação inicial não impede a alteração posterior do contexto operacional autorizado."
  Pop $0
  ${NSD_CreateRadioButton} 0 48u 100% 16u "Talatona — Polo 001"
  Pop $CIADIPoloRadioTalatona
  SendMessage $CIADIPoloRadioTalatona ${BM_SETSTYLE} 0x00020009 1
  ${If} $CIADIPolo == "talatona"
    SendMessage $CIADIPoloRadioTalatona ${BM_SETCHECK} ${BST_CHECKED} 0
  ${EndIf}
  ${NSD_CreateRadioButton} 0 72u 100% 16u "Jardim de Rosas — Polo 002"
  Pop $CIADIPoloRadioRosas
  ${If} $CIADIPolo == "jardim_de_rosas"
    SendMessage $CIADIPoloRadioRosas ${BM_SETCHECK} ${BST_CHECKED} 0
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function CIADIPoloPageLeave
  StrCpy $CIADIPolo ""
  ${NSD_GetState} $CIADIPoloRadioTalatona $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADIPolo "talatona"
  ${EndIf}
  ${NSD_GetState} $CIADIPoloRadioRosas $0
  ${If} $0 == ${BST_CHECKED}
    ${If} $CIADIPolo != ""
      MessageBox MB_ICONEXCLAMATION|MB_OK "Seleccione apenas um polo."
      Abort
    ${EndIf}
    StrCpy $CIADIPolo "jardim_de_rosas"
  ${EndIf}
  ${If} $CIADIPolo == ""
    MessageBox MB_ICONEXCLAMATION|MB_OK "Seleccione o polo para as estações RH/Receção."
    Abort
  ${EndIf}
FunctionEnd
!endif

!macro customInstall
  ${If} $CIADISelectADM != "1"
  ${AndIf} $CIADISelectSupport != "1"
  ${AndIf} $CIADISelectRH != "1"
  ${AndIf} $CIADISelectReception != "1"
    MessageBox MB_ICONSTOP|MB_OK "Não foi seleccionada nenhuma estação CIADI. A instalação será interrompida."
    Abort
  ${EndIf}
  ${If} $CIADISelectRH == "1"
  ${OrIf} $CIADISelectReception == "1"
    ${If} $CIADIPolo == ""
      MessageBox MB_ICONSTOP|MB_OK "Polo CIADI não seleccionado. A instalação será interrompida."
      Abort
    ${EndIf}
  ${Else}
    StrCpy $CIADIPolo ""
  ${EndIf}

  SetShellVarContext current
  Delete "$DESKTOP\CIADI - ADM.lnk"
  Delete "$DESKTOP\CIADI - Suporte Informático.lnk"
  Delete "$DESKTOP\CIADI - Recursos Humanos.lnk"
  Delete "$DESKTOP\CIADI - Receção.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI - ADM.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI - Suporte Informático.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI - Recursos Humanos.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI - Receção.lnk"
  Delete "$INSTDIR\ciadi-install-profile.txt"
  Delete "$INSTDIR\ciadi-install-polo.txt"
  ${If} $CIADIPolo != ""
    FileOpen $0 "$INSTDIR\ciadi-install-polo.txt" w
    FileWrite $0 "$CIADIPolo"
    FileClose $0
  ${EndIf}
  CreateDirectory "$SMPROGRAMS\CIADI"
  ${If} $CIADISelectADM == "1"
    CreateShortCut "$DESKTOP\CIADI - ADM.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=adm" "$INSTDIR\ciadi.ico"
    CreateShortCut "$SMPROGRAMS\CIADI\CIADI - ADM.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=adm" "$INSTDIR\ciadi.ico"
  ${EndIf}
  ${If} $CIADISelectSupport == "1"
    CreateShortCut "$DESKTOP\CIADI - Suporte Informático.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=suporte_informatica" "$INSTDIR\ciadi.ico"
    CreateShortCut "$SMPROGRAMS\CIADI\CIADI - Suporte Informático.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=suporte_informatica" "$INSTDIR\ciadi.ico"
  ${EndIf}
  ${If} $CIADISelectRH == "1"
    CreateShortCut "$DESKTOP\CIADI - Recursos Humanos.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=rh --ciadi-polo=$CIADIPolo" "$INSTDIR\ciadi.ico"
    CreateShortCut "$SMPROGRAMS\CIADI\CIADI - Recursos Humanos.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=rh --ciadi-polo=$CIADIPolo" "$INSTDIR\ciadi.ico"
  ${EndIf}
  ${If} $CIADISelectReception == "1"
    CreateShortCut "$DESKTOP\CIADI - Receção.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=recepcao --ciadi-polo=$CIADIPolo" "$INSTDIR\ciadi.ico"
    CreateShortCut "$SMPROGRAMS\CIADI\CIADI - Receção.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=recepcao --ciadi-polo=$CIADIPolo" "$INSTDIR\ciadi.ico"
  ${EndIf}
!macroend

!macro customUnInstall
  SetShellVarContext current
  Delete "$DESKTOP\CIADI - ADM.lnk"
  Delete "$DESKTOP\CIADI - Suporte Informático.lnk"
  Delete "$DESKTOP\CIADI - Recursos Humanos.lnk"
  Delete "$DESKTOP\CIADI - Receção.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI - ADM.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI - Suporte Informático.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI - Recursos Humanos.lnk"
  Delete "$SMPROGRAMS\CIADI\CIADI - Receção.lnk"
  RMDir "$SMPROGRAMS\CIADI"
!macroend
