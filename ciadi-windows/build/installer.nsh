!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

!ifndef BUILD_UNINSTALLER
Var CIADIProfile
Var CIADIPolo
Var CIADIProfileDialog
Var CIADIProfileRadioADM
Var CIADIProfileRadioSupport
Var CIADIProfileRadioRH
Var CIADIProfileRadioReception
Var CIADIPoloRadioTalatona
Var CIADIPoloRadioRosas

!macro customWelcomePage
  Page custom CIADIProfilePageCreate CIADIProfilePageLeave
!macroend

Function CIADIProfilePageCreate
  StrCpy $CIADIProfile ""
  StrCpy $CIADIPolo ""
  nsDialogs::Create 1018
  Pop $CIADIProfileDialog
  ${If} $CIADIProfileDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 20u "Selecione o perfil desta estação CIADI:"
  Pop $0
  ${NSD_CreateLabel} 0 16u 100% 22u "Escolha um perfil e um polo. A selecção não concede permissões nem substitui o login CIADI."
  Pop $0

  ${NSD_CreateRadioButton} 0 40u 100% 16u "ADM — Administração"
  Pop $CIADIProfileRadioADM
  SendMessage $CIADIProfileRadioADM ${BM_SETSTYLE} 0x00020009 1
  ${NSD_CreateRadioButton} 0 58u 100% 16u "Suporte Informático"
  Pop $CIADIProfileRadioSupport
  ${NSD_CreateRadioButton} 0 76u 100% 16u "Recursos Humanos (RH)"
  Pop $CIADIProfileRadioRH
  ${NSD_CreateRadioButton} 0 94u 100% 16u "Receção"
  Pop $CIADIProfileRadioReception

  ${NSD_CreateLabel} 0 116u 100% 18u "Selecione o polo desta instalação:"
  Pop $0
  ${NSD_CreateRadioButton} 0 138u 100% 16u "Talatona — Polo 001"
  Pop $CIADIPoloRadioTalatona
  SendMessage $CIADIPoloRadioTalatona ${BM_SETSTYLE} 0x00020009 1
  ${NSD_CreateRadioButton} 0 156u 100% 16u "Jardim de Rosas — Polo 002"
  Pop $CIADIPoloRadioRosas

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
  ${If} $CIADIPolo == ""
    MessageBox MB_ICONSTOP|MB_OK "Polo CIADI não seleccionado. A instalação será interrompida."
    Abort
  ${EndIf}

  FileOpen $0 "$INSTDIR\ciadi-install-profile.txt" w
  FileWrite $0 "$CIADIProfile"
  FileClose $0
  FileOpen $0 "$INSTDIR\ciadi-install-polo.txt" w
  FileWrite $0 "$CIADIPolo"
  FileClose $0

  SetShellVarContext current
  CreateDirectory "$SMPROGRAMS\CIADI"
  ${If} $CIADIProfile == "adm"
    CreateShortCut "$DESKTOP\CIADI - ADM.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=adm --ciadi-polo=$CIADIPolo" "$INSTDIR\ciadi.ico"
    CreateShortCut "$SMPROGRAMS\CIADI\CIADI - ADM.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=adm --ciadi-polo=$CIADIPolo" "$INSTDIR\ciadi.ico"
  ${ElseIf} $CIADIProfile == "suporte_informatica"
    CreateShortCut "$DESKTOP\CIADI - Suporte Informático.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=suporte_informatica --ciadi-polo=$CIADIPolo" "$INSTDIR\ciadi.ico"
    CreateShortCut "$SMPROGRAMS\CIADI\CIADI - Suporte Informático.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=suporte_informatica --ciadi-polo=$CIADIPolo" "$INSTDIR\ciadi.ico"
  ${ElseIf} $CIADIProfile == "rh"
    CreateShortCut "$DESKTOP\CIADI - Recursos Humanos.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=rh --ciadi-polo=$CIADIPolo" "$INSTDIR\ciadi.ico"
    CreateShortCut "$SMPROGRAMS\CIADI\CIADI - Recursos Humanos.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=rh --ciadi-polo=$CIADIPolo" "$INSTDIR\ciadi.ico"
  ${ElseIf} $CIADIProfile == "recepcao"
    CreateShortCut "$DESKTOP\CIADI - Receção.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=recepcao --ciadi-polo=$CIADIPolo" "$INSTDIR\ciadi.ico"
    CreateShortCut "$SMPROGRAMS\CIADI\CIADI - Receção.lnk" "$INSTDIR\CIADI Dashboard.exe" "--ciadi-profile=recepcao --ciadi-polo=$CIADIPolo" "$INSTDIR\ciadi.ico"
  ${Else}
    MessageBox MB_ICONSTOP|MB_OK "Perfil CIADI inválido. A instalação será interrompida."
    Abort
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
