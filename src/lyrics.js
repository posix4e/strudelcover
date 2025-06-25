import chalk from 'chalk';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';

/**
 * Get song structure and timing information
 * First tries to load pre-analyzed data, then falls back to defaults
 */
export async function getSongStructure(artist, song, audioFile) {
  console.log(chalk.blue(`\n🎼 Analyzing song structure for "${song}" by ${artist}`));
  
  // Check for pre-analyzed data
  if (audioFile) {
    const analysisFiles = [
      `${audioFile}.analysis.json`,
      audioFile.replace(/\.[^.]+$/, '.analysis.json'),
      './song.analysis.json'
    ];
    
    for (const analysisFile of analysisFiles) {
      if (existsSync(analysisFile)) {
        try {
          console.log(chalk.green(`  ✓ Loading pre-analyzed data from ${analysisFile}`));
          const data = JSON.parse(await fs.readFile(analysisFile, 'utf8'));
          
          // Return the full analysis data for comprehensive version
          if (data.sections) {
            return { 
              structure: convertSectionsToStructure(data.sections),
              fullAnalysis: data 
            };
          }
          
          // Legacy format support
          if (data.structure) {
            const structure = {};
            for (const [section, details] of Object.entries(data.structure)) {
              structure[section] = {
                start: details.start,
                duration: details.end - details.start,
                description: details.description || section
              };
            }
            return { structure, fullAnalysis: null };
          }
        } catch (error) {
          console.log(chalk.yellow(`  ⚠ Failed to load analysis: ${error.message}`));
        }
      }
    }
  }
  
  // Fallback to default structure
  console.log(chalk.gray('  Using default pop structure'));
  return {
    structure: {
      intro: { start: 0, duration: 8, description: 'Instrumental intro, establish mood' },
      verse1: { start: 8, duration: 16, description: 'First verse, introduce melody' },
      chorus1: { start: 24, duration: 16, description: 'Main hook, full energy' },
      verse2: { start: 40, duration: 16, description: 'Second verse, develop theme' },
      chorus2: { start: 56, duration: 16, description: 'Repeat chorus with variations' },
      bridge: { start: 72, duration: 8, description: 'Bridge section, change dynamics' },
      chorus3: { start: 80, duration: 16, description: 'Final chorus, maximum energy' },
      outro: { start: 96, duration: 8, description: 'Fade out or ending' }
    },
    fullAnalysis: null
  };
}

/**
 * Convert comprehensive sections format to simple structure
 */
function convertSectionsToStructure(sections) {
  const structure = {};
  for (const [section, details] of Object.entries(sections)) {
    structure[section] = {
      start: details.start,
      duration: details.duration,
      description: `${details.analysis.energy} energy, BPM: ${details.analysis.bpm}, Volume: ${details.analysis.mean_volume}dB`
    };
  }
  return structure;
}

/**
 * Get approximate BPM for a song
 * First tries to load from pre-analyzed data, then returns default
 */
export async function estimateBPM(artist, song, audioFile) {
  // Check for pre-analyzed data
  if (audioFile) {
    const analysisFiles = [
      `${audioFile}.analysis.json`,
      audioFile.replace(/\.[^.]+$/, '.analysis.json'),
      './song.analysis.json'
    ];
    
    for (const analysisFile of analysisFiles) {
      if (existsSync(analysisFile)) {
        try {
          const data = JSON.parse(await fs.readFile(analysisFile, 'utf8'));
          if (data.bpm) {
            console.log(chalk.green(`  ✓ BPM from analysis: ${data.bpm}`));
            return data.bpm;
          }
        } catch (error) {
          // Continue to next file
        }
      }
    }
  }
  
  // Default tempo
  console.log(chalk.gray('  Using default BPM: 120'));
  return 120;
}

/**
 * Format song structure for the LLM prompt
 */
export function formatSongStructure(structure, bpm) {
  let formatted = `BPM: ${bpm}\n\nSong Structure:\n`;
  
  // Handle case where structure might be empty or invalid
  if (!structure || typeof structure !== 'object') {
    return formatted + '- No structure data available\n';
  }
  
  for (const [section, details] of Object.entries(structure)) {
    if (details && typeof details === 'object' && 'start' in details && 'duration' in details) {
      const bars = Math.floor(details.duration / 4); // Assuming 4/4 time
      formatted += `- ${section}: ${details.start}s-${details.start + details.duration}s (${bars} bars) - ${details.description}\n`;
    }
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