import chalk from 'chalk';

/**
 * Get song structure and timing information
 * This is a simplified version - in production you'd use a real API
 */
export async function getSongStructure(artist, song, audioFile) {
  console.log(chalk.blue(`\n🎼 Analyzing song structure for "${song}" by ${artist}`));
  
  if (audioFile) {
    console.log(chalk.gray(`Audio file: ${audioFile}`));
  }
  
  // Check for pre-analyzed data from aubio or ML
  let fullAnalysis = null;
  if (audioFile) {
    const analysisFiles = [
      `${audioFile}.analysis.json`,
      audioFile.replace(/\.[^.]+$/, '.analysis.json'),
      './song.analysis.json'
    ];
    
    for (const file of analysisFiles) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(file)) {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          fullAnalysis = data;
          console.log(chalk.green(`Loaded analysis from ${file}`));
          break;
        }
      } catch (e) {
        // Continue to next file
      }
    }
  }
  
  // Common song structures with approximate timings
  const commonStructures = {
    'pop': {
      intro: { start: 0, duration: 8, description: 'Instrumental intro, establish mood' },
      verse1: { start: 8, duration: 16, description: 'First verse, introduce melody' },
      chorus1: { start: 24, duration: 16, description: 'Main hook, full energy' },
      verse2: { start: 40, duration: 16, description: 'Second verse, develop theme' },
      chorus2: { start: 56, duration: 16, description: 'Repeat chorus with variations' },
      bridge: { start: 72, duration: 8, description: 'Bridge section, change dynamics' },
      chorus3: { start: 80, duration: 16, description: 'Final chorus, maximum energy' },
      outro: { start: 96, duration: 8, description: 'Fade out or ending' }
    },
    'rock': {
      intro: { start: 0, duration: 4, description: 'Guitar/drum intro' },
      verse1: { start: 4, duration: 12, description: 'First verse, establish groove' },
      prechorus1: { start: 16, duration: 8, description: 'Build up energy' },
      chorus1: { start: 24, duration: 8, description: 'Main hook' },
      verse2: { start: 32, duration: 12, description: 'Second verse' },
      prechorus2: { start: 44, duration: 8, description: 'Build up again' },
      chorus2: { start: 52, duration: 8, description: 'Chorus repeat' },
      solo: { start: 60, duration: 16, description: 'Guitar solo section' },
      bridge: { start: 76, duration: 8, description: 'Dynamic change' },
      chorus3: { start: 84, duration: 16, description: 'Final chorus with outro' }
    },
    'electronic': {
      intro: { start: 0, duration: 16, description: 'Build up with filters and effects' },
      drop1: { start: 16, duration: 16, description: 'First drop, main beat' },
      breakdown1: { start: 32, duration: 16, description: 'Breakdown, reduce energy' },
      buildup1: { start: 48, duration: 8, description: 'Build tension' },
      drop2: { start: 56, duration: 16, description: 'Second drop, variations' },
      breakdown2: { start: 72, duration: 16, description: 'Second breakdown' },
      buildup2: { start: 88, duration: 8, description: 'Final build' },
      drop3: { start: 96, duration: 16, description: 'Final drop' },
      outro: { start: 112, duration: 16, description: 'Fade out with effects' }
    }
  };
  
  // Grimes would be electronic
  let structure = commonStructures.pop; // default
  
  const artistLower = artist.toLowerCase();
  if (artistLower.includes('grimes') || artistLower.includes('daft punk') || artistLower.includes('deadmau5')) {
    structure = commonStructures.electronic;
  } else if (artistLower.includes('pink floyd')) {
    structure = commonStructures.rock;
  }
  
  return {
    structure,
    fullAnalysis
  };
}

/**
 * Get approximate BPM for a song
 */
export async function estimateBPM(artist, song, audioFile) {
  // Check for pre-analyzed BPM first
  if (audioFile) {
    const analysisFiles = [
      `${audioFile}.analysis.json`,
      audioFile.replace(/\.[^.]+$/, '.analysis.json'),
      './song.analysis.json'
    ];
    
    for (const file of analysisFiles) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(file)) {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (data.bpm) {
            console.log(chalk.green(`Using analyzed BPM: ${data.bpm}`));
            return data.bpm;
          }
        }
      } catch (e) {
        // Continue to next file
      }
    }
  }
  
  // Fallback to genre-based estimation
  const artistLower = artist.toLowerCase();
  const songLower = song.toLowerCase();
  
  // Electronic/Dance
  if (artistLower.includes('grimes') || artistLower.includes('daft punk') || artistLower.includes('deadmau5')) {
    return 128;
  }
  
  // Rock
  if (artistLower.includes('pink floyd')) {
    return 120;
  }
  
  // Ballads
  if (songLower.includes('ballad') || songLower.includes('slow')) {
    return 70;
  }
  
  // Default pop tempo
  return 120;
}

/**
 * Format song structure for the LLM prompt
 */
export function formatSongStructure(structure, bpm) {
  let formatted = `BPM: ${bpm}\n\nSong Structure:\n`;
  
  for (const [section, details] of Object.entries(structure)) {
    const bars = Math.floor(details.duration / 4); // Assuming 4/4 time
    formatted += `- ${section}: ${details.start}s-${details.start + details.duration}s (${bars} bars) - ${details.description}\n`;
  }
  
  return formatted;
}

/**
 * Get mock lyrics structure (in production, use a lyrics API)
 */
export function getLyricsHint(_artist, _song) {
  // This would normally fetch real lyrics
  // For now, return a structure hint
  return `
The song has a typical verse-chorus structure with themes about:
- Emotional depth and introspection
- Building energy from quiet verses to powerful choruses  
- Dynamic contrast between sections
- Memorable hooks in the chorus
`;
}