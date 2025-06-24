stack(
  // Kick drum
  sound("bd").struct("x").gain(0.9),
  
  // Hi-hat pattern
  sound("hh").struct("~ x ~ x ~ x ~ x").gain(0.5).pan(0.2),
  
  // Snare
  sound("sd").struct("~ ~ ~ ~ x ~ ~ ~").gain(0.7),
  
  // Bass line
  note("<e2 e2 e2 e2 g2 g2 a2 a2>")
    .sound("sawtooth")
    .cutoff(400)
    .resonance(0.3)
    .gain(0.6)
    .struct("x ~ x ~"),
  
  // Main synth melody
  note("<e4 [e4 d4] c4 [c4 b3] a3 [a3 g3] e3 [e3 d3]>")
    .sound("square")
    .cutoff(sine.range(800, 2000).slow(4))
    .resonance(0.2)
    .gain(0.4)
    .delay(0.3)
    .delayfeedback(0.4)
    .delaytime(0.125)
    .struct("x ~ ~ ~"),
  
  // Chord stabs
  note("<[e4,g4,b4] [d4,g4,b4] [c4,e4,a4] [a3,c4,e4]>")
    .sound("sawtooth")
    .cutoff(1500)
    .gain(0.3)
    .struct("~ ~ x ~")
    .pan(-0.3),
  
  // Additional percussion
  sound("cp").struct("~ ~ ~ x ~ ~ ~ ~").gain(0.4).pan(0.5)
)
.cpm(62)