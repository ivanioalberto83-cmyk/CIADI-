!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!ifndef BUILD_UNINSTALLER
Var CIADIProfile
Var CIADIPolo
Var CIADIProfileDialog
Var CIADIPoloDialog
Var CIADIProfileRadioADM
Var CIADIProfileRadioSupport
Var CIADIProfileRadioRH
Var CIADIProfileRadioReception
Var CIADIPoloRadioTalatona
Var CIADIPoloRadioRosas

!macro customWelcomePage
  Page custom CIADIProfilePageCreate CIADIProfilePageLeave
  Page custom CIADIPoloPageCreate CIADIPoloPageLeave
!macroend

Function CIADIProfilePageCreate
  StrCpy $CIADIProfile ""
  StrCpy $CIADIPolo ""
  nsDialogs::Create 1018
  Pop $CIADIProfileDialog
  ${If} $CIADIProfileDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 16u "Selecione o perfil desta estação CIADI:"
  Pop $0
  ${NSD_CreateLabel} 0 18u 100% 14u "A escolha do perfil identifica o posto de trabalho; não concede permissões."
  Pop $0

  ${NSD_CreateRadioButton} 0 34u 100% 12u "ADM — Administração"
  Pop $CIADIProfileRadioADM
  SendMessage $CIADIProfileRadioADM ${BM_SETSTYLE} 0x00020009 1
  ${NSD_CreateRadioButton} 0 48u 100% 12u "Suporte Informático"
  Pop $CIADIProfileRadioSupport
  ${NSD_CreateRadioButton} 0 62u 100% 12u "Recursos Humanos (RH)"
  Pop $CIADIProfileRadioRH
  ${NSD_CreateRadioButton} 0 76u 100% 12u "Receção"
  Pop $CIADIProfileRadioReception

  nsDialogs::Show
FunctionEnd

Function CIADIProfilePageLeave
  StrCpy $CIADIProfile ""
  ${NSD_GetState} $CIADIProfileRadioADM $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $CIADIProfile "adm"
  ${EndIf}
  ${NSD_GetState} $CIADIProfileRadioSupport $0
  ${If} $0 == ${BST_CHECKED}
    ${If} $CIADIProfile != ""
      MessageBox MB_ICONEXCLAMATION|MB_OK "Selecione apenas um perfil."
      Abort
    ${EndIf}
    StrCpy $CIADIProfile "suporte_informatica"
  ${EndIf}
  ${NSD_GetState} $CIADIProfileRadioRH $0
  ${If} $0 == ${BST_CHECKED}
    ${If} $CIADIProfile != ""
      MessageBox MB_ICONEXCLAMATION|MB_OK "Selecione apenas um perfil."
      Abort
    ${EndIf}
    StrCpy $CIADIProfile "rh"
  ${EndIf}
  ${NSD_GetState} $CIADIProfileRadioReception $0
  ${If} $0 == ${BST_CHECKED}
    ${If} $CIADIProfile != ""
      MessageBox MB_ICONEXCLAMATION|MB_OK "Selecione apenas um perfil."
      Abort
    ${EndIf}
    StrCpy $CIADIProfile "recepcao"
  ${EndIf}
  ${If} $CIADIProfile == ""
    MessageBox MB_ICONEXCLAMATION|MB_OK "Selecione um perfil para continuar."
    Abort
  ${EndIf}
FunctionEnd

Function CIADIPoloPageCreate
  StrCpy $CIADIPolo ""
  ${If} $CIADIProfile == "adm"
    Abort
  ${ElseIf} $CIADIProfile == "suporte_informatica"
    Abort
  ${EndIf}

  nsDialogs::Create 1018
  Pop $CIADIPoloDialog
  ${If} $CIADIPoloDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 18u "Selecione o polo de trabalho desta estação:"
  Pop $0
  ${NSD_CreateLabel} 0 20u 100% 14u "Esta escolha identifica a estação e pode ser alterada no contexto operacional."
  Pop $0

  ${NSD_CreateRadioButton} 0 42u 100% 16u "Talatona — Polo 001"
  Pop $CIADIPoloRadioTalatona
  SendMessage $CIADIPoloRadioTalatona ${BM_SETSTYLE} 0x00020009 1
  ${NSD_CreateRadioButton} 0 64u 100% 16u "Jardim de Rosas — Polo 002"
  Pop $CIADIPoloRadioRosas

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
      MessageBox MB_ICONEXCLAMATION|MB_OK "Selecione apenas um polo."
      Abort
    ${EndIf}
    StrCpy $CIADIPolo "jardim_de_rosas"
  ${EndIf}
  ${If} $CIADIPolo == ""
    MessageBox MB_ICONEXCLAMATION|MB_OK "Selecione o polo para continuar."
    Abort
  ${EndIf}
FunctionEnd
!endif

!macro customInstall
  ${If} $CIADIProfile == ""
    MessageBox MB_ICONSTOP|MB_OK "Perfil CIADI não seleccionado. A instalação será interrompida."
    Abort
  ${EndIf}

  ${If} $CIADIProfile == "rh"
    ${If} $CIADIPolo == ""
      MessageBox MB_ICONSTOP|MB_OK "Polo CIADI não seleccionado. A instalação será interrompida."
      Abort
    ${EndIf}
  ${ElseIf} $CIADIProfile == "recepcao"
    ${If} $CIADIPolo == ""
      MessageBox MB_ICONSTOP|MB_OK "Polo CIADI não seleccionado. A instalação será interrompida."
      Abort
    ${EndIf}
  ${Else}
    StrCpy $CIADIPolo ""
  ${EndIf}

  FileOpen $0 "$INSTDIR\\ciadi-install-profile.txt" w
  FileWrite $0 "$CIADIProfile"
  FileClose $0
  Delete "$INSTDIR\\ciadi-install-polo.txt"
  ${If} $CIADIPolo != ""
    FileOpen $0 "$INSTDIR\\ciadi-install-polo.txt" w
    FileWrite $0 "$CIADIPolo"
    FileClose $0
  ${EndIf}

  SetShellVarContext current
  CreateDirectory "$SMPROGRAMS\\CIADI"
  ${If} $CIADIProfile == "adm"
    CreateShortCut "$DESKTOP\\CIADI - ADM.lnk" "$INSTDIR\\CIADI Dashboard.exe" "--ciadi-profile=adm --ciadi-polo=$CIADIPolo" "$INSTDIR\\ciadi.ico"
    CreateShortCut "$SMPROGRAMS\\CIADI\\CIADI - ADM.lnk" "$INSTDIR\\CIADI Dashboard.exe" "--ciadi-profile=adm --ciadi-polo=$CIADIPolo" "$INSTDIR\\ciadi.ico"
  ${ElseIf} $CIADIProfile == "suporte_informatica"
    CreateShortCut "$DESKTOP\\CIADI - Suporte Informático.lnk" "$INSTDIR\\CIADI Dashboard.exe" "--ciadi-profile=suporte_informatica --ciadi-polo=$CIADIPolo" "$INSTDIR\\ciadi.ico"
    CreateShortCut "$SMPROGRAMS\\CIADI\\CIADI - Suporte Informático.lnk" "$INSTDIR\\CIADI Dashboard.exe" "--ciadi-profile=suporte_informatica --ciadi-polo=$CIADIPolo" "$INSTDIR\\ciadi.ico"
  ${ElseIf} $CIADIProfile == "rh"
    CreateShortCut "$DESKTOP\\CIADI - Recursos Humanos.lnk" "$INSTDIR\\CIADI Dashboard.exe" "--ciadi-profile=rh --ciadi-polo=$CIADIPolo" "$INSTDIR\\ciadi.ico"
    CreateShortCut "$SMPROGRAMS\\CIADI\\CIADI - Recursos Humanos.lnk" "$INSTDIR\\CIADI Dashboard.exe" "--ciadi-profile=rh --ciadi-polo=$CIADIPolo" "$INSTDIR\\ciadi.ico"
  ${ElseIf} $CIADIProfile == "recepcao"
    CreateShortCut "$DESKTOP\\CIADI - Receção.lnk" "$INSTDIR\\CIADI Dashboard.exe" "--ciadi-profile=recepcao --ciadi-polo=$CIADIPolo" "$INSTDIR\\ciadi.ico"
    CreateShortCut "$SMPROGRAMS\\CIADI\\CIADI - Receção.lnk" "$INSTDIR\\CIADI Dashboard.exe" "--ciadi-profile=recepcao --ciadi-polo=$CIADIPolo" "$INSTDIR\\ciadi.ico"
  ${Else}
    MessageBox MB_ICONSTOP|MB_OK "Perfil CIADI inválido. A instalação será interrompida."
    Abort
  ${EndIf}
!macroend

!macro customUnInstall
  SetShellVarContext current
  Delete "$DESKTOP\\CIADI - ADM.lnk"
  Delete "$DESKTOP\\CIADI - Suporte Informático.lnk"
  Delete "$DESKTOP\\CIADI - Recursos Humanos.lnk"
  Delete "$DESKTOP\\CIADI - Receção.lnk"
  Delete "$SMPROGRAMS\\CIADI\\CIADI - ADM.lnk"
  Delete "$SMPROGRAMS\\CIADI\\CIADI - Suporte Informático.lnk"
  Delete "$SMPROGRAMS\\CIADI\\CIADI - Recursos Humanos.lnk"
  Delete "$SMPROGRAMS\\CIADI\\CIADI - Receção.lnk"
  RMDir "$SMPROGRAMS\\CIADI"
!macroend
