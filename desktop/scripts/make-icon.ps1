# Converts a generated logo (JPG/PNG on a white background) into a clean app icon:
# crops to the colored rounded square, makes the outside transparent, outputs a 512x512 PNG.
# Usage: powershell -File scripts/make-icon.ps1 -Source assets/logo_v2.jpg -Out assets/icon.png
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [string]$Out = "assets/icon.png",
  [int]$Size = 512
)
Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Source))
try {
  # 1. Bounding box of strongly colored pixels (the gradient square)
  $minX = $src.Width; $minY = $src.Height; $maxX = 0; $maxY = 0
  for ($y = 0; $y -lt $src.Height; $y += 2) {
    for ($x = 0; $x -lt $src.Width; $x += 2) {
      $c = $src.GetPixel($x, $y)
      $mx = [Math]::Max($c.R, [Math]::Max($c.G, $c.B)); $mn = [Math]::Min($c.R, [Math]::Min($c.G, $c.B))
      if (($mx - $mn) -gt 60) {
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  $side = [Math]::Max($maxX - $minX, $maxY - $minY)
  $cx = ($minX + $maxX) / 2; $cy = ($minY + $maxY) / 2
  $inset = [int]($side * 0.01)   # trim the anti-aliased edge
  $rect = New-Object System.Drawing.Rectangle ([int]($cx - $side / 2 + $inset)), ([int]($cy - $side / 2 + $inset)), ([int]($side - 2 * $inset)), ([int]($side - 2 * $inset))

  # 2. Draw the cropped square through a rounded-rect clip on a transparent canvas
  $dst = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)

  $r = [int]($Size * 0.22); $d = 2 * $r; $s = $Size - 1
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $d, $d, 180, 90); $path.AddArc($s - $d, 0, $d, $d, 270, 90)
  $path.AddArc($s - $d, $s - $d, $d, $d, 0, 90); $path.AddArc(0, $s - $d, $d, $d, 90, 90); $path.CloseFigure()

  $cropped = $src.Clone($rect, $src.PixelFormat)
  $scaled = New-Object System.Drawing.Bitmap $cropped, $Size, $Size
  $brush = New-Object System.Drawing.TextureBrush $scaled
  $g.FillPath($brush, $path)

  $outPath = Join-Path (Get-Location) $Out
  $dst.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output "Icon written: $outPath ($Size x $Size)"
  $brush.Dispose(); $scaled.Dispose(); $cropped.Dispose(); $g.Dispose(); $dst.Dispose()
} finally { $src.Dispose() }
