$ErrorActionPreference = 'Stop'
$projectDir = 'D:\claudecode\agnes-ai-webapp\agnes-web'
$logFile = Join-Path $projectDir 'agnes-start.log'

function Write-Step($message) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
  Write-Host $line
  Add-Content -LiteralPath $logFile -Value $line -Encoding utf8
}

try {
  Set-Location -LiteralPath $projectDir
  Write-Step '启动 Agnes AI Agent Canvas'
  Write-Step "项目目录：$projectDir"
  Write-Step '本地地址：http://localhost:3000/'

  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCommand) {
    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
  }

  if (-not $npmCommand) {
    throw '未检测到 Node.js / npm。请先安装 Node.js LTS：https://nodejs.org/'
  }

  if (-not (Test-Path -LiteralPath (Join-Path $projectDir 'node_modules'))) {
    Write-Step '首次启动，正在安装依赖...'
    & $npmCommand.Source install
    if ($LASTEXITCODE -ne 0) {
      throw "npm install 失败，退出码：$LASTEXITCODE"
    }
  }

  Write-Step '正在打开浏览器...'
  Start-Process 'http://localhost:3000/'

  Write-Step '正在启动服务。这个窗口不要关闭，关闭后网站会停止。'
  & $npmCommand.Source run dev -- --host 0.0.0.0 --port 3000

  Write-Step "服务已退出，退出码：$LASTEXITCODE"
} catch {
  Write-Host ''
  Write-Host '启动失败：' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Add-Content -LiteralPath $logFile -Value "启动失败：$($_.Exception.Message)" -Encoding utf8
} finally {
  Write-Host ''
  Write-Host "日志文件：$logFile"
  Write-Host '按回车关闭窗口...'
  Read-Host
}
