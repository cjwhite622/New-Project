!define APP_NAME "The Hub"
!define APP_VERSION "${APP_VERSION}"
!define APP_DIR "${APP_DIR}"
!define OUTPUT_FILE "${OUTPUT_FILE}"
!define ICON_FILE "${ICON_FILE}"
!define UNINSTALL_MANIFEST "${UNINSTALL_MANIFEST}"

Name "${APP_NAME}"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\\Programs\\The Hub"
Icon "${ICON_FILE}"
UninstallIcon "${ICON_FILE}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
XPStyle on

Page directory
Page instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${APP_DIR}\\*"

  CreateDirectory "$SMPROGRAMS\\The Hub"
  CreateShortCut "$SMPROGRAMS\\The Hub\\The Hub.lnk" "$INSTDIR\\The Hub.exe"
  CreateShortCut "$DESKTOP\\The Hub.lnk" "$INSTDIR\\The Hub.exe"

  WriteRegStr HKCU "Software\\The Hub" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\The Hub" "DisplayName" "The Hub"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\The Hub" "UninstallString" "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\The Hub" "DisplayVersion" "${APP_VERSION}"
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\The Hub" "NoModify" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\The Hub" "NoRepair" 1

  WriteUninstaller "$INSTDIR\\Uninstall.exe"
SectionEnd

Section "Uninstall"
  !include "${UNINSTALL_MANIFEST}"
  Delete "$INSTDIR\\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\\The Hub\\The Hub.lnk"
  RMDir "$SMPROGRAMS\\The Hub"
  Delete "$DESKTOP\\The Hub.lnk"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\The Hub"
  DeleteRegKey HKCU "Software\\The Hub"
SectionEnd
