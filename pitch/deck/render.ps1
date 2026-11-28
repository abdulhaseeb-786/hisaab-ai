param([string]$Deck, [string]$Out)
$ppt = New-Object -ComObject PowerPoint.Application
try {
  $p = $ppt.Presentations.Open($Deck, $true, $false, $false)
  $i = 0
  foreach ($s in $p.Slides) {
    $i++
    $s.Export((Join-Path $Out ("slide-{0:D2}.png" -f $i)), "PNG", 1600, 900)
    $effects = $s.TimeLine.MainSequence.Count
    "slide $i : $effects animations, transition " + $s.SlideShowTransition.EntryEffect
  }
  $p.Close()
} finally { $ppt.Quit() }
