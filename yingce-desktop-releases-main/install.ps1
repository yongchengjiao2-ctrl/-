param([string]$FeedRoot=$PSScriptRoot,[string]$InstallRoot=(Join-Path $env:LOCALAPPDATA 'YingceCanvas'),[switch]$NoShortcut,[switch]$NoLaunch)
$ErrorActionPreference='Stop'
$online=$FeedRoot -match '^https://'
if($FeedRoot -match '^https?://' -and !$online){throw 'Online updates require HTTPS'}
function Receive-ReleaseFile([string]$Name,[string]$Destination){
    if($online){
        $url=$FeedRoot.TrimEnd('/')+'/'+[Uri]::EscapeDataString($Name)
        [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $url -OutFile $Destination -UseBasicParsing
    }else{Copy-Item -LiteralPath (Join-Path $FeedRoot $Name) -Destination $Destination -Force}
}
function Get-ReleaseFileHash([string]$LiteralPath){
    $stream=[IO.File]::OpenRead($LiteralPath)
    $sha=[Security.Cryptography.SHA256]::Create()
    try{return @{Hash=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','')}}
    finally{$sha.Dispose();$stream.Dispose()}
}
Write-Host 'Reading release information. First installation may take several minutes...'
if($online){
    $manifestTemp=[IO.Path]::GetTempFileName()
    try{Receive-ReleaseFile 'latest.json' $manifestTemp;$releaseInfo=Get-Content -LiteralPath $manifestTemp -Raw -Encoding UTF8 | ConvertFrom-Json}
    finally{Remove-Item -LiteralPath $manifestTemp -Force}
}else{$releaseInfo=Get-Content -LiteralPath (Join-Path $FeedRoot 'latest.json') -Raw -Encoding UTF8 | ConvertFrom-Json}
if ($releaseInfo.version -notmatch '^\d+\.\d+\.\d+$') {throw 'Invalid release version'}
if(!$releaseInfo.files -or $releaseInfo.files.Count -eq 0){throw 'Empty release manifest'}
if($online -and !$releaseInfo.archive){throw 'Online release must contain an archive'}
if($online){$sourceRoot=''}else{$sourceRoot=[IO.Path]::GetFullPath((Join-Path $FeedRoot ('releases\'+$releaseInfo.version)))}
if(!$online -and (Test-Path -LiteralPath (Join-Path $FeedRoot 'release.json')) -and !$releaseInfo.archive){
    $localRelease=Get-Content -LiteralPath (Join-Path $FeedRoot 'release.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if($localRelease.version -ne $releaseInfo.version){throw 'Local release version mismatch'}
    $sourceRoot=[IO.Path]::GetFullPath($FeedRoot)
}
if($releaseInfo.archive){
    if($releaseInfo.archive -ne ('Yingce-'+$releaseInfo.version+'-win-x64.zip')){throw 'Invalid archive name'}
    if($releaseInfo.archiveSha256 -notmatch '^[A-Fa-f0-9]{64}$'){throw 'Invalid archive checksum'}
    $cache=Join-Path $InstallRoot ('cache\'+$releaseInfo.version)
    New-Item -ItemType Directory -Force -Path $cache | Out-Null
    $archivePath=Join-Path $cache $releaseInfo.archive
    if(!(Test-Path -LiteralPath $archivePath) -or (Get-ReleaseFileHash -LiteralPath $archivePath).Hash -ne $releaseInfo.archiveSha256){
        Write-Host 'Downloading the release archive...'
        Receive-ReleaseFile $releaseInfo.archive ($archivePath+'.partial')
        if((Get-ReleaseFileHash -LiteralPath ($archivePath+'.partial')).Hash -ne $releaseInfo.archiveSha256){throw 'Archive checksum mismatch. Previous installation was preserved.'}
        Move-Item -LiteralPath ($archivePath+'.partial') -Destination $archivePath -Force
    }
    Write-Host 'Extracting and verifying the release locally...'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $sourceRoot=Join-Path $cache ('unpack-'+[guid]::NewGuid().ToString('N'))
    $zip=[IO.Compression.ZipFile]::OpenRead($archivePath)
    try{
        foreach($entry in $zip.Entries){
            $entryPath=[IO.Path]::GetFullPath((Join-Path $sourceRoot $entry.FullName))
            if(!$entryPath.StartsWith($sourceRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid archive entry'}
        }
    }finally{$zip.Dispose()}
    [IO.Compression.ZipFile]::ExtractToDirectory($archivePath,$sourceRoot)
}
$versionRoot=[IO.Path]::GetFullPath((Join-Path $InstallRoot ('versions\'+$releaseInfo.version)))
New-Item -ItemType Directory -Force -Path $versionRoot | Out-Null
$validated=0
foreach($item in $releaseInfo.files){
    if($item.path -notmatch '^(app|runtime|web|backend|plugin-packages)[\\/]' -and $item.path -notin @('release.json','install.ps1','安装或更新.cmd','使用说明.md','update.cmd')){throw 'Release contains a disallowed path'}
    $source=[IO.Path]::GetFullPath((Join-Path $sourceRoot $item.path))
    $target=[IO.Path]::GetFullPath((Join-Path $versionRoot $item.path))
    if(!$source.StartsWith($sourceRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or !$target.StartsWith($versionRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid release path'}
    if((Get-ReleaseFileHash -LiteralPath $source).Hash -ne $item.sha256){throw ('Release file checksum mismatch: '+$item.path)}
    $validated++
    if($validated % 100 -eq 0){Write-Progress -Activity 'Verifying release files' -Status "$validated / $($releaseInfo.files.Count)" -PercentComplete ($validated*100/$releaseInfo.files.Count)}
}
Write-Progress -Activity 'Verifying release files' -Completed
# Close only this per-user installed application. Existing project deployments
# outside this installation are never selected, and an unclosed window aborts.
$running=@(Get-Process Yingce -ErrorAction SilentlyContinue | Where-Object {$_.Path -and $_.Path.StartsWith((Join-Path $InstallRoot 'versions')+'\',[StringComparison]::OrdinalIgnoreCase) -and $_.MainWindowHandle -ne 0})
foreach($process in $running){$null=$process.CloseMainWindow();if(!$process.WaitForExit(15000)){throw 'Please save your work and close Yingce before updating.'}}
$copied=0
foreach($item in $releaseInfo.files){
    $copied++
    if($copied % 100 -eq 0){Write-Progress -Activity 'Installing release files' -Status "$copied / $($releaseInfo.files.Count)" -PercentComplete ($copied*100/$releaseInfo.files.Count)}
    $source=Join-Path $sourceRoot $item.path;$target=Join-Path $versionRoot $item.path
    if((Test-Path -LiteralPath $target) -and (Get-ReleaseFileHash -LiteralPath $target).Hash -eq $item.sha256){continue}
    New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
    if((Get-ReleaseFileHash -LiteralPath $target).Hash -ne $item.sha256){throw 'Installed file checksum mismatch'}
}
Write-Progress -Activity 'Installing release files' -Completed
# Keep a local copy of the trusted installer; updates never execute a downloaded script.
$installerPath=Join-Path $InstallRoot 'install.ps1'
if([IO.Path]::GetFullPath($PSCommandPath) -ne [IO.Path]::GetFullPath($installerPath)){Copy-Item -LiteralPath $PSCommandPath -Destination $installerPath -Force}
$FeedRoot | Set-Content -LiteralPath (Join-Path $InstallRoot 'update-source.txt') -Encoding UTF8
$updater=@'
$ErrorActionPreference='Stop'
$feed=(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'update-source.txt') -Raw -Encoding UTF8).Trim()
& (Join-Path $PSScriptRoot 'install.ps1') -FeedRoot $feed -InstallRoot $PSScriptRoot
'@
$updater | Set-Content -LiteralPath (Join-Path $InstallRoot 'update.ps1') -Encoding UTF8
$updateCommand="@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"%~dp0update.ps1`"`r`nif errorlevel 1 pause`r`n"
[IO.File]::WriteAllText((Join-Path $InstallRoot 'update.cmd'),$updateCommand,[Text.UTF8Encoding]::new($false))
$releaseInfo.version | Set-Content -LiteralPath (Join-Path $InstallRoot 'current.txt') -Encoding ASCII
$launch=@'
$ErrorActionPreference='Stop'
$version=(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'current.txt') -Raw).Trim()
if($version -notmatch '^\d+\.\d+\.\d+$'){throw 'Invalid installed version'}
$env:YINGCE_DESKTOP_DATA_DIR=$PSScriptRoot
Start-Process -FilePath (Join-Path $PSScriptRoot "versions\$version\app\Yingce.exe") -WorkingDirectory (Join-Path $PSScriptRoot "versions\$version") -WindowStyle Normal
'@
$launch | Set-Content -LiteralPath (Join-Path $InstallRoot 'launch.ps1') -Encoding UTF8
if(!$NoShortcut){
    $shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) '影策个人版.lnk'))
    $shortcut.TargetPath=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $shortcut.Arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $InstallRoot 'launch.ps1')+'"'
    $shortcut.WorkingDirectory=$InstallRoot
    $shortcut.IconLocation=Join-Path $versionRoot 'app\Yingce.exe'
    $shortcut.Save()
}
Write-Host ('Installed Yingce '+$releaseInfo.version+'. Personal data and API keys were preserved.')
if(!$NoLaunch){& (Join-Path $InstallRoot 'launch.ps1')}
