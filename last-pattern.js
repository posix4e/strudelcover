stack(
  // Atmospheric pad
  note("<[c2 eb2] [g2 bb2]>").s("sawtooth").gain(0.3).cutoff(800).room(0.8).delay(0.5),
  
  // Bass line
  note("<c1 eb1 g1 bb1>").s("sine").gain(0.7).shape(0.3),
  
  // Arpeggiated synth
  note("[c4 eb4 g4 bb4 c5 bb4 g4 eb4]*2")
    .s("triangle")
    .gain(0.4)
    .cutoff(sine.range(400, 1200).slow(4))
    .delay(0.3)
    .delaytime(0.125)
    .room(0.5),
  
  // Kick pattern
  sound("bd*4").gain(0.8).shape(0.5),
  
  // Hi-hats
  sound("hh*8").gain(0.3).pan(sine.range(-0.5, 0.5).fast(2)),
  
  // Snare
  sound("~ sd ~ sd").gain(0.6).room(0.2),
  
  // Ethereal lead
  note("<[c5 ~] [eb5 ~] [g5 ~] [bb5 ~]>")
    .s("sawtooth")
    .gain(0.3)
    .cutoff(1500)
    .resonance(0.3)
    .delay(0.6)
    .delaytime(0.375)
    .room(0.7)
    .pan(sine.range(-0.3, 0.3).slow(8)),
  
  // Glitchy percussion
  sound("[~ ~ ~ rim]*2").gain(0.4).speed(rand.range(0.8, 1.2)).sometimes(rev)
).slow(2)