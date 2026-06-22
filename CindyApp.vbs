Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(Wscript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir
WshShell.Run "cmd /c CindyApp.bat", 0, False
