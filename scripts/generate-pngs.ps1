Add-Type -AssemblyName System.Drawing

function Create-ServusIcon {
    param (
        [int]$Size,
        [string]$OutPath
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $radius = [float]($Size * 0.22)
    $rect = New-Object System.Drawing.RectangleF(0, 0, $Size, $Size)

    # Criar path do squircle arredondado
    $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $bgPath.AddArc(0, 0, $diameter, $diameter, 180, 90)
    $bgPath.AddArc($Size - $diameter, 0, $diameter, $diameter, 270, 90)
    $bgPath.AddArc($Size - $diameter, $Size - $diameter, $diameter, $diameter, 0, 90)
    $bgPath.AddArc(0, $Size - $diameter, $diameter, $diameter, 90, 90)
    $bgPath.CloseFigure()

    # Preencher gradiente do fundo (roxo vibrante SERVUS)
    $cTop = [System.Drawing.Color]::FromArgb(255, 157, 141, 248)    # #9d8df8
    $cBottom = [System.Drawing.Color]::FromArgb(255, 77, 62, 194)   # #4d3ec2
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBottom, 45.0)
    $g.FillPath($gradBrush, $bgPath)

    # Brilho superior suave
    $cShineTop = [System.Drawing.Color]::FromArgb(75, 255, 255, 255)
    $cShineBottom = [System.Drawing.Color]::FromArgb(0, 255, 255, 255)
    $shineBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cShineTop, $cShineBottom, 90.0)
    $g.FillPath($shineBrush, $bgPath)

    # Borda sutil de 1px
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45, 255, 255, 255), [Math]::Max(1.0, [float]($Size * 0.005)))
    $g.DrawPath($borderPen, $bgPath)

    # Desenhar o 'S' do SERVUS com Bezier
    $scale = [float]($Size / 24.0)
    $strokeW = [float]($scale * 2.2)

    # Sombra do símbolo
    $shadowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 30, 20, 90), [float]($strokeW + $scale * 0.3))
    $shadowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $shadowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $shadowPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $symPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $symPath.StartFigure()

    # Curvas correspondentes ao SVG
    $p0 = New-Object System.Drawing.PointF([float](7.0 * $scale), [float](7.2 * $scale))
    $c1 = New-Object System.Drawing.PointF([float](8.2 * $scale), [float](6.1 * $scale))
    $c2 = New-Object System.Drawing.PointF([float](9.8 * $scale), [float](5.5 * $scale))
    $p1 = New-Object System.Drawing.PointF([float](11.8 * $scale), [float](5.5 * $scale))
    $symPath.AddBezier($p0, $c1, $c2, $p1)

    $c3 = New-Object System.Drawing.PointF([float](14.6 * $scale), [float](5.5 * $scale))
    $c4 = New-Object System.Drawing.PointF([float](16.5 * $scale), [float](6.7 * $scale))
    $p2 = New-Object System.Drawing.PointF([float](16.5 * $scale), [float](8.7 * $scale))
    $symPath.AddBezier($p1, $c3, $c4, $p2)

    $c5 = New-Object System.Drawing.PointF([float](16.5 * $scale), [float](13.2 * $scale))
    $c6 = New-Object System.Drawing.PointF([float](7.6 * $scale), [float](10.8 * $scale))
    $p3 = New-Object System.Drawing.PointF([float](7.6 * $scale), [float](15.2 * $scale))
    $symPath.AddBezier($p2, $c5, $c6, $p3)

    $c7 = New-Object System.Drawing.PointF([float](7.6 * $scale), [float](17.2 * $scale))
    $c8 = New-Object System.Drawing.PointF([float](9.5 * $scale), [float](18.5 * $scale))
    $p4 = New-Object System.Drawing.PointF([float](12.4 * $scale), [float](18.5 * $scale))
    $symPath.AddBezier($p3, $c7, $c8, $p4)

    $c9 = New-Object System.Drawing.PointF([float](14.4 * $scale), [float](18.5 * $scale))
    $c10 = New-Object System.Drawing.PointF([float](16.1 * $scale), [float](17.9 * $scale))
    $p5 = New-Object System.Drawing.PointF([float](17.3 * $scale), [float](16.7 * $scale))
    $symPath.AddBezier($p4, $c9, $c10, $p5)

    # Desenhar sombra deslocada para baixo
    $g.TranslateTransform(0, [float]($scale * 0.4))
    $g.DrawPath($shadowPen, $symPath)
    $g.ResetTransform()

    # Desenhar traço branco principal
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $strokeW)
    $whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($whitePen, $symPath)

    # Salvar PNG
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $whitePen.Dispose()
    $shadowPen.Dispose()
    $symPath.Dispose()
    $borderPen.Dispose()
    $shineBrush.Dispose()
    $gradBrush.Dispose()
    $bgPath.Dispose()
    $g.Dispose()
    $bmp.Dispose()

    Write-Output "PNG gerado: $OutPath"
}

$dir = "c:\Leonardo\Meus Projetos\Sites\Servus\public"
Create-ServusIcon -Size 512 -OutPath "$dir\icon-512.png"
Create-ServusIcon -Size 192 -OutPath "$dir\icon-192.png"
Create-ServusIcon -Size 180 -OutPath "$dir\apple-touch-icon.png"
Create-ServusIcon -Size 32 -OutPath "$dir\favicon.png"

