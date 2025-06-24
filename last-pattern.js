// Genesis-inspired ambient electronic pattern
stack(
  // Ethereal pad progression
  note("<[c2 eb2] [g2 bb2] [f2 ab2] [eb2 g2]>".slow(4))
  .s("sawtooth").lpf(800).gain(0.3).room(0.8).delay(0.5),
  
  // Arpeggiated synth line
  note("<[c4 eb4 g4 bb4]*2 [f4 ab4 c5 eb5]*2>".fast(2))
  .s("triangle").lpf(1200).gain(0.2).pan(sine.range(-0.5,0.5).slow(4)),
  
  // Bass foundation
  note("<c1 c1 f1 eb1>".slow(2))
  .s("sine").shape(0.4).gain(0.5),
  
  // Ethereal vocal-like lead
  note("<[g4 bb4] [c5 eb5] [f4 ab4] [g4 bb4]>".slow(2))
  .s("sawtooth").vowel("<a e i o>").lpf(2000).gain(0.15)
  .room(0.9).delay(0.75).delaytime(0.125).delayfeedback(0.6),
  
  // Rhythmic elements
  stack(
    s("bd").gain(0.7).shape(0.3).n("<0 0 0 0>"),
    s("hh").gain(0.3).pan(0.2).n("<0 0 0 0 0 0 0 0>").fast(2),
    s("cp").gain(0.4).room(0.3).n("<~ 0 ~ 0>").delay(0.1)
  ).slow(2),
  
  // Ambient texture
  note("c5 eb5 g5 bb5".slow(8))
  .s("sawtooth").lpf(400).gain(0.1).room(0.95)
  .pan(perlin.range(-0.8,0.8).slow(8))
).slow(2)