THE HUB - WINDOWS PORTABLE EDITION

For 64-bit Windows 10 or 11.

1. Right-click the downloaded ZIP and choose Extract All.
2. Open the extracted "The Hub" folder.
3. Double-click "The Hub.exe". No installer or administrator account is needed.

Keep the whole extracted folder together. The application needs the DLL files,
resources folder and other files beside The Hub.exe. Do not run the executable
from inside the ZIP preview.

IF NOTHING OPENS

Double-click "Start The Hub.cmd" in the extracted folder. This launcher records
the Windows version, processor architecture, application exit code and startup
stages. After the application exits, the launcher always keeps its window open
and opens the report in Notepad, even if the application returned exit code 0.
The report contains no API keys, business records or personal journal entries.

The report is saved in:
  %TEMP%\The Hub\diagnostics\windows-launch.txt

If the launcher is still waiting with no app window, open this startup log:
  %APPDATA%\The Hub\diagnostics\desktop-startup.log

If the normal diagnostics folder is unavailable, the app tries:
  %TEMP%\The Hub\diagnostics\desktop-startup.log

Startup reports include app/runtime versions, stages and error codes. They do
not contain error messages, paths to owner files, credentials or record contents.

If Windows displays a security message, record its exact text. This release is
unsigned. Do not disable Windows security settings to troubleshoot it.

YOUR DATA

The application keeps its existing owner data in:
  %APPDATA%\The Hub\workspace

Using this portable folder does not erase or replace an existing workspace.
You can delete the extracted application folder without deleting owner data.
