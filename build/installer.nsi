Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
Name "The Hub"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\The Hub"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show
Icon "${ICON_FILE}"
UninstallIcon "${ICON_FILE}"
VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey "ProductName" "The Hub"
VIAddVersionKey "FileDescription" "The Hub local-first desktop workspace"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" "The Hub"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Your business, working together."
!define MUI_WELCOMEPAGE_TEXT "The Hub brings your AI team, decisions and finances into a local workspace.$\r$\n$\r$\nClose The Hub before installing. Your existing owner profile and business records are preserved.$\r$\n$\r$\nThis release includes the foundation and money tracking. Live business integrations are later milestones."
!define MUI_FINISHPAGE_RUN "$INSTDIR\The Hub.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Open The Hub"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK "The Hub requires a 64-bit edition of Windows 10 or newer."
    Abort
  ${EndIf}
FunctionEnd
Section "The Hub" SEC_MAIN
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  SetOverwrite on
  File /r "${APP_DIR}/*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\The Hub"
  CreateShortcut "$SMPROGRAMS\The Hub\The Hub.lnk" "$INSTDIR\The Hub.exe"
  CreateShortcut "$SMPROGRAMS\The Hub\Uninstall The Hub.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheHub" "DisplayName" "The Hub"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheHub" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheHub" "Publisher" "The Hub"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheHub" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheHub" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheHub" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheHub" "DisplayIcon" "$INSTDIR\The Hub.exe"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheHub" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheHub" "NoRepair" 1
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  !include "${UNINSTALL_MANIFEST}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\The Hub\The Hub.lnk"
  Delete "$SMPROGRAMS\The Hub\Uninstall The Hub.lnk"
  RMDir "$SMPROGRAMS\The Hub"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheHub"
  ; Owner data in AppData\Roaming\The Hub is intentionally preserved.
SectionEnd
