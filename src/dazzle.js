import chalk from 'chalk';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { chromium } from 'playwright';
import { LLMProviderFactory } from './llm/index.js';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SimpleDazzle {
  constructor(options = {}) {
    this.llmProvider = options.llmProvider;
    this.port = options.port || 8888;
    this.server = null;
    this.wss = null;
    this.browser = null;
    this.page = null;
    this.pattern = null;
    this.isRecording = false;
    this.audioContext = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordOutput = options.recordOutput;
  }

  async start() {
    // Initialize LLM if needed
    if (!this.llmProvider) {
      throw new Error('LLM provider required');
    }

    // Create recordings directory if needed
    if (this.recordOutput) {
      await fs.mkdir('./recordings', { recursive: true });
    }

    // Start web server
    await this.startServer();
    
    // Launch browser
    await this.launchBrowser();
  }

  async startServer() {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        if (req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getHTML());
        }
      });

      this.wss = new WebSocketServer({ server: this.server });
      
      this.wss.on('connection', (ws) => {
        // Send current pattern if we have one
        if (this.pattern) {
          ws.send(JSON.stringify({
            type: 'pattern',
            data: this.pattern
          }));
        }

        ws.on('message', (message) => {
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
      
      // Set up video recording if output specified
      const contextOptions = {};
      if (this.recordOutput) {
        contextOptions.recordVideo = {
          dir: './recordings',
          size: { width: 1280, height: 720 }
        };
      }
      
      const context = await this.browser.newContext(contextOptions);
      this.page = await context.newPage();
      await this.page.goto(`http://localhost:${this.port}`);
    } catch (error) {
      console.log(chalk.yellow('Could not launch browser:', error.message));
      console.log(chalk.gray('You may need to run: npx playwright install chromium'));
      console.log(chalk.gray('Dashboard will still be accessible at http://localhost:8888'));
    }
  }

  async generatePattern(audioFile, artist, song) {
    console.log(chalk.blue(`\n🎵 Generating pattern for "${song}" by ${artist}\n`));

    // Enhanced prompt with musical context
    const debugSimplePrompt = false; // Set to true for debugging
    const prompt = debugSimplePrompt ? 
      `Create a simple Strudel pattern for "${song}" by ${artist}". Just a basic beat. Return only code.` :
      `Create a complete, professional Strudel pattern for "${song}" by ${artist}".

SONG STRUCTURE AND ARRANGEMENT:
- Analyze the original song's structure (intro, verse, chorus, bridge, outro)
- Include ALL sections with appropriate transitions
- Each section should have distinct characteristics
- Use proper song dynamics (quiet verses, energetic choruses, etc.)

MUSICAL ELEMENTS TO INCLUDE:
1. DRUMS: Full drum kit patterns (kick, snare, hihat, crash, ride, toms)
   - Vary patterns between sections
   - Include fills at transitions
   - Use velocity/gain for dynamics

2. BASS: Melodic basslines that follow the chord progression
   - Use note() with actual notes, not just "bass" sound
   - Include rhythmic variations

3. HARMONY: Full chord progressions
   - Use voicings() or chord() for rich harmonies
   - Include chord inversions where appropriate
   - Add pad/synth layers for atmosphere

4. MELODY: Main melodic elements
   - Lead synth or instrument for main melody
   - Counter-melodies and harmonies
   - Solo sections if applicable

5. PERCUSSION & FX: Additional elements
   - Shakers, tambourines, claps
   - Sweeps, risers for transitions
   - Ambient textures

TECHNICAL REQUIREMENTS:
- Use setcps() to set the correct tempo
- Structure: Use cat() to sequence sections properly
- Layer with stack() within each section
- Use .gain() for mixing levels
- Include .pan() for stereo width
- Add .room() or .delay() for space
- Use .cutoff() and .resonance() for filter sweeps
- Apply .shape() or .distort() for character
- Length: Aim for 100-200 lines for a complete song

FORMAT:
// Song: ${song} by ${artist}
// Tempo: [actual BPM]
// Key: [actual key]
// Structure: [list sections]

setcps([tempo]/60/4)

// [Section name]
let sectionName = stack(
  // drums
  // bass
  // chords
  // melody
  // fx
)

// Arrangement
cat(
  sectionName.slow(16), // intro
  // ... rest of arrangement
)

Return ONLY the Strudel code, no other text.`;

    console.log(chalk.yellow('🤖 Asking LLM to generate pattern...'));
    console.log(chalk.gray(`Prompt length: ${prompt.length} characters`));
    
    const startTime = Date.now();
    try {
      const response = await this.llmProvider.generateCompletion([
        { role: 'user', content: prompt }
      ]);
      const endTime = Date.now();
      console.log(chalk.gray(`LLM response time: ${(endTime - startTime) / 1000}s`));

      // Extract code from response
      this.pattern = this.extractCode(response);
    } catch (error) {
      console.error(chalk.red('LLM Error:'), error.message);
      // Fallback to a simple pattern
      console.log(chalk.yellow('Falling back to simple pattern...'));
      this.pattern = this.getFallbackPattern(song, artist);
    }
    
    console.log(chalk.green('✓ Pattern generated'));
    console.log(chalk.cyan('\n📝 Generated pattern:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(this.pattern);
    console.log(chalk.gray('─'.repeat(50)));
    
    // Send to dashboard
    this.broadcast({ type: 'pattern', data: this.pattern });
    
    // Wait a bit then try autoplay
    setTimeout(() => this.autoplay(), 3000);
    
    // If record output specified, notify user
    if (this.recordOutput) {
      console.log(chalk.yellow(`\n📼 Will record to: ${this.recordOutput}`));
      console.log(chalk.gray('Recording will start automatically after playback begins'));
    }
    
    return this.pattern;
  }

  extractCode(response) {
    // Try to find code block
    const codeMatch = response.match(/```(?:javascript|js|strudel)?\n([\s\S]*?)```/);
    if (codeMatch) {
      return codeMatch[1].trim();
    }
    
    // Otherwise assume the whole response is code
    return response.trim();
  }
  
  getFallbackPattern(song, artist) {
    return `// Fallback pattern for ${song} by ${artist}
setcps(120/60/4)

stack(
  sound("bd*4"),
  sound("hh*8"),
  sound("sd ~ sd"),
  note("c3 eb3 g3 c4").sound("piano").slow(4)
)`
  }

  broadcast(message) {
    if (!this.wss) return;
    
    const data = JSON.stringify(message);
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  }

  async autoplay() {
    if (!this.page) return;
    
    console.log(chalk.yellow('🎵 Attempting autoplay...'));
    
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
      
      // Try to click play
      const playButton = await frame.$('button[title="play"]');
      if (playButton) {
        await playButton.click();
        console.log(chalk.green('✅ Autoplay successful!'));
        
        // Start recording after autoplay
        setTimeout(() => {
          this.broadcast({ type: 'autoplayStarted' });
          if (this.recordOutput) {
            this.startRecording();
          }
        }, 1000);
      } else {
        // Try spacebar as fallback
        await frame.press('body', 'Space');
      }
    } catch (error) {
      console.log(chalk.yellow('Autoplay failed:', error.message));
    }
  }
  
  async startRecording() {
    if (this.isRecording) return;
    
    console.log(chalk.red('⚪ Recording started...'));
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    this.broadcast({ type: 'recordingStarted' });
    
    // Auto-stop after 10 seconds for testing
    setTimeout(() => {
      if (this.isRecording) {
        this.stopRecording();
      }
    }, 10000);
  }
  
  async stopRecording() {
    if (!this.isRecording) return;
    
    const duration = (Date.now() - this.recordingStartTime) / 1000;
    console.log(chalk.green(`✓ Recording stopped (${duration.toFixed(1)}s)`));
    this.isRecording = false;
    this.broadcast({ type: 'recordingStopped' });
    
    // Close the page to save the video
    if (this.page) {
      await this.page.close();
      
      // Wait for video to be saved
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Find the recorded video
      try {
        const files = await fs.readdir('./recordings');
        const videoFile = files.find(f => f.endsWith('.webm'));
        
        if (videoFile) {
          const videoPath = `./recordings/${videoFile}`;
          console.log(chalk.blue('🎥 Converting video to audio...'));
          
          // Extract audio using ffmpeg
          try {
            // Try to find ffmpeg in common locations
            let ffmpegPath = 'ffmpeg';
            const possiblePaths = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'];
            for (const path of possiblePaths) {
              try {
                await fs.access(path);
                ffmpegPath = path;
                break;
              } catch (e) {
                // Continue to next path
              }
            }
            
            await execAsync(`${ffmpegPath} -i "${videoPath}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "${this.recordOutput}" -y`);
            console.log(chalk.green(`💾 Audio saved to: ${this.recordOutput}`));
            
            // Clean up video file
            await fs.unlink(videoPath);
          } catch (ffmpegError) {
            if (ffmpegError.message.includes('does not contain any stream')) {
              console.log(chalk.yellow('Note: Playwright video recording captures visuals only, not audio.'));
              console.log(chalk.yellow('For audio recording, consider using system audio capture tools.'));
              console.log(chalk.gray('Video (visual only) saved at:', videoPath));
            } else {
              console.log(chalk.yellow('FFmpeg error:', ffmpegError.message));
              console.log(chalk.gray('Video saved at:', videoPath));
            }
          }
        }
      } catch (error) {
        console.error(chalk.red('Error processing recording:'), error.message);
      }
    }
  }

  getHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dazzle</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #0a0a0a;
      color: #0ff;
      font-family: monospace;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    
    h1 {
      margin: 0 0 10px 0;
      text-align: center;
    }
    
    #controls {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      justify-content: center;
    }
    
    button {
      background: #0ff;
      color: #000;
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      font-family: monospace;
      font-weight: bold;
      transition: all 0.2s;
    }
    
    button:hover {
      background: #fff;
      box-shadow: 0 0 10px #0ff;
    }
    
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    #status {
      margin-bottom: 10px;
      padding: 10px;
      border: 1px solid #0ff;
      background: rgba(0,255,255,0.1);
      text-align: center;
    }
    
    #visualizer {
      height: 100px;
      margin-bottom: 10px;
      border: 1px solid #0ff;
      background: rgba(0,255,255,0.05);
      position: relative;
      overflow: hidden;
    }
    
    canvas {
      width: 100%;
      height: 100%;
    }
    
    #strudel-container {
      flex: 1;
      border: 2px solid #0ff;
      background: #000;
    }
    
    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    
    .recording {
      animation: pulse 1s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <h1>🌟 DAZZLE</h1>
  <div id="controls">
    <button id="recordBtn" disabled>Start Recording</button>
    <button id="downloadBtn" disabled>Download Recording</button>
  </div>
  <div id="status">Waiting for pattern...</div>
  <div id="visualizer">
    <canvas id="canvas"></canvas>
  </div>
  <div id="strudel-container">
    <iframe id="strudel" src="https://strudel.cc"></iframe>
  </div>
  
  <script>
    const ws = new WebSocket('ws://localhost:${this.port}');
    const status = document.getElementById('status');
    const iframe = document.getElementById('strudel');
    const recordBtn = document.getElementById('recordBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    let isRecording = false;
    let animationId = null;
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Audio visualization
    function drawVisualizer() {
      ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw waveform
      ctx.strokeStyle = '#0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const time = Date.now() / 1000;
      for (let x = 0; x < canvas.width; x += 2) {
        const t = x / canvas.width;
        const y = canvas.height / 2 + Math.sin(t * 10 + time * 5) * 30 * Math.sin(time * 2);
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
      
      // Draw frequency bars
      const barWidth = canvas.width / 64;
      for (let i = 0; i < 64; i++) {
        const height = Math.abs(Math.sin(i * 0.3 + time * 3)) * canvas.height * 0.8;
        const x = i * barWidth;
        const y = canvas.height - height;
        
        ctx.fillStyle = \`hsl(\${180 + i * 2}, 100%, 50%)\`;
        ctx.fillRect(x, y, barWidth - 1, height);
      }
      
      animationId = requestAnimationFrame(drawVisualizer);
    }
    
    // Start visualizer
    drawVisualizer();
    
    // Record button handler
    recordBtn.addEventListener('click', () => {
      if (!isRecording) {
        ws.send(JSON.stringify({ type: 'startRecording' }));
        recordBtn.textContent = 'Stop Recording';
        recordBtn.classList.add('recording');
        isRecording = true;
      } else {
        ws.send(JSON.stringify({ type: 'stopRecording' }));
        recordBtn.textContent = 'Start Recording';
        recordBtn.classList.remove('recording');
        isRecording = false;
      }
    });
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'ready' }));
      status.textContent = 'Connected - waiting for pattern...';
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'pattern') {
        status.textContent = 'Pattern received - loading in Strudel...';
        
        // Wait for Strudel to load
        iframe.addEventListener('load', () => {
          setTimeout(() => {
            // Try to set the pattern in Strudel
            try {
              const strudelWindow = iframe.contentWindow;
              if (strudelWindow && strudelWindow.setCode) {
                strudelWindow.setCode(message.data);
                status.textContent = 'Pattern loaded - click play to hear it!';
              }
            } catch (e) {
              // Cross-origin restrictions, but pattern might still work
              console.log('Could not directly set code:', e);
              status.innerHTML = 'Pattern ready - paste this in Strudel:<br><pre>' + 
                message.data.substring(0, 100) + '...</pre>';
            }
          }, 2000);
        });
      } else if (message.type === 'autoplayStarted') {
        recordBtn.disabled = false;
        status.textContent = 'Playing! Click record to capture the output.';
        
        // Auto-start recording if specified via CLI
        if (${this.recordOutput ? 'true' : 'false'}) {
          setTimeout(() => {
            recordBtn.click();
          }, 500);
        }
      } else if (message.type === 'recordingStarted') {
        status.textContent = 'Recording...';
      } else if (message.type === 'recordingStopped') {
        status.textContent = 'Recording complete!';
        downloadBtn.disabled = false;
      }
    };
    
    ws.onerror = () => {
      status.textContent = 'Connection error';
    };
  </script>
</body>
</html>`;
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
  }
}

// Standalone function for easy use
export async function dazzle(audioFile, artist, song, options = {}) {
  // Initialize LLM provider
  const provider = options.provider || 'anthropic';
  const llmProvider = await LLMProviderFactory.create(
    provider,
    {
      apiKey: options.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`],
      model: options.model || (provider === 'anthropic' ? 'claude-3-opus-20240229' : 'gpt-4')
    }
  );

  const dazzler = new SimpleDazzle({ llmProvider });
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