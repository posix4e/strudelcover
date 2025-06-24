import chalk from 'chalk';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

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
    this.audioContext = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordOutput = options.recordOutput;
  }

  async start() {
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

    // Load prompt template
    const promptTemplate = await fs.readFile(
      join(__dirname, 'templates', 'pattern-prompt.txt'), 
      'utf-8'
    );
    
    // Replace placeholders
    const prompt = promptTemplate
      .replace(/{{song}}/g, song)
      .replace(/{{artist}}/g, artist);

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
        model: 'claude-3-opus-20240229',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      });
      
      const endTime = Date.now();
      console.log(chalk.gray(`\nClaude response time: ${(endTime - startTime) / 1000}s`));
      
      // Show the full response from Claude
      console.log(chalk.green('\n📥 Claude\'s full response:'));
      console.log(chalk.gray('─'.repeat(70)));
      console.log(chalk.dim(response.content[0].text));
      console.log(chalk.gray('─'.repeat(70)));

      // Extract code from response
      this.pattern = this.extractCode(response.content[0].text);
    } catch (error) {
      console.error(chalk.red('Claude Error:'), error.message);
      // Fallback to a simple pattern
      console.log(chalk.yellow('Falling back to fallback pattern...'));
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

  async autoplay() {
    if (!this.page) {return;}
    
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
    if (this.isRecording) {return;}
    
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
    if (!this.isRecording) {return;}
    
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