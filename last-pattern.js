stack(
  // Ethereal pad/atmosphere
  note("<[a3,c#4,e4] [g3,b3,d4] [f#3,a3,c#4] [e3,g3,b3]>")
    .s("sawtooth")
    .attack(0.5)
    .decay(0.3)
    .sustain(0.7)
    .release(2)
    .cutoff(800)
    .resonance(0.2)
    .delay(0.3)
    .delaytime(0.375)
    .delayfeedback(0.5)
    .room(0.8)
    .gain(0.4),
  
  // Arpeggiated synth
  note("<a4 c#5 e5 g5 a5 g5 e5 c#5>*2")
    .s("triangle")
    .clip(0.5)
    .cutoff(sine.slow(4).range(1000, 3000))
    .delay(0.4)
    .delaytime(0.125)
    .gain(0.3),
  
  // Bass foundation
  note("<a2 a2 g2 g2 f#2 f#2 e2 e2>")
    .s("sine")
    .shape(0.3)
    .gain(0.5),
  
  // Kick pattern
  sound("bd")
    .bank("RolandTR909")
    .speed(0.9)
    .gain(0.6)
    .struct("<x ~ ~ ~ x ~ ~ ~>"),
  
  // Hi-hats
  sound("hh")
    .bank("RolandTR909")
    .speed(1.2)
    .gain(0.2)
    .struct("<~ x ~ x ~ x ~ x>*2")
    .pan(sine.slow(8).range(-0.5, 0.5)),
  
  // Snare ghost notes
  sound("sd")
    .bank("RolandTR909")
    .speed(1.1)
    .gain(0.15)
    .struct("<~ ~ ~ ~ x ~ ~ ~>")
    .room(0.3),
  
  // Additional texture
  note("<[a5,c#6] [g5,b5] [f#5,a5] [e5,g5]>")
    .s("square")
    .clip(0.1)
    .cutoff(4000)
    .attack(0.01)
    .decay(0.05)
    .sustain(0.1)
    .release(0.5)
    .delay(0.5)
    .delaytime(0.25)
    .delayfeedback(0.7)
    .gain(0.15)
    .pan(cosine.slow(6).range(-0.7, 0.7))
).slow(2)
