// Genesis-inspired pattern at 120 BPM
// Note: This is an original composition inspired by the style, not a reproduction

setclock(120/60)

// Intro (0s-10s, 2 bars)
let intro = stack(
  s("http://localhost:8889/intro").gain(0.7).delay(0.3).room(0.5),
  s("bd").struct("x ~ ~ ~").gain(0.6),
  note("c2 eb2").s("sawtooth").cutoff(800).gain(0.3)
)

// Verse pattern (8s-24s, 4 bars)
let verse = stack(
  // Drums
  s("http://localhost:8889/kick, ~ ~ ~, http://localhost:8889/snare, ~ ~ ~").gain(0.7),
  s("hh*8").gain(0.3).pan(sine.range(-0.5,0.5)),
  // Bass
  note("c2 ~ eb2 ~, g2 ~ f2 ~").s("sawtooth").cutoff(1200).gain(0.4),
  // Atmospheric pad
  note("<c4 eb4 g4 bb4>").s("pad").attack(0.5).release(2).gain(0.2).delay(0.2),
  // Melody hint
  note("~ c5 ~ eb5, ~ ~ g5 ~").s("triangle").gain(0.3).room(0.4)
)

// Chorus pattern (24s-40s, 4 bars)
let chorus = stack(
  // Full drums
  s("http://localhost:8889/kick, [~ http://localhost:8889/snare], http://localhost:8889/kick, http://localhost:8889/snare").gain(0.9),
  s("hh*16").gain(0.4).speed("1 1.1").pan(sine.range(-0.7,0.7)),
  s("http://localhost:8889/drop").gain(0.5).speed(0.5).delay(0.4).room(0.7),
  // Driving bass
  note("c2 c2 eb2 eb2, g2 g2 f2 f2").s("sawtooth").cutoff(2000).gain(0.6),
  // Chord progression
  note("<c4 eb4 g4> <eb4 g4 bb4> <f4 ab4 c5> <g4 bb4 d5>").s("supersquare")
    .attack(0.01).release(0.3).gain(0.5).delay(0.1),
  // Lead melody
  note("c5 ~ eb5 g5, ~ bb5 ~ g5, f5 ~ eb5 ~, d5 ~ c5 ~").s("sine")
    .gain(0.6).vibrato(2).room(0.3)
)

// Bridge pattern (72s-80s, 2 bars)
let bridge = stack(
  s("http://localhost:8889/breakdown").gain(0.6).speed(0.8),
  s("bd ~ ~ ~, ~ ~ ~ cp").gain(0.5),
  note("c2 ~ ~ ~").s("sine").gain(0.4).cutoff(600),
  // Ambient texture
  note("c4 eb4 g4 bb4").s("pad").attack(1).release(3).gain(0.3)
    .delay(0.5).room(0.8).pan(perlin.range(-1,1))
)

// Final chorus with variations (80s-96s, 4 bars)
let chorusFinal = stack(
  chorus,
  // Additional energy
  s("http://localhost:8889/buildup").gain(0.4).speed(1.2).delay(0.2),
  note("c6 eb6 g6 eb6").fast(2).s("square").gain(0.2).cutoff(3000).pan(sine),
  s("cr*4").gain(0.3).speed("1 0.9 1.1 0.8")
)

// Outro (96s-104s, 2 bars)
let outro = stack(
  s("http://localhost:8889/intro").gain(0.5).speed(0.7).room(0.9),
  note("c2").s("sine").gain(0.3).release(4),
  note("c4 eb4 g4").s("pad").attack(2).release(4).gain(0.2).delay(0.6)
)

// Full song arrangement
cat(
  intro.slow(2),      // 2 bars
  verse.slow(4),      // 4 bars
  chorus.slow(4),     // 4 bars
  verse.slow(4),      // 4 bars
  chorus.slow(4),     // 4 bars
  bridge.slow(2),     // 2 bars
  chorusFinal.slow(4), // 4 bars
  outro.slow(2)       // 2 bars
)
