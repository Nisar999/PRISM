@echo off
cd /d d:\Code_yees\PRISM
git add -A
git commit -F _commitmsg.txt
echo === LOG BEFORE REBASE ===
git log --oneline -5
echo === REBASE ===
git rebase origin/main
echo === LOG AFTER REBASE ===
git log --oneline -5
echo === STATUS ===
git status --porcelain
echo DONE_BATCH
