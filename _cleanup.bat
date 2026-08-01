@echo off
cd /d d:\Code_yees\PRISM
del _commitmsg.txt _gitops.bat 2>nul
git add -A
(echo chore: remove throwaway helper files used during git setup) > "%TEMP%\_cleanupmsg.txt"
git commit -F "%TEMP%\_cleanupmsg.txt"
del "%TEMP%\_cleanupmsg.txt" 2>nul
echo === LOG ===
git log --oneline -5
echo === STATUS ===
git status --porcelain
echo DONE_CLEANUP
