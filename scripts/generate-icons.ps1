Add-Type -AssemblyName System.Drawing
$destination = Join-Path $PSScriptRoot '../public'
foreach ($item in @(@('pwa-192.png', 192), @('pwa-512.png', 512), @('pwa-maskable-512.png', 512), @('apple-touch-icon.png', 180))) {
  $size = [int]$item[1]
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#26494a'))
  $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#b9e6d0'), $size * 0.039)
  foreach ($fraction in @(0.4375, 0.2625, 0.0875)) {
    $diameter = $size * $fraction
    $offset = ($size - $diameter) / 2
    $graphics.DrawEllipse($pen, [single]$offset, [single]$offset, [single]$diameter, [single]$diameter)
  }
  $bitmap.Save((Join-Path $destination $item[0]), [System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
