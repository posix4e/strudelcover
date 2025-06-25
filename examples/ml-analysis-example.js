#!/usr/bin/env node

/**
 * Example: Using ML analysis results in StrudelCover
 * This shows how to leverage the rich ML analysis data
 */

import { promises as fs } from 'fs';
import chalk from 'chalk';

async function demonstrateMLAnalysis() {
  const analysisFile = process.argv[2];
  
  if (!analysisFile) {
    console.log('Usage: node ml-analysis-example.js <analysis.json>');
    console.log('Example: node ml-analysis-example.js song.combined_analysis.json');
    process.exit(1);
  }
  
  // Load analysis
  const analysis = JSON.parse(await fs.readFile(analysisFile, 'utf8'));
  
  console.log(chalk.blue.bold('\n🎵 ML Analysis Results\n'));
  
  // 1. Stems Information
  if (analysis.stems) {
    console.log(chalk.yellow('🎸 Separated Stems:'));
    for (const [stem, path] of Object.entries(analysis.stems)) {
      console.log(`  ${stem}: ${path}`);
    }
    console.log('\n  Use these in Strudel:');
    console.log('  s("drums").src("' + analysis.stems.drums + '")');
    console.log('  s("bass").src("' + analysis.stems.bass + '")');
  }
  
  // 2. MIDI Transcription
  if (analysis.midi_file) {
    console.log(chalk.yellow('\n🎹 MIDI Transcription:'));
    console.log(`  File: ${analysis.midi_file}`);
    console.log(`  Notes: ${analysis.note_count}`);
    console.log('\n  Use in Strudel for accurate melodies!');
  }
  
  // 3. ML Structure
  if (analysis.ml_sections) {
    console.log(chalk.yellow('\n🏗️  ML-Detected Structure:'));
    for (const section of analysis.ml_sections) {
      console.log(`  ${section.name}: ${section.start.toFixed(1)}s - ${section.end.toFixed(1)}s`);
    }
  }
  
  // 4. Pattern Suggestions
  if (analysis.analyses?.ml?.patterns) {
    const patterns = analysis.analyses.ml.patterns;
    
    console.log(chalk.yellow('\n🎼 Detected Patterns:'));
    
    if (patterns.rhythmic) {
      console.log('  Rhythmic:');
      console.log(`    Common intervals: ${patterns.rhythmic.common_intervals.join(', ')}s`);
      console.log(`    Suggested Strudel: .struct("${patterns.rhythmic.common_intervals.map(i => 'x').join(' ')}")`);
    }
    
    if (patterns.melodic) {
      console.log('  Melodic:');
      console.log(`    Pitch range: ${patterns.melodic.pitch_range.min}-${patterns.melodic.pitch_range.max}`);
      console.log(`    Common intervals: ${patterns.melodic.common_intervals.slice(0, 5).join(', ')} semitones`);
    }
    
    if (patterns.harmonic) {
      console.log('  Harmonic:');
      console.log(`    Chord changes: ${patterns.harmonic.chord_changes}`);
      const chordNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const chords = patterns.harmonic.common_chords.map(c => chordNames[c]).slice(0, 4);
      console.log(`    Suggested progression: "${chords.join(' ')}"`);
    }
  }
  
  // 5. Strudel Pattern Template
  console.log(chalk.green.bold('\n📝 Suggested Strudel Pattern Template:\n'));
  
  const bpm = analysis.bpm || 120;
  const sections = analysis.ml_sections || analysis.sections || {};
  
  console.log(`// BPM: ${bpm}`);
  console.log(`setcpm(${bpm / 2})\n`);
  
  if (analysis.stems) {
    console.log('// Load separated stems');
    console.log('const drums = s("' + analysis.stems.drums + '")');
    console.log('const bass = s("' + analysis.stems.bass + '")');
    console.log('const other = s("' + analysis.stems.other + '")\n');
  }
  
  console.log('// Pattern based on ML analysis');
  console.log('const pattern = stack(');
  console.log('  // Drums from stem');
  console.log('  drums.gain(0.8),');
  console.log('  ');
  console.log('  // Bass from stem or synthesis');
  console.log('  bass.gain(0.7).lpf(800),');
  console.log('  ');
  console.log('  // Melodic elements');
  console.log('  note("c d e f g").piano().delay(0.25)');
  console.log(')');
  console.log('\n// Play with structure timing');
  console.log('pattern.slow(2)');
}

demonstrateMLAnalysis().catch(console.error);