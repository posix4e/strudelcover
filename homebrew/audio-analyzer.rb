class AudioAnalyzer < Formula
  desc "Audio analysis tool for extracting BPM, structure, and musical features"
  homepage "https://github.com/posix4e/strudelcover"
  url "https://github.com/posix4e/strudelcover/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"

  depends_on "node"
  depends_on "ffmpeg"
  
  # Optional dependencies for better analysis
  depends_on "aubio" => :optional
  depends_on "essentia" => :optional
  depends_on "python@3.11" => :optional

  def install
    system "npm", "install", "--production"
    
    # Create wrapper script
    (bin/"analyze-audio").write <<~EOS
      #!/bin/bash
      exec node "#{libexec}/src/analyze-audio.js" "$@"
    EOS
    
    # Install files
    libexec.install Dir["src/*", "package.json", "node_modules"]
    
    # Install Python requirements if Python is available
    if build.with? "python@3.11"
      system "pip3", "install", "librosa", "numpy", "scipy"
    end
  end

  def caveats
    <<~EOS
      audio-analyzer has been installed!
      
      Basic usage:
        analyze-audio song.mp3
        
      This will create song.mp3.analysis.json with BPM and structure data.
      
      For better analysis, install optional dependencies:
        brew install aubio          # Better BPM detection
        brew install essentia       # Advanced music analysis
        pip3 install librosa       # Python-based analysis
        
      Then use:
        analyze-audio --aubio song.mp3
        analyze-audio --essentia song.mp3
        analyze-audio --librosa song.mp3
    EOS
  end

  test do
    system "#{bin}/analyze-audio", "--version"
  end
end