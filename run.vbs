Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' 1. Periksa apakah server sudah aktif di port 3000
isRunning = False
Set exec = WshShell.Exec("cmd /c netstat -aon | findstr "":3000"" | findstr ""LISTENING""")
Do While exec.Status = 0
    WScript.Sleep 100
Loop
If Not exec.StdOut.AtEndOfStream Then
    output = exec.StdOut.ReadAll()
    If InStr(output, "LISTENING") > 0 Then
        isRunning = True
    End If
End If

' 2. Jalankan server di background jika belum berjalan (0 = jendela hidden)
If Not isRunning Then
    WshShell.Run "cmd /c node server.js", 0, False
    WScript.Sleep 1500
End If

' 3. Buka jendela aplikasi (Mode App tanpa address bar)
appUrl = "http://localhost:3000/operator.html"

' Prioritaskan Chrome App Mode, lalu Edge App Mode, lalu default browser
On Error Resume Next
err.Clear
WshShell.Run "cmd /c start chrome --app=" & appUrl, 0, False
If Err.Number <> 0 Then
    Err.Clear
    WshShell.Run "cmd /c start msedge --app=" & appUrl, 0, False
    If Err.Number <> 0 Then
        Err.Clear
        WshShell.Run "cmd /c start " & appUrl, 0, False
    End If
End If
