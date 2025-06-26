#!/usr/bin/env python3
"""
ML-based comprehensive audio analysis for StrudelCover
Uses state-of-the-art models for music understanding
"""

import json
import sys
import argparse
from pathlib import Path
import warnings

warnings.filterwarnings("ignore")

import numpy as np
import torch
import torchaudio
import librosa
from tqdm import tqdm

# Import ML models
try:
    import demucs.api

    DEMUCS_AVAILABLE = True
except ImportError:
    DEMUCS_AVAILABLE = False
    print("Warning: Demucs not available for source separation")

try:
    from basic_pitch.inference import predict
    from basic_pitch import ICASSP_2022_MODEL_PATH

    BASIC_PITCH_AVAILABLE = True
except ImportError:
    BASIC_PITCH_AVAILABLE = False
    print("Warning: Basic-pitch not available for transcription")

try:
    from audiocraft.models import MusicGen

    MUSICGEN_AVAILABLE = True
except ImportError:
    MUSICGEN_AVAILABLE = False
    print("Warning: MusicGen not available for audio embeddings")

try:
    from transformers import Wav2Vec2Model, Wav2Vec2Processor

    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    print("Warning: Transformers not available for audio embeddings")


class MLAudioAnalyzer:
    def __init__(self, device="cpu"):
        self.device = device
        self.sample_rate = 44100

        # Load models lazily
        self.demucs_model = None
        self.basic_pitch_model = None
        self.wav2vec_model = None
        self.wav2vec_processor = None

    def analyze(self, audio_path, output_path=None):
        """Comprehensive ML-based audio analysis"""
        audio_path = Path(audio_path)
        if output_path is None:
            output_path = audio_path.with_suffix(".ml_analysis.json")

        print(f"🎵 ML Audio Analysis: {audio_path}")
        print("=" * 50)

        # Load audio
        print("📊 Loading audio...")
        waveform, sr = librosa.load(audio_path, sr=self.sample_rate, mono=False)
        if len(waveform.shape) == 1:
            waveform = waveform[np.newaxis, :]
        duration = waveform.shape[-1] / sr

        results = {
            "file_info": {
                "path": str(audio_path),
                "duration": duration,
                "sample_rate": sr,
                "channels": waveform.shape[0],
            }
        }

        # 1. Source Separation
        if DEMUCS_AVAILABLE:
            print("\n🎸 Source Separation with Demucs...")
            stems = self._separate_sources(audio_path)
            results["stems"] = stems

        # 2. Multi-track Transcription
        if BASIC_PITCH_AVAILABLE:
            print("\n🎹 Polyphonic Transcription with Basic Pitch...")
            transcription = self._transcribe_to_midi(audio_path)
            results["transcription"] = transcription

        # 3. Advanced Features with Librosa
        print("\n📈 Extracting Advanced Features...")
        features = self._extract_features(waveform[0], sr)
        results["features"] = features

        # 4. Structure Analysis
        print("\n🏗️ Analyzing Song Structure...")
        structure = self._analyze_structure(waveform[0], sr)
        results["structure"] = structure

        # 5. Audio Embeddings
        if TRANSFORMERS_AVAILABLE:
            print("\n🧠 Generating Audio Embeddings...")
            embeddings = self._get_embeddings(waveform[0], sr)
            results["embeddings_shape"] = embeddings.shape

        # 6. Pattern Extraction
        print("\n🎼 Extracting Musical Patterns...")
        patterns = self._extract_patterns(
            waveform[0], sr, results.get("transcription", {})
        )
        results["patterns"] = patterns

        # Save results
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2, default=str)

        print(f"\n✅ Analysis complete! Saved to: {output_path}")
        self._print_summary(results)

        return results

    def _separate_sources(self, audio_path):
        """Separate audio into stems using Demucs"""
        if self.demucs_model is None:
            print("  Loading Demucs model...")
            self.demucs_model = demucs.api.Separator(model="htdemucs")

        # Process audio
        print("  Separating sources...")
        origin, separated = self.demucs_model.separate_audio_file(audio_path)

        stems_info = {}
        stem_dir = audio_path.parent / f"{audio_path.stem}_stems"
        stem_dir.mkdir(exist_ok=True)

        for stem, audio in separated.items():
            stem_path = stem_dir / f"{stem}.wav"
            demucs.api.save_audio(
                audio, stem_path, samplerate=self.demucs_model.samplerate
            )

            # Analyze each stem
            stem_audio = audio.mean(0).numpy()  # Convert to mono numpy
            stem_features = self._analyze_stem(
                stem_audio, self.demucs_model.samplerate, stem
            )

            stems_info[stem] = {"path": str(stem_path), "features": stem_features}

        return stems_info

    def _analyze_stem(self, audio, sr, stem_type):
        """Analyze individual stem characteristics"""
        features = {}

        # RMS energy
        features["rms_mean"] = float(np.sqrt(np.mean(audio**2)))

        # Spectral features
        spectral_centroids = librosa.feature.spectral_centroid(y=audio, sr=sr)[0]
        features["spectral_centroid_mean"] = float(np.mean(spectral_centroids))

        # Onset density
        onset_frames = librosa.onset.onset_detect(y=audio, sr=sr)
        features["onset_density"] = len(onset_frames) / (len(audio) / sr)

        # Specific features per stem
        if stem_type == "drums":
            # Tempo from drums
            tempo, beats = librosa.beat.beat_track(y=audio, sr=sr)
            features["tempo"] = float(tempo)
            features["beat_count"] = len(beats)

        elif stem_type == "bass":
            # Pitch tracking for bass
            pitches, magnitudes = librosa.piptrack(y=audio, sr=sr)
            features["has_pitched_content"] = bool(np.any(magnitudes > 0.1))

        return features

    def _transcribe_to_midi(self, audio_path):
        """Transcribe audio to MIDI using Basic Pitch"""
        # Run inference
        model_output, midi_data, note_events = predict(
            str(audio_path), model_path=ICASSP_2022_MODEL_PATH
        )

        # Save MIDI
        midi_path = audio_path.with_suffix(".transcribed.mid")
        midi_data.write(str(midi_path))

        # Extract pattern info
        transcription = {
            "midi_path": str(midi_path),
            "note_count": len(note_events),
            "pitch_range": {
                "min": min(n[0] for n in note_events) if note_events else 0,
                "max": max(n[0] for n in note_events) if note_events else 0,
            },
            "notes": [],
        }

        # Add first 50 notes for pattern analysis
        for i, (pitch, start, end, velocity) in enumerate(note_events[:50]):
            transcription["notes"].append(
                {
                    "pitch": int(pitch),
                    "start": float(start),
                    "duration": float(end - start),
                    "velocity": float(velocity),
                }
            )

        return transcription

    def _extract_features(self, audio, sr):
        """Extract comprehensive audio features"""
        features = {}

        # Tempo and beat tracking
        print("  - Tempo and beat tracking...")
        tempo, beats = librosa.beat.beat_track(y=audio, sr=sr)
        features["tempo"] = float(tempo)
        features["beats"] = {
            "count": len(beats),
            "positions": beats[:20].tolist(),  # First 20 beats
        }

        # Harmonic features
        print("  - Harmonic analysis...")
        chroma = librosa.feature.chroma_cqt(y=audio, sr=sr)
        features["chroma"] = {
            "mean": chroma.mean(axis=1).tolist(),
            "std": chroma.std(axis=1).tolist(),
        }

        # Key detection
        chroma_mean = chroma.mean(axis=1)
        key_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        estimated_key = key_names[np.argmax(chroma_mean)]
        features["estimated_key"] = estimated_key

        # Timbre features
        print("  - Timbre analysis...")
        mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=13)
        features["mfcc"] = {
            "mean": mfcc.mean(axis=1).tolist(),
            "std": mfcc.std(axis=1).tolist(),
        }

        # Dynamic features
        print("  - Dynamic analysis...")
        rms = librosa.feature.rms(y=audio)[0]
        features["dynamics"] = {
            "rms_mean": float(np.mean(rms)),
            "rms_std": float(np.std(rms)),
            "dynamic_range_db": float(
                20 * np.log10(np.max(rms) / (np.min(rms) + 1e-10))
            ),
        }

        return features

    def _analyze_structure(self, audio, sr):
        """Analyze song structure using self-similarity and novelty"""
        print("  - Computing self-similarity matrix...")

        # Compute features for structure
        hop_length = 512
        chroma = librosa.feature.chroma_cqt(y=audio, sr=sr, hop_length=hop_length)
        mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=13, hop_length=hop_length)

        # Stack features
        features = np.vstack([chroma, mfcc])

        # Self-similarity
        sim_matrix = librosa.segment.recurrence_matrix(features, mode="affinity")

        # Novelty curve
        novelty = np.sum(np.diff(sim_matrix, axis=1), axis=0)
        novelty = np.pad(novelty, (1, 0), mode="constant")

        # Peak picking for boundaries
        peaks = librosa.util.peak_pick(
            novelty,
            pre_max=10,
            post_max=10,
            pre_avg=10,
            post_avg=10,
            delta=0.1,
            wait=10,
        )

        # Convert to time
        boundaries_time = librosa.frames_to_time(peaks, sr=sr, hop_length=hop_length)

        # Create sections
        sections = []
        section_names = [
            "intro",
            "verse1",
            "chorus1",
            "verse2",
            "chorus2",
            "bridge",
            "chorus3",
            "outro",
        ]

        for i in range(len(boundaries_time) - 1):
            if i < len(section_names):
                sections.append(
                    {
                        "name": section_names[i],
                        "start": float(boundaries_time[i]),
                        "end": float(boundaries_time[i + 1]),
                        "duration": float(boundaries_time[i + 1] - boundaries_time[i]),
                    }
                )

        # Add final section
        if len(boundaries_time) > 0 and len(sections) < len(section_names):
            sections.append(
                {
                    "name": section_names[len(sections)],
                    "start": float(boundaries_time[-1]),
                    "end": float(len(audio) / sr),
                    "duration": float(len(audio) / sr - boundaries_time[-1]),
                }
            )

        return {
            "boundaries": boundaries_time.tolist(),
            "sections": sections,
            "novelty_peaks": len(peaks),
        }

    def _get_embeddings(self, audio, sr):
        """Get audio embeddings using Wav2Vec2"""
        if self.wav2vec_model is None:
            print("  Loading Wav2Vec2 model...")
            self.wav2vec_processor = Wav2Vec2Processor.from_pretrained(
                "facebook/wav2vec2-base"
            )
            self.wav2vec_model = Wav2Vec2Model.from_pretrained("facebook/wav2vec2-base")
            self.wav2vec_model.to(self.device)
            self.wav2vec_model.eval()

        # Process in chunks
        chunk_size = sr * 10  # 10 second chunks
        embeddings = []

        for i in range(0, len(audio), chunk_size):
            chunk = audio[i : i + chunk_size]

            # Process
            inputs = self.wav2vec_processor(
                chunk, sampling_rate=sr, return_tensors="pt", padding=True
            )

            with torch.no_grad():
                outputs = self.wav2vec_model(**inputs.to(self.device))
                # Average pool over time
                embedding = outputs.last_hidden_state.mean(dim=1)
                embeddings.append(embedding.cpu().numpy())

        return np.vstack(embeddings)

    def _extract_patterns(self, audio, sr, transcription):
        """Extract musical patterns and motifs"""
        patterns = {}

        # Rhythmic patterns from onsets
        print("  - Extracting rhythmic patterns...")
        onset_env = librosa.onset.onset_strength(y=audio, sr=sr)
        tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)

        # Get inter-onset intervals
        onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
        onset_times = librosa.frames_to_time(onset_frames, sr=sr)

        if len(onset_times) > 1:
            ioi = np.diff(onset_times)
            patterns["rhythmic"] = {
                "common_intervals": np.round(
                    np.bincount(np.round(ioi * 10).astype(int)).argsort()[-5:] / 10, 3
                ).tolist(),
                "tempo_stability": float(np.std(ioi)),
            }

        # Melodic patterns from transcription
        if transcription and transcription.get("notes"):
            print("  - Extracting melodic patterns...")
            notes = transcription["notes"]

            # Pitch intervals
            if len(notes) > 1:
                intervals = [
                    notes[i + 1]["pitch"] - notes[i]["pitch"]
                    for i in range(len(notes) - 1)
                ]
                patterns["melodic"] = {
                    "common_intervals": list(set(intervals))[:10],
                    "interval_variety": len(set(intervals)),
                    "pitch_range": transcription["pitch_range"],
                }

        # Harmonic patterns
        print("  - Extracting harmonic patterns...")
        chroma = librosa.feature.chroma_cqt(y=audio, sr=sr)

        # Simple chord detection
        chord_frames = []
        for i in range(0, chroma.shape[1], 22050 // 512):  # ~0.5 second windows
            if i + 10 < chroma.shape[1]:
                chord = chroma[:, i : i + 10].mean(axis=1)
                chord_frames.append(np.argmax(chord))

        if chord_frames:
            patterns["harmonic"] = {
                "common_chords": list(set(chord_frames))[:8],
                "chord_changes": len(
                    [
                        i
                        for i in range(1, len(chord_frames))
                        if chord_frames[i] != chord_frames[i - 1]
                    ]
                ),
            }

        return patterns

    def _print_summary(self, results):
        """Print analysis summary"""
        print("\n📊 Analysis Summary:")
        print("=" * 50)

        # File info
        info = results["file_info"]
        print(f"Duration: {info['duration']:.1f}s")

        # Stems
        if "stems" in results:
            print(f"\nSource Separation:")
            for stem, data in results["stems"].items():
                features = data["features"]
                print(
                    f"  {stem}: tempo={features.get('tempo', 'N/A')}, "
                    f"energy={features['rms_mean']:.3f}"
                )

        # Transcription
        if "transcription" in results:
            trans = results["transcription"]
            print(f"\nTranscription:")
            print(f"  Notes: {trans['note_count']}")
            print(
                f"  Range: {trans['pitch_range']['min']}-{trans['pitch_range']['max']}"
            )

        # Features
        if "features" in results:
            feat = results["features"]
            print(f"\nMusical Features:")
            print(f"  Tempo: {feat['tempo']:.1f} BPM")
            print(f"  Key: {feat['estimated_key']}")
            print(f"  Dynamic Range: {feat['dynamics']['dynamic_range_db']:.1f} dB")

        # Structure
        if "structure" in results:
            struct = results["structure"]
            print(f"\nStructure:")
            print(f"  Sections: {len(struct['sections'])}")
            for section in struct["sections"][:5]:
                print(
                    f"    {section['name']}: {section['start']:.1f}s - {section['end']:.1f}s"
                )


def main():
    parser = argparse.ArgumentParser(
        description="ML-based audio analysis for StrudelCover"
    )
    parser.add_argument("audio_file", help="Path to audio file")
    parser.add_argument("-o", "--output", help="Output JSON file")
    parser.add_argument(
        "--device",
        default="cpu",
        choices=["cpu", "cuda", "mps"],
        help="Device for ML inference",
    )

    args = parser.parse_args()

    # Check if file exists
    if not Path(args.audio_file).exists():
        print(f"Error: Audio file not found: {args.audio_file}")
        sys.exit(1)

    # Run analysis
    analyzer = MLAudioAnalyzer(device=args.device)
    analyzer.analyze(args.audio_file, args.output)


if __name__ == "__main__":
    main()
