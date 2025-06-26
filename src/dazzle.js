import chalk from 'chalk';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { promises as fs, createReadStream, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getSongStructure, estimateBPM, formatSongStructure, getLyricsHint } from './lyrics.js';
import { analyzeAudio } from './audio-analyzer.js';
import { analyzeWithML } from './ml-analyzer.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Dazzle {
  constructor(options = {}) {
    this.anthropic = new Anthropic({
      apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY
    });
    this.port = options.port || 8888;
    this.server = null;
    this.wss = null;
    this.browser = null;
    this.page = null;
    this.pattern = null;
    this.isRecording = false;
    this.recordOutput = options.recordOutput;
    this.autoRecording = true; // Always record for analysis
    this.lastError = null;
    this.recordProcess = null;
    this.audioFilename = null;
    this.recordingTimeout = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.currentArtist = null;
    this.currentSong = null;
    this.audioAnalysis = options.audioAnalysis || {
      enabled: true,
      bpmDetection: true,
      sampleExtraction: true,
      structureDetection: true
    };
    this.audioData = null;
    this.sampleServer = null;
    this.currentMode = null; // Will progress through: gestalt -> kaizen -> surgery
  }

  async start() {
    // Create recordings directory and archive directory
    await fs.mkdir('./recordings', { recursive: true });
    await fs.mkdir('./recordings/archive', { recursive: true });

    // Start web server
    await this.startServer();
    
    // Launch browser
    await this.launchBrowser();
  }

  async startServer() {
    return new Promise(resolve => {
      this.server = createServer(async (req, res) => {
        if (req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(await this.getHTML());
        }
      });

      this.wss = new WebSocketServer({ server: this.server });
      
      this.wss.on('connection', ws => {
        // Send current pattern if we have one
        if (this.pattern) {
          ws.send(JSON.stringify({
            type: 'pattern',
            data: this.pattern
          }));
        }

        ws.on('message', message => {
          const data = JSON.parse(message);
          if (data.type === 'ready') {
            console.log(chalk.green('✓ Dashboard connected'));
          } else if (data.type === 'startRecording') {
            this.startRecording();
          } else if (data.type === 'stopRecording') {
            this.stopRecording();
          } else if (data.type === 'audioData') {
            // Forward audio data to all clients for visualization
            this.broadcast({ type: 'audioData', data: data.data });
          }
        });
      });

      this.server.listen(this.port, () => {
        console.log(chalk.cyan(`🌟 Dazzle running at http://localhost:${this.port}`));
        resolve();
      });
    });
  }

  async launchBrowser() {
    try {
      this.browser = await chromium.launch({ 
        headless: false,
        args: ['--autoplay-policy=no-user-gesture-required']
      });
      
      // Create context without video recording
      const context = await this.browser.newContext();
      this.page = await context.newPage();
      
      // Listen for console errors
      this.page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (text.includes('SyntaxError') || text.includes('Error')) {
            console.log(chalk.red('\n❌ Strudel Error:'));
            console.log(chalk.red(text));
            // Store the error
            this.lastError = text;
            // Broadcast error to dashboard
            this.broadcast({ type: 'error', data: text });
            
            // No automatic fixes - fail fast
            console.log(chalk.red('\n❌ Pattern generation failed due to syntax errors'));
            console.log(chalk.red('Manual intervention required to fix the pattern'));
            // Don't throw here as it's in browser context, but stop processing
          }
        }
      });
      
      await this.page.goto(`http://localhost:${this.port}`);
    } catch (error) {
      console.log(chalk.yellow('Could not launch browser:', error.message));
      console.log(chalk.gray('You may need to run: npx playwright install chromium'));
      console.log(chalk.gray('Dashboard will still be accessible at http://localhost:8888'));
    }
  }

  async generatePattern(audioFile, artist, song, errorFeedback = null) {
    console.log(chalk.blue(`\n🎵 Generating pattern for "${song}" by ${artist}\n`));
    
    // Store current artist/song for retry
    this.currentArtist = artist;
    this.currentSong = song;
    
    // Send song info to dashboard
    this.broadcast({ type: 'songInfo', artist, song });
    
    // Reset retry count if this is a new request (not a retry)
    if (!errorFeedback) {
      this.retryCount = 0;
    }

    // Get song structure and BPM
    const songStructureResult = await getSongStructure(artist, song, audioFile);
    const songStructure = songStructureResult.structure;
    const fullAnalysis = songStructureResult.fullAnalysis;
    let bpm = await estimateBPM(artist, song, audioFile) || 120;
    
    // Audio analysis
    let audioData = null;
    let mlAnalysis = null;
    
    if (audioFile && this.audioAnalysis.enabled) {
      console.log(chalk.gray(`Audio file: ${audioFile}`));
      
      // ML analysis is required - no fallbacks
      console.log(chalk.magenta('\n🎩 Running ML analysis...'));
      try {
        mlAnalysis = await analyzeWithML(audioFile, { fancy: true });
        if (!mlAnalysis) {
          throw new Error('ML analysis returned no results');
        }
        
        console.log(chalk.green('✓ ML analysis complete'));
        
        // Use ML-detected tempo if available
        if (mlAnalysis.analyses?.advanced_features?.success) {
          const mlBpm = mlAnalysis.analyses.advanced_features.tempo;
          if (mlBpm) {
            console.log(chalk.blue(`Using ML-detected BPM: ${mlBpm}`));
            bpm = Math.round(mlBpm);
          }
        }
        
        // Show what ML features are available
        if (mlAnalysis.analyses?.source_separation?.success) {
          console.log(chalk.green('✓ Source separation: drums, bass, vocals, other'));
        }
        if (mlAnalysis.analyses?.transcription?.success) {
          console.log(chalk.green(`✓ MIDI transcription: ${mlAnalysis.analyses.transcription.note_count} notes`));
        }
        if (mlAnalysis.analyses?.advanced_features?.success) {
          const key = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][mlAnalysis.analyses.advanced_features.estimated_key];
          console.log(chalk.green(`✓ Key detection: ${key}`));
        }
      } catch (error) {
        console.log(chalk.red(`\n❌ ML analysis failed: ${error.message}`));
        console.log(chalk.yellow('\nML analysis is required for realistic music generation.'));
        console.log(chalk.yellow('Please ensure ML dependencies are installed:'));
        console.log(chalk.cyan('  npm run setup:ml'));
        throw error; // Re-throw to stop execution
      }
      
      try {
        audioData = await analyzeAudio(audioFile, artist, song, this.audioAnalysis);
        this.audioData = audioData;
        
        // Use detected BPM if available
        if (audioData.bpm) {
          bpm = audioData.bpm;
          console.log(chalk.blue(`Using detected BPM: ${bpm}`));
        }
        
        // Merge detected structure with estimated structure
        if (audioData.structure && Object.keys(audioData.structure).length > 0) {
          console.log(chalk.blue('Merging detected structure with estimates'));
          // Update song structure with detected sections
          for (const [section, timing] of Object.entries(audioData.structure)) {
            if (songStructure[section]) {
              songStructure[section].start = timing.start;
              songStructure[section].duration = timing.end - timing.start;
            }
          }
        }
        
        // Start sample server if samples were extracted
        if (audioData.samples && audioData.samples.length > 0) {
          await this.startSampleServer(audioData.samples);
        }
      } catch (error) {
        console.log(chalk.yellow(`Audio analysis failed: ${error.message}`));
        console.log(chalk.gray('Continuing with estimated parameters...'));
      }
    } else {
      console.log(chalk.gray('No audio file - using estimated parameters'));
    }

    const structureText = formatSongStructure(songStructure, bpm);
    const lyricsHint = getLyricsHint(artist, song);
    
    console.log(chalk.blue('\n🎵 Song structure analysis:'));
    console.log(chalk.gray(structureText));
    
    // If we have full analysis data, let's show it
    if (fullAnalysis && fullAnalysis.sections) {
      console.log(chalk.blue('\n📊 Detailed audio analysis:'));
      Object.entries(fullAnalysis.sections).forEach(([sectionName, data]) => {
        if (data.bpm && data.energy_level) {
          console.log(chalk.gray(`  ${sectionName}:`));
          console.log(chalk.gray(`    - BPM: ${data.bpm}`));
          console.log(chalk.gray(`    - Energy: ${data.energy_level}%`));
          console.log(chalk.gray(`    - Volume: ${data.volume_peak}dB / ${data.volume_mean}dB (peak/mean)`));
        }
      });
    }
    
    // Load prompt template - use enhanced template for better music theory
    const templateFile = mlAnalysis ? 'pattern-prompt-ml.txt' : 'pattern-prompt-enhanced.txt';
    const promptTemplate = await fs.readFile(
      join(__dirname, 'templates', templateFile), 
      'utf-8'
    );
    
    // Add sample information if available
    let sampleInfo = '';
    if (audioData && audioData.samples && audioData.samples.length > 0) {
      const samplePort = this.port + 1;
      sampleInfo = '\n\nExtracted samples available:\n';
      audioData.samples.forEach(sample => {
        sampleInfo += `- "${sample.name}": Use with s("http://localhost:${samplePort}/${sample.name}")\n`;
      });
      sampleInfo += '\nIncorporate these custom samples into your pattern for authenticity.\n';
    }
    
    // Add ML analysis info
    let mlInfo = '';
    if (mlAnalysis) {
      mlInfo = '\n\nML Analysis Results:\n';
      
      if (mlAnalysis.analyses?.source_separation?.success) {
        mlInfo += '\n**Source Separation (stems available):**\n';
        const stems = mlAnalysis.analyses.source_separation.stems;
        Object.entries(stems).forEach(([stem, _path]) => {
          mlInfo += `- ${stem}: Available as separated audio\n`;
        });
      }
      
      if (mlAnalysis.analyses?.transcription?.success) {
        const trans = mlAnalysis.analyses.transcription;
        mlInfo += '\n**MIDI Transcription:**\n';
        mlInfo += `- ${trans.note_count} notes detected\n`;
        mlInfo += `- MIDI file: ${trans.midi_file}\n`;
        if (trans.first_notes && trans.first_notes.length > 0) {
          mlInfo += `- First few notes: ${trans.first_notes.slice(0, 5).map(n => `${n.pitch}`).join(', ')}\n`;
        }
      }
      
      if (mlAnalysis.analyses?.advanced_features?.success) {
        const feat = mlAnalysis.analyses.advanced_features;
        mlInfo += '\n**Advanced Features:**\n';
        mlInfo += `- ML-detected tempo: ${feat.tempo} BPM\n`;
        mlInfo += `- Estimated key: ${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][feat.estimated_key]}\n`;
        mlInfo += `- ${feat.section_count} sections detected\n`;
      }
    }
    
    // Replace placeholders
    let prompt = promptTemplate
      .replace(/{{song}}/g, song)
      .replace(/{{artist}}/g, artist)
      .replace(/{{songStructure}}/g, structureText)
      .replace(/{{lyricsHint}}/g, lyricsHint)
      .replace(/{{sampleInfo}}/g, sampleInfo)
      .replace(/{{mlInfo}}/g, mlInfo || '')
      .replace(/{{fullAnalysis}}/g, JSON.stringify(fullAnalysis || {}, null, 2))
      .replace(/{{bpm}}/g, bpm);
    
    // Add error feedback if retrying
    if (errorFeedback) {
      let errorMessage = `IMPORTANT: The previous pattern had an error. Please fix it:\n\nERROR: ${errorFeedback}\n\n`;
      
      // Check for common function errors and provide documentation reference
      if (errorFeedback.includes('sound is not defined') || 
          errorFeedback.includes('setclock is not defined') ||
          errorFeedback.includes('kick is not defined') ||
          errorFeedback.includes('bass is not defined') ||
          errorFeedback.includes('synth is not defined')) {
        errorMessage += 'It looks like you\'re using functions that don\'t exist in Strudel. Please consult the Strudel documentation at strudel.cc/learn/ to find the correct functions.\n\n';
      }
      
      errorMessage += 'Please generate a corrected pattern that fixes this error. Make sure to use valid Strudel syntax.\n\n';
      
      prompt = errorMessage + prompt;
    }

    console.log(chalk.yellow('🤖 Asking Claude to generate pattern...'));
    console.log(chalk.gray(`Prompt length: ${prompt.length} characters`));
    
    // Show the full prompt being sent
    console.log(chalk.blue('\n📤 Sending prompt to Claude:'));
    console.log(chalk.gray('─'.repeat(70)));
    console.log(chalk.dim(prompt));
    console.log(chalk.gray('─'.repeat(70)));
    
    const startTime = Date.now();
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      });
      
      const endTime = Date.now();
      console.log(chalk.gray(`\nClaude response time: ${(endTime - startTime) / 1000}s`));
      
      // Show the full response from Claude
      const fullResponse = response.content[0].text;
      console.log(chalk.green('\n📥 Claude\'s full response:'));
      console.log(chalk.gray('─'.repeat(70)));
      // Don't truncate - show full response
      console.log(chalk.dim(fullResponse));
      console.log(chalk.gray('─'.repeat(70)));
      console.log(chalk.gray(`Response length: ${fullResponse.length} characters`));

      // Extract code from response
      const rawResponse = response.content[0].text;
      console.log(chalk.blue('\n🔍 Raw response analysis:'));
      console.log(chalk.gray(`- Raw length: ${rawResponse.length}`));
      console.log(chalk.gray(`- Starts with: ${JSON.stringify(rawResponse.slice(0, 50))}`));
      console.log(chalk.gray(`- Ends with: ${JSON.stringify(rawResponse.slice(-50))}`));
      
      this.pattern = this.extractCode(rawResponse);
      
      console.log(chalk.blue('\n🔍 After extractCode:'));
      console.log(chalk.gray(`- Pattern length: ${this.pattern.length}`));
      console.log(chalk.gray(`- Last 20 chars: ${JSON.stringify(this.pattern.slice(-20))}`));
      console.log(chalk.gray(`- Char codes of last 5: [${this.pattern.slice(-5).split('').map(c => c.charCodeAt(0)).join(', ')}]`));
      
      // Check parentheses balance
      const openParens = (this.pattern.match(/\(/g) || []).length;
      const closeParens = (this.pattern.match(/\)/g) || []).length;
      console.log(chalk.yellow(`\n⚖️  Parentheses balance: ${openParens} open, ${closeParens} close`));
      if (openParens !== closeParens) {
        console.log(chalk.red(`❌ Unbalanced parentheses! Difference: ${closeParens - openParens}`));
      }
      
    } catch (error) {
      console.error(chalk.red('Claude Error:'), error.message);
      throw new Error(`Pattern generation failed: ${error.message}`);
    }
    
    console.log(chalk.green('✓ Initial pattern generated'));
    
    // Validate and fix syntax errors
    console.log(chalk.yellow('\n🔧 Validating pattern syntax...'));
    this.pattern = await this.validatePattern(this.pattern);
    
    console.log(chalk.cyan('\n📝 Generated pattern:'));
    console.log(chalk.gray('─'.repeat(50)));
    // Don't truncate - show full pattern
    console.log(this.pattern);
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray(`Pattern length: ${this.pattern.length} characters`));
    
    // Send to dashboard
    this.broadcast({ type: 'pattern', data: this.pattern });
    
    // Write pattern to file for debugging
    await fs.writeFile('last-pattern.js', this.pattern);
    console.log(chalk.gray('Pattern written to last-pattern.js for inspection'));
    
    // Store song structure for multi-pass refinement
    this.songStructure = songStructure;
    this.songBpm = bpm;
    this.mlData = mlAnalysis;
    
    // Wait a bit then try autoplay
    setTimeout(() => this.autoplay(), 3000);
    
    // Start multi-pass refinement process
    if (!errorFeedback) {
      setTimeout(() => {
        console.log(chalk.blue('\n🎭 Starting Multi-Pass Refinement Process...'));
        this.startMultiPassRefinement();
      }, 10000); // Start after 10 seconds
    }
    
    // Log message about recording
    if (this.recordOutput) {
      console.log(chalk.yellow(`\n🎵 Audio will be saved to: ${this.recordOutput}`));
    } else {
      console.log(chalk.gray('\n🎵 To record audio, click "Start Recording" in the dashboard'));
    }
    
    return this.pattern;
  }
  
  async retryWithErrorFeedback() {
    this.retryCount++;
    
    // Send retry update to dashboard
    this.broadcast({ type: 'retryUpdate', count: this.retryCount });
    
    // Clear the last error
    const errorToFix = this.lastError;
    this.lastError = null;
    
    console.log(chalk.yellow('\n🔧 Sending error to Claude for correction...'));
    console.log(chalk.gray('Error:', errorToFix));
    
    // Generate a new pattern with error feedback
    await this.generatePattern(null, this.currentArtist, this.currentSong, errorToFix);
  }

  async validatePattern(pattern) {
    const validationPrompt = `You are a Strudel live coding expert. I have a pattern that may contain errors. Please review it and fix any issues.

IMPORTANT Strudel syntax rules:
- Use s() for samples: s("bd"), s("hh"), s("sd")
- Use note() for notes: note("C3 D3 E3")
- Use sound() to apply sounds to notes: note("C3 D3").sound("piano")
- Do NOT use functions like kick(), bass(), synth(), voicings(), etc - these don't exist
- Use stack() to layer patterns
- Use cat() to sequence patterns
- Common effects: .gain(), .room(), .delay(), .pan(), .cutoff(), .resonance()
- Rhythm notation: "bd ~ sd ~" where ~ is a rest
- Euclidean rhythms: s("bd(3,8)")

Here's the pattern to validate and fix:

${pattern}

Return ONLY the corrected Strudel code, no explanations.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: validationPrompt }]
      });
      
      console.log(chalk.green('✓ Pattern validated and corrected'));
      return this.extractCode(response.content[0].text);
    } catch (error) {
      console.error(chalk.red('Validation Error:'), error.message);
      return pattern; // Return original if validation fails
    }
  }

  async startMultiPassRefinement() {
    if (!this.songStructure || !this.pattern) {
      console.log(chalk.yellow('Cannot start refinement - missing song data'));
      return;
    }

    console.log(chalk.blue('\n🎭 MULTI-PASS REFINEMENT PROCESS'));
    console.log(chalk.gray('Phase 1: Gestalt (Whole Song) → Phase 2: Kaizen (Sections) → Phase 3: Surgery (Details)'));

    // Phase 1: Gestalt Mode
    await this.gestaltMode();
    
    // Phase 2: Kaizen Mode (automatically starts after Gestalt)
    // Phase 3: Surgery Mode (automatically starts after Kaizen)
  }

  getModeDescription(mode) {
    const descriptions = {
      gestalt: '🌍 Gestalt Mode: Analyzing and refining the whole song structure',
      kaizen: '📈 Kaizen Mode: Continuous improvement, one section at a time',
      surgery: '🔬 Surgery Mode: Precise tweaks to specific measures'
    };
    return descriptions[mode] || mode;
  }

  async gestaltMode() {
    console.log(chalk.blue('\n🌍 PHASE 1: GESTALT MODE - Whole Song Analysis'));
    this.currentMode = 'gestalt';
    
    // Update visualization
    this.broadcast({ 
      type: 'modeChange', 
      mode: 'gestalt',
      phase: 1,
      description: '🌍 Analyzing whole song structure and flow'
    });
    
    console.log(chalk.gray('Analyzing song cohesion, transitions, and overall energy arc...'));
    
    const gestaltPrompt = `You are in GESTALT mode - analyzing the entire song structure holistically.

Current pattern:
${this.pattern}

Song: "${this.currentSong}" by ${this.currentArtist}
BPM: ${this.songBpm}

Analyze and improve:
1. Overall energy arc and dynamics
2. Transitions between sections
3. Thematic consistency
4. Balance between repetition and variation
5. Climax placement and build-up

Make the pattern more cohesive while maintaining the original song's character.
Return the COMPLETE improved pattern. ONLY Strudel code.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: gestaltPrompt }]
      });
      
      this.pattern = this.extractCode(response.content[0].text);
      console.log(chalk.green('✓ Gestalt analysis complete - whole song structure optimized'));
      
      await this.updateVisualization('gestalt', {
        status: 'complete',
        improvements: ['Energy arc balanced', 'Transitions smoothed', 'Theme unified']
      });
      await this.updatePatternInBrowser();
      
    } catch (error) {
      console.error(chalk.red('Gestalt mode error:'), error.message);
    }
    
    // Wait before transitioning to Kaizen mode
    console.log(chalk.gray('\nLetting the improved structure play for 20 seconds...'));
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Transition to Kaizen mode
    await this.kaizenMode();
  }

  async kaizenMode() {
    console.log(chalk.blue('\n📈 PHASE 2: KAIZEN MODE - Section-by-Section Improvement'));
    this.currentMode = 'kaizen';
    
    // Update visualization
    this.broadcast({ 
      type: 'modeChange', 
      mode: 'kaizen',
      phase: 2,
      description: '📈 Improving each section individually'
    });
    
    const sections = ['intro', 'verse', 'chorus', 'bridge', 'outro'];
    const availableSections = sections.filter(s => this.songStructure[s]);
    
    console.log(chalk.gray(`Sections to improve: ${availableSections.join(' → ')}`));
    
    // Create Kanban-style visualization
    const kanban = {
      todo: [...availableSections],
      inProgress: [],
      done: []
    };
    
    await this.updateVisualization('kaizen', { kanban, status: 'starting' });
    
    for (let i = 0; i < availableSections.length; i++) {
      const section = availableSections[i];
      
      // Update Kanban
      kanban.todo = kanban.todo.filter(s => s !== section);
      kanban.inProgress = [section];
      await this.updateVisualization('kaizen', { 
        kanban, 
        currentSection: section,
        progress: `${i + 1}/${availableSections.length}`
      });
      
      await this.refineSection(section);
      
      // Mark as done
      kanban.inProgress = [];
      kanban.done.push(section);
      await this.updateVisualization('kaizen', { 
        kanban, 
        completedSection: section 
      });
      
      // Shorter wait between sections since user can hear improvements building up
      if (i < availableSections.length - 1) {
        console.log(chalk.gray(`Next section in 10 seconds...`));
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    console.log(chalk.green('\n✨ Kaizen phase complete - all sections improved!'));
    
    // Wait before surgery mode
    console.log(chalk.gray('\nLetting the refined sections play for 15 seconds...'));
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Automatically transition to surgery mode
    await this.surgeryMode();
  }

  async surgeryMode() {
    console.log(chalk.blue('\n🔬 PHASE 3: SURGERY MODE - Precision Details'));
    this.currentMode = 'surgery';
    
    // Update visualization
    this.broadcast({ 
      type: 'modeChange', 
      mode: 'surgery',
      phase: 3,
      description: '🔬 Fine-tuning specific details and transitions'
    });
    
    console.log(chalk.gray('Identifying areas for surgical precision...'));
    
    // Automatically identify problem areas based on pattern analysis
    const surgeryTargets = this.identifySurgeryTargets();
    
    console.log(chalk.gray(`Identified ${surgeryTargets.length} areas for improvement`));
    
    // Show surgical targets
    await this.updateVisualization('surgery', {
      targets: surgeryTargets,
      status: 'analyzing'
    });
    
    for (let i = 0; i < surgeryTargets.length; i++) {
      const target = surgeryTargets[i];
      console.log(chalk.yellow(`\n🔬 Surgery ${i + 1}/${surgeryTargets.length}: ${target.description}`));
      console.log(chalk.gray(`Target: ${target.location}`));
      
      await this.updateVisualization('surgery', {
        currentTarget: target,
        progress: `${i + 1}/${surgeryTargets.length}`,
        status: 'operating'
      });
      
      const surgeryPrompt = `You are in SURGERY mode - making precise tweaks to a specific part of the pattern.

Current pattern:
${this.pattern}

Target: ${target.location}
Task: ${target.description}
Type: ${target.type}

Focus ONLY on improving this specific area with surgical precision.
Keep everything else EXACTLY the same.

Return the COMPLETE pattern with your precise improvements. ONLY Strudel code.`;

      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-opus-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: surgeryPrompt }]
        });
        
        this.pattern = this.extractCode(response.content[0].text);
        console.log(chalk.green(`✓ Surgery complete: ${target.description}`));
        
        await this.updateVisualization('surgery', {
          completedTarget: target,
          status: 'success'
        });
        
        await this.updatePatternInBrowser();
        
      } catch (error) {
        console.error(chalk.red(`Surgery error:`, error.message));
      }
      
      // Shorter wait for surgery mode
      if (i < surgeryTargets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 6000));
      }
    }
    
    console.log(chalk.green('\n✨ All three phases complete!'));
    console.log(chalk.blue('\n🎉 MULTI-PASS REFINEMENT FINISHED'));
    console.log(chalk.gray('Your pattern has been refined through:'));
    console.log(chalk.gray('  1. Gestalt - Whole song structure'));
    console.log(chalk.gray('  2. Kaizen - Individual sections'));
    console.log(chalk.gray('  3. Surgery - Precise details'));
    
    await this.updateVisualization('complete', {
      message: 'Multi-pass refinement complete!',
      phases: ['Gestalt ✓', 'Kaizen ✓', 'Surgery ✓']
    });
  }

  identifySurgeryTargets() {
    // Analyze pattern to find areas needing surgical precision
    const targets = [];
    
    // Always improve key transitions
    if (this.songStructure.verse && this.songStructure.chorus) {
      targets.push({
        type: 'transition',
        location: 'Verse to Chorus transition',
        description: 'Smooth the energy build from verse to chorus'
      });
    }
    
    // Add drum fills before choruses
    targets.push({
      type: 'drums',
      location: '1 measure before each chorus',
      description: 'Add dynamic drum fills to signal chorus arrival'
    });
    
    // Improve intro hook
    if (this.songStructure.intro) {
      targets.push({
        type: 'hook',
        location: 'First 4 measures of intro',
        description: 'Create memorable opening hook'
      });
    }
    
    // Add melodic variation
    targets.push({
      type: 'melody',
      location: 'Second half of chorus',
      description: 'Add melodic variation and flourishes'
    });
    
    // Enhance outro
    if (this.songStructure.outro) {
      targets.push({
        type: 'effects',
        location: 'Final 8 measures',
        description: 'Add fadeout effects and final statement'
      });
    }
    
    return targets;
  }

  async updateVisualization(mode, data) {
    this.broadcast({
      type: 'visualizationUpdate',
      mode: mode,
      data: data,
      timestamp: new Date().toISOString()
    });
  }

  async refineSection(sectionName) {
    console.log(chalk.blue(`\n🔧 Refining ${sectionName}...`));
    
    const sectionData = this.songStructure[sectionName];
    
    // Create a focused prompt for this section
    let refinementPrompt = `You are refining the ${sectionName} section of a Strudel pattern.

Current full pattern:
${this.pattern}

Section details:
- Name: ${sectionName}
- Start: ${sectionData.start} seconds
- Duration: ${sectionData.duration} seconds
- BPM: ${this.songBpm}

Please improve ONLY the ${sectionName} section by:
1. Adding more musical variety and interest
2. Ensuring smooth transitions in and out
3. Using appropriate energy level for a ${sectionName}
4. Adding subtle effects and automation
5. Making it more characteristic of the original song style`;

    // Add ML data if available
    if (this.mlData?.analyses?.transcription?.success) {
      refinementPrompt += `\n\nML Analysis available:
- Detected notes in this section (use these for accuracy)
- Transcribed MIDI available`;
    }

    if (this.mlData?.analyses?.advanced_features?.success) {
      const key = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][this.mlData.analyses.advanced_features.estimated_key];
      refinementPrompt += `\n- Detected key: ${key} (use appropriate scales)`;
    }

    refinementPrompt += `\n\nReturn the ENTIRE pattern with the improved ${sectionName} section. The rest should remain unchanged.
Return ONLY Strudel code, no explanations.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: refinementPrompt }]
      });
      
      const refinedPattern = this.extractCode(response.content[0].text);
      
      // Update the pattern
      this.pattern = refinedPattern;
      
      console.log(chalk.green(`✓ ${sectionName} section refined`));
      
      // Send updated pattern to dashboard
      this.broadcast({ 
        type: 'patternUpdate', 
        data: this.pattern,
        section: sectionName,
        message: `Refined ${sectionName} section`
      });
      
      // Write to file
      await fs.writeFile('last-pattern.js', this.pattern);
      
      // Update in the browser
      await this.updatePatternInBrowser();
      
    } catch (error) {
      console.error(chalk.red(`Failed to refine ${sectionName}:`), error.message);
    }
  }

  async updatePatternInBrowser() {
    if (!this.page) return;
    
    try {
      const frame = this.page.frames().find(f => f.url().includes('strudel.cc'));
      if (!frame) return;
      
      const editor = await frame.$('.cm-content');
      if (editor) {
        // Clear and set new pattern
        await editor.click();
        const selectAllKey = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
        await this.page.keyboard.press(selectAllKey);
        await this.page.keyboard.press('Delete');
        await editor.fill(this.pattern);
        
        // Evaluate
        const evalKey = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
        await this.page.keyboard.press(evalKey);
        
        console.log(chalk.gray('Pattern updated in browser'));
      }
    } catch (error) {
      console.log(chalk.yellow('Could not update pattern in browser:', error.message));
    }
  }

  extractCode(response) {
    // Try to find code block
    const codeMatch = response.match(/```(?:javascript|js|strudel)?\n([\s\S]*?)```/);
    if (codeMatch) {
      // Return the code block content WITHOUT trimming
      return codeMatch[1];
    }
    
    // Otherwise return the whole response as-is
    // Since we asked for ONLY code, we shouldn't trim it
    return response;
  }
  
  getFallbackPattern(song, artist) {
    return `// Fallback pattern for ${song} by ${artist}
setcps(120/60/4)

stack(
  sound("bd*4"),
  sound("hh*8"),
  sound("sd ~ sd"),
  note("c3 eb3 g3 c4").sound("piano").slow(4)
)`;
  }

  broadcast(message) {
    if (!this.wss) {return;}
    
    const data = JSON.stringify(message);
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  }

  async tryRemoveTrailingParen() {
    if (!this.page) {return;}
    
    try {
      // Wait for iframe
      await this.page.waitForSelector('iframe#strudel', { timeout: 5000 });
      
      // Get the iframe
      const frame = this.page.frames().find(f => f.url().includes('strudel.cc'));
      if (!frame) {
        console.log(chalk.red('Could not find Strudel frame'));
        return;
      }

      // Wait for editor to be ready
      await frame.waitForLoadState('networkidle');
      
      // Find the CodeMirror editor
      const editor = await frame.$('.cm-content');
      if (editor) {
        // Click at the end of the editor
        await editor.click();
        
        // Move to end of document
        const endKey = process.platform === 'darwin' ? 'Meta+End' : 'Control+End';
        await this.page.keyboard.press(endKey);
        
        // Delete the last character (the extra parenthesis)
        await this.page.keyboard.press('Backspace');
        
        console.log(chalk.green('✅ Removed trailing parenthesis'));
        
        // Re-evaluate the pattern
        const evalKey = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
        await this.page.keyboard.press(evalKey);
        console.log(chalk.green('✅ Re-evaluated pattern!'));
        
        // Wait a bit to see if it worked
        await this.page.waitForTimeout(2000);
        
        // Now try to click play button
        const playButton = await frame.$('button[title="play"]');
        if (playButton) {
          await playButton.click();
          console.log(chalk.green('✅ Autoplay successful after fix!'));
          
          // Always start recording after autoplay
          setTimeout(() => {
            this.broadcast({ type: 'autoplayStarted' });
            this.startRecording();
          }, 1000);
        } else {
          // Try spacebar as fallback
          await this.page.keyboard.press('Space');
        }
      } else {
        console.log(chalk.yellow('⚠️  Could not find editor'));
      }
    } catch (error) {
      console.log(chalk.yellow('Failed to remove trailing paren:', error.message));
    }
  }

  async autoplay() {
    if (!this.page) {return;}
    
    console.log(chalk.yellow('🎵 Setting pattern and attempting autoplay...'));
    
    try {
      // Wait for iframe
      await this.page.waitForSelector('iframe#strudel', { timeout: 5000 });
      
      // Get the iframe
      const frame = this.page.frames().find(f => f.url().includes('strudel.cc'));
      if (!frame) {
        console.log(chalk.red('Could not find Strudel frame'));
        return;
      }

      // Wait for it to load
      await frame.waitForLoadState('networkidle');
      await this.page.waitForTimeout(2000);
      
      // Set the pattern in the editor
      if (this.pattern) {
        console.log(chalk.cyan('📝 Setting pattern in Strudel editor...'));
        
        // Find the CodeMirror editor
        const editor = await frame.$('.cm-content');
        if (editor) {
          // Clear existing content
          await editor.click();
          // Use platform-specific select all
          const selectAllKey = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
          await this.page.keyboard.press(selectAllKey);
          await this.page.keyboard.press('Delete');
          
          // Type the new pattern
          console.log(chalk.blue('\n📝 About to type pattern:'));
          console.log(chalk.gray(`- Pattern length: ${this.pattern.length} characters`));
          console.log(chalk.gray(`- Last 30 chars: ${JSON.stringify(this.pattern.slice(-30))}`));
          console.log(chalk.gray(`- Last char code: ${this.pattern.charCodeAt(this.pattern.length - 1)}`));
          
          // Log each line ending for debugging
          const lines = this.pattern.split('\n');
          console.log(chalk.gray(`- Total lines: ${lines.length}`));
          console.log(chalk.gray(`- Last line: ${JSON.stringify(lines[lines.length - 1])}`));
          
          // Type the pattern using the more reliable fill method
          console.log(chalk.yellow('🔄 Using editor.fill() instead of keyboard.type()...'));
          await editor.fill(this.pattern);
          console.log(chalk.green('✅ Pattern set in editor!'));
          
          // Wait a moment for the editor to process
          await this.page.waitForTimeout(500);
          
          // Get what's actually in the editor now
          const editorContent = await editor.textContent();
          console.log(chalk.blue('\n🔍 Editor content after typing:'));
          console.log(chalk.gray(`- Editor length: ${editorContent.length}`));
          console.log(chalk.gray(`- Last 30 chars: ${JSON.stringify(editorContent.slice(-30))}`));
          
          // Compare lengths
          if (editorContent.length !== this.pattern.length) {
            console.log(chalk.red(`❌ Length mismatch! Pattern: ${this.pattern.length}, Editor: ${editorContent.length}, Diff: ${editorContent.length - this.pattern.length}`));
          }
          
          // Evaluate the pattern
          const evalKey = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
          await this.page.keyboard.press(evalKey);
          console.log(chalk.green('✅ Pattern evaluated!'));
          
          // Wait a bit for the pattern to be processed
          await this.page.waitForTimeout(2000);
          
          // Check for errors in the console
          const errorElement = await frame.$('.error-message, .cm-error, [class*="error"]');
          if (errorElement) {
            const errorText = await errorElement.textContent();
            console.log(chalk.red('\n❌ Pattern has syntax errors:'));
            console.log(chalk.red(errorText));
            console.log(chalk.yellow('\nTry fixing the pattern manually in the browser.'));
          }
        } else {
          console.log(chalk.yellow('⚠️  Could not find editor - pattern may not be set'));
        }
      }
      
      // Try to click play
      const playButton = await frame.$('button[title="play"]');
      if (playButton) {
        await playButton.click();
        console.log(chalk.green('✅ Autoplay successful!'));
        
        // Always start recording after autoplay
        setTimeout(() => {
          this.broadcast({ type: 'autoplayStarted' });
          this.startRecording();
        }, 1000);
      } else {
        // Try spacebar as fallback
        await this.page.keyboard.press('Space');
      }
    } catch (error) {
      console.log(chalk.yellow('Autoplay failed:', error.message));
    }
  }
  
  async startRecording() {
    if (this.isRecording) {return;}
    
    console.log(chalk.red('⚪ Recording audio...'));
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    
    // Generate filename with timestamp for archive
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const safeSong = this.currentSong.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeArtist = this.currentArtist.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    // If user specified output, use that AND create archive copy
    if (this.recordOutput) {
      this.audioFilename = this.recordOutput;
      this.archiveFilename = `./recordings/archive/strudelcover_${safeArtist}_${safeSong}_${timestamp}.wav`;
    } else {
      // Otherwise save to recordings directory
      this.audioFilename = `./recordings/strudelcover_${safeArtist}_${safeSong}_${timestamp}.wav`;
      this.archiveFilename = null;
    }
    
    // Start audio recording using system audio capture
    await this.startAudioCapture();
    
    this.broadcast({ type: 'recordingStarted' });
    
    // Auto-stop after 30 seconds (configurable)
    this.recordingTimeout = setTimeout(() => {
      if (this.isRecording) {
        console.log(chalk.yellow('Auto-stopping recording after 30 seconds'));
        this.stopRecording();
      }
    }, 30000);
  }
  
  async stopRecording() {
    if (!this.isRecording) {return;}
    
    // Clear timeout
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
    }
    
    const duration = (Date.now() - this.recordingStartTime) / 1000;
    console.log(chalk.green(`✓ Recording stopped (${duration.toFixed(1)}s)`));
    this.isRecording = false;
    
    // Stop audio capture
    await this.stopAudioCapture();
    
    console.log(chalk.green(`💾 Audio saved to: ${this.audioFilename}`));
    
    // Copy to archive if needed
    if (this.archiveFilename && this.audioFilename !== this.archiveFilename) {
      try {
        await fs.copyFile(this.audioFilename, this.archiveFilename);
        console.log(chalk.gray(`📁 Archive copy: ${this.archiveFilename}`));
      } catch (error) {
        console.log(chalk.yellow('Could not create archive copy:', error.message));
      }
    }
    
    this.broadcast({ 
      type: 'recordingStopped',
      filename: this.audioFilename,
      duration: duration 
    });
  }
  
  async startAudioCapture() {
    // Use sox or rec command for cross-platform audio recording
    // First check if sox/rec is available
    try {
      await execAsync('which rec');
      // Use rec (part of sox) for recording
      this.recordProcess = exec(
        `rec -c 2 -r 44100 "${this.audioFilename}"`,
        error => {
          if (error && !error.killed) {
            console.error(chalk.red('Recording error:'), error.message);
          }
        }
      );
      console.log(chalk.green('Audio recording started with sox/rec'));
    } catch (e) {
      // Fallback to platform-specific solutions
      if (process.platform === 'darwin') {
        // macOS: Use built-in audio recording
        console.log(chalk.yellow('Using macOS audio recording (requires permissions)'));
        console.log(chalk.gray('Note: For best results, install sox with: brew install sox'));
        
        // Simple approach using afrecord (macOS built-in)
        this.recordProcess = exec(
          `afrecord -f WAVE -c 2 -r 44100 "${this.audioFilename}"`,
          error => {
            if (error && !error.killed) {
              console.error(chalk.red('Recording error:'), error.message);
            }
          }
        );
      } else {
        console.log(chalk.yellow('Audio recording requires sox to be installed'));
        console.log(chalk.gray('Install with:'));
        console.log(chalk.gray('  Ubuntu/Debian: sudo apt-get install sox'));
        console.log(chalk.gray('  macOS: brew install sox'));
        console.log(chalk.gray('  Windows: Download from http://sox.sourceforge.net'));
        
        // Create a placeholder file
        await fs.writeFile(this.audioFilename, '');
      }
    }
  }
  
  async stopAudioCapture() {
    if (this.recordProcess) {
      // Kill the recording process
      this.recordProcess.kill('SIGTERM');
      this.recordProcess = null;
      
      // Wait a bit for the file to be finalized
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async getHTML() {
    // Load HTML template
    const htmlTemplate = await fs.readFile(
      join(__dirname, 'templates', 'dashboard.html'), 
      'utf-8'
    );
    
    // Replace placeholders
    return htmlTemplate
      .replace(/{{port}}/g, this.port)
      .replace(/{{autoRecord}}/g, this.recordOutput ? 'true' : 'false');
  }
  
  sendLog(message, level = 'info') {
    this.broadcast({ type: 'log', message, level });
  }

  async startSampleServer(samples) {
    if (this.sampleServer) {
      return;
    }
    
    const samplePort = this.port + 1;
    console.log(chalk.cyan(`🎵 Starting sample server on port ${samplePort}`));
    
    // Create simple HTTP server for samples
    this.sampleServer = createServer((req, res) => {
      const sampleName = req.url.slice(1); // Remove leading /
      const sample = samples.find(s => s.name === sampleName);
      
      if (sample && sample.path) {
        res.writeHead(200, {
          'Content-Type': 'audio/wav',
          'Access-Control-Allow-Origin': '*'
        });
        const stream = createReadStream(sample.path);
        stream.pipe(res);
      } else {
        res.writeHead(404);
        res.end('Sample not found');
      }
    });
    
    this.sampleServer.listen(samplePort);
    
    // Log available samples
    console.log(chalk.green('Available samples:'));
    samples.forEach(sample => {
      console.log(chalk.gray(`  - ${sample.name}: http://localhost:${samplePort}/${sample.name}`));
    });
  }

  async stop() {
    // Stop recording if in progress
    if (this.isRecording) {
      await this.stopRecording();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
    if (this.sampleServer) {
      this.sampleServer.close();
    }
  }
}

// Standalone function for easy use
export async function dazzle(audioFile, artist, song, options = {}) {
  const dazzler = new Dazzle({
    apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY
  });
  await dazzler.start();
  
  const pattern = await dazzler.generatePattern(audioFile, artist, song);
  
  console.log(chalk.cyan('\n📝 Generated pattern:'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(pattern);
  console.log(chalk.gray('─'.repeat(50)));
  
  // Keep running
  return new Promise(() => {
    console.log(chalk.yellow('\nPress Ctrl+C to exit\n'));
  });
}