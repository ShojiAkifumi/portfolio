# 実績用キャプチャ画像を作るアプリ（Windows）
# portfolio フォルダの「実績キャプチャ.bat」をダブルクリックすると起動します。
# URL を入れて「撮影する」を押すと、tools/capture.mjs で撮影し、
# ダウンロードフォルダに <名前>_mockup.webp / <名前>_pc.webp / <名前>_sp.(webp|jpg) を保存します。
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $env:USERPROFILE 'Downloads'
$font = New-Object System.Drawing.Font('Yu Gothic UI', 10)

$form = New-Object System.Windows.Forms.Form
$form.Text = '実績キャプチャ'
$form.ClientSize = New-Object System.Drawing.Size(560, 330)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.Font = $font

$lblUrl = New-Object System.Windows.Forms.Label
$lblUrl.Text = '撮影するページのURL'
$lblUrl.Location = New-Object System.Drawing.Point(16, 16)
$lblUrl.AutoSize = $true
$form.Controls.Add($lblUrl)

$txtUrl = New-Object System.Windows.Forms.TextBox
$txtUrl.Location = New-Object System.Drawing.Point(16, 40)
$txtUrl.Size = New-Object System.Drawing.Size(528, 26)
$form.Controls.Add($txtUrl)

$lblName = New-Object System.Windows.Forms.Label
$lblName.Text = 'ファイル名（空欄ならURLから自動で決めます）'
$lblName.Location = New-Object System.Drawing.Point(16, 76)
$lblName.AutoSize = $true
$form.Controls.Add($lblName)

$txtName = New-Object System.Windows.Forms.TextBox
$txtName.Location = New-Object System.Drawing.Point(16, 100)
$txtName.Size = New-Object System.Drawing.Size(260, 26)
$form.Controls.Add($txtName)

$btn = New-Object System.Windows.Forms.Button
$btn.Text = '撮影する'
$btn.Location = New-Object System.Drawing.Point(424, 96)
$btn.Size = New-Object System.Drawing.Size(120, 34)
$form.Controls.Add($btn)
$form.AcceptButton = $btn

$log = New-Object System.Windows.Forms.TextBox
$log.Multiline = $true
$log.ReadOnly = $true
$log.ScrollBars = 'Vertical'
$log.Location = New-Object System.Drawing.Point(16, 144)
$log.Size = New-Object System.Drawing.Size(528, 132)
$log.Text = "保存先: $outDir"
$form.Controls.Add($log)

$btnOpen = New-Object System.Windows.Forms.Button
$btnOpen.Text = '保存先を開く'
$btnOpen.Location = New-Object System.Drawing.Point(16, 288)
$btnOpen.Size = New-Object System.Drawing.Size(140, 30)
$btnOpen.Add_Click({ Start-Process explorer.exe $outDir })
$form.Controls.Add($btnOpen)

function Write-Log([string]$line) {
  $log.AppendText("`r`n" + $line)
}

# URL からファイル名を決める（例: https://example.github.io/lp-ennote/ → lp-ennote）
function Get-NameFromUrl([Uri]$uri) {
  $seg = $uri.AbsolutePath.Trim('/').Split('/') | Where-Object { $_ -and $_ -notmatch '\.html?$' } | Select-Object -Last 1
  if (-not $seg) { $seg = $uri.Host.Split('.')[0] }
  return ($seg -replace '[\\/:*?"<>|\s]', '-')
}

# 撮影は裏で node を動かし、出力をログファイルに書かせて、タイマーで読み取って表示する
$script:proc = $null
$script:logFile = Join-Path $env:TEMP 'works-capture.log'
$script:logPos = 0
function Read-NewLog {
  if (-not (Test-Path $script:logFile)) { return }
  try {
    $fs = [System.IO.File]::Open($script:logFile, 'Open', 'Read', 'ReadWrite')
    try {
      [void]$fs.Seek($script:logPos, 'Begin')
      $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
      $text = $sr.ReadToEnd()
      $script:logPos = $fs.Position
    } finally { $fs.Close() }
    foreach ($line in ($text -split "`r?`n")) { if ($line.Trim()) { Write-Log $line } }
  } catch { }
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 300
$timer.Add_Tick({
  Read-NewLog
  if ($script:proc -and $script:proc.HasExited) {
    $timer.Stop()
    Read-NewLog
    $code = $script:proc.ExitCode
    $script:proc = $null
    $btn.Enabled = $true
    $btn.Text = '撮影する'
    if ($code -eq 0) {
      Write-Log '完了しました。'
      Start-Process explorer.exe $outDir
    } else {
      Write-Log "うまく撮影できませんでした（終了コード $code）。"
      Write-Log '初めて使う時は、portfolio フォルダで「npm install」と「npx playwright install chromium」を実行してください。'
    }
  }
})

$btn.Add_Click({
  $url = $txtUrl.Text.Trim()
  $uri = $null
  if (-not [Uri]::TryCreate($url, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -notin @('http', 'https')) {
    [System.Windows.Forms.MessageBox]::Show('http:// か https:// で始まるURLを入力してください。', '実績キャプチャ') | Out-Null
    return
  }
  $url = $uri.AbsoluteUri
  $name = $txtName.Text.Trim() -replace '[\\/:*?"<>|\s]', '-'
  if (-not $name) { $name = Get-NameFromUrl $uri; $txtName.Text = $name }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    [System.Windows.Forms.MessageBox]::Show('Node.js が見つかりません。Node.js をインストールしてください。', '実績キャプチャ') | Out-Null
    return
  }

  $btn.Enabled = $false
  $btn.Text = '撮影中…'
  $log.Text = "撮影中: $url（1分ほどかかります）"
  Remove-Item $script:logFile -ErrorAction SilentlyContinue
  $script:logPos = 0

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'cmd.exe'
  $psi.Arguments = "/d /s /c `"node tools/capture.mjs lp `"$url`" `"$name`" --out `"$outDir`" > `"$($script:logFile)`" 2>&1`""
  $psi.WorkingDirectory = $root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $script:proc = [System.Diagnostics.Process]::Start($psi)
  $timer.Start()
})

[void]$form.ShowDialog()
