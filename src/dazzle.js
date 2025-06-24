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
    this.lastError = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.currentArtist = null;
    this.currentSong = null;
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
            
            // First try to fix by removing last )
            if (text.includes('Unexpected token') && this.pattern && this.pattern.trim().endsWith(')')) {
              console.log(chalk.yellow('\n🔧 Trying to fix by removing trailing )...'));
              
              // Try to fix it in the editor
              this.tryRemoveTrailingParen();
            } else if (this.retryCount < this.maxRetries && this.currentArtist && this.currentSong) {
              // Otherwise retry with error feedback
              console.log(chalk.yellow(`\n🔄 Retrying with error feedback (attempt ${this.retryCount + 1}/${this.maxRetries})...`));
              setTimeout(() => {
                this.retryWithErrorFeedback();
              }, 2000);
            }
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
    
    // Reset retry count if this is a new request (not a retry)
    if (!errorFeedback) {
      this.retryCount = 0;
    }

    // Load prompt template
    const promptTemplate = await fs.readFile(
      join(__dirname, 'templates', 'pattern-prompt.txt'), 
      'utf-8'
    );
    
    // Replace placeholders
    let prompt = promptTemplate
      .replace(/{{song}}/g, song)
      .replace(/{{artist}}/g, artist);
    
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
      this.pattern = this.extractCode(response.content[0].text);
      
      // Skip validation for now to debug issues
      // console.log(chalk.yellow('\n🔍 Validating pattern...'));
      // this.pattern = await this.validatePattern(this.pattern);
      
    } catch (error) {
      console.error(chalk.red('Claude Error:'), error.message);
      // Fallback to a simple pattern
      console.log(chalk.yellow('Falling back to fallback pattern...'));
      this.pattern = this.getFallbackPattern(song, artist);
    }
    
    console.log(chalk.green('✓ Pattern generated'));
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
    console.log(chalk.blue('\n🔍 Pattern details for comparison:'));
    console.log(chalk.gray(`- Total length: ${this.pattern.length} characters`));
    console.log(chalk.gray(`- First 100 chars: "${this.pattern.slice(0, 100)}..."`));
    console.log(chalk.gray(`- Last 100 chars: "...${this.pattern.slice(-100)}"`));
    
    // Wait a bit then try autoplay
    setTimeout(() => this.autoplay(), 3000);
    
    // If record output specified, notify user
    if (this.recordOutput) {
      console.log(chalk.yellow(`\n📼 Will record to: ${this.recordOutput}`));
      console.log(chalk.gray('Recording will start automatically after playback begins'));
    }
    
    return this.pattern;
  }
  
  async retryWithErrorFeedback() {
    this.retryCount++;
    
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
          
          // Start recording after autoplay
          setTimeout(() => {
            this.broadcast({ type: 'autoplayStarted' });
            if (this.recordOutput) {
              this.startRecording();
            }
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
          console.log(chalk.gray(`Pattern length: ${this.pattern.length} characters`));
          console.log(chalk.gray(`Pattern ends with: "${this.pattern.slice(-50)}"`));
          
          // Clean the pattern to ensure no weird line ending issues
          const cleanPattern = this.pattern.trim();
          console.log(chalk.gray(`Clean pattern length: ${cleanPattern.length} characters`));
          
          await this.page.keyboard.type(cleanPattern);
          console.log(chalk.green('✅ Pattern set in editor!'));
          
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
        
        // Start recording after autoplay
        setTimeout(() => {
          this.broadcast({ type: 'autoplayStarted' });
          if (this.recordOutput) {
            this.startRecording();
          }
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