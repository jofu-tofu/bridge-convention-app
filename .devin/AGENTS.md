# Devin Notes

On Windows, keep any filesystem paths that appear in `.devin` config text or agent instructions in forward-slash form when they are meant to be read by Devin.

Reason: raw backslash paths like `C:\tmp\foo.txt` are easy for the runtime to preserve but easy for the model-side parser to misread or de-escape. Use `C:/tmp/foo.txt` in human-readable instructions; keep native Windows paths only where a shell or PowerShell command is actually executing them.
