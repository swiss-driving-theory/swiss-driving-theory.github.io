$possiblePaths = @(
    "C:\Program Files\Inkscape\bin\inkscape.exe",
    "C:\Program Files (x86)\Inkscape\bin\inkscape.exe"
)

$inkscapePath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $inkscapePath = $path
        break
    }
}

if (-not $inkscapePath) {
    $resolvedPath = Get-Command inkscape -ErrorAction SilentlyContinue
    if ($resolvedPath) {
        $inkscapePath = "inkscape"
    }
}

if (-not $inkscapePath) {
    Write-Host "Error: Inkscape could not be found. Please ensure it is installed." -ForegroundColor Red
    exit
}

Write-Host "Using Inkscape at: $inkscapePath" -ForegroundColor Cyan

# Added -Recurse to find files in all subdirectories
$wmfFiles = Get-ChildItem -Filter *.wmf -Recurse

if ($wmfFiles.Count -eq 0) {
    Write-Host "No WMF files found in the current folder or its subfolders." -ForegroundColor Yellow
} else {
    foreach ($file in $wmfFiles) {
        $svgName = [System.IO.Path]::ChangeExtension($file.FullName, ".svg")
        Write-Host "Converting $($file.FullName)..."
        & $inkscapePath --export-filename="$svgName" $file.FullName
    }
    Write-Host "All conversions complete!" -ForegroundColor Green
}