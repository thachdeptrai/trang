$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Cai GitHub CLI tu https://cli.github.com va chay gh auth login truoc.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Can cai Git truoc.' }
gh auth status
if ($LASTEXITCODE -ne 0) { throw 'Hay chay gh auth login truoc.' }
$owner = (gh api user --jq .login).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Khong doc duoc tai khoan GitHub.' }
gh repo view "$owner/trang" --json name 2>$null
if ($LASTEXITCODE -eq 0) { throw 'Repository trang da ton tai. Dung lai de tranh ghi de.' }
if (-not (Test-Path '.git')) { git init -b main }
git add index.html style.css app.js assets README.md .nojekyll .gitignore publish.ps1
git commit -m 'Create TRANG Mid-Autumn experience'
if ($LASTEXITCODE -ne 0) { throw 'Khong tao duoc commit. Kiem tra git user.name va user.email.' }
gh repo create trang --public --source . --remote origin --push
if ($LASTEXITCODE -ne 0) { throw 'Khong tao/push duoc repository.' }
'{"source":{"branch":"main","path":"/"}}' | gh api --method POST "repos/$owner/trang/pages" --input -
if ($LASTEXITCODE -ne 0) { throw 'Da push code. Mo Settings > Pages de bat Pages thu cong.' }
$siteUrl = (gh api "repos/$owner/trang/pages" --jq .html_url).Trim()
Write-Host "Website: $siteUrl"
Write-Host 'GitHub Pages co the can vai phut de build lan dau.'
Start-Process $siteUrl
