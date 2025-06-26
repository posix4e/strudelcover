import json
import sys
import os
import warnings

warnings.filterwarnings("ignore")

audio_file = sys.argv[1]
output_file = sys.argv[2]

print("🎵 Fancy analysis starting...", file=sys.stderr)

results = {"audio_file": audio_file, "fancy_mode": True, "analyses": {}}

# 1. Try source separation
try:
    import demucs.api

    print("🎸 Separating sources with Demucs...", file=sys.stderr)

    separator = demucs.api.Separator(model="htdemucs_ft")
    origin, separated = separator.separate_audio_file(audio_file)

    stems_dir = audio_file.replace(".mp3", "_stems")
    os.makedirs(stems_dir, exist_ok=True)

    stems = {}
    for stem_name, audio in separated.items():
        stem_path = os.path.join(stems_dir, f"{stem_name}.wav")
        demucs.api.save_audio(audio, stem_path, separator.samplerate)
        stems[stem_name] = stem_path
        print(f"  ✓ {stem_name} saved", file=sys.stderr)

    results["analyses"]["source_separation"] = {
        "success": True,
        "stems": stems,
        "model": "htdemucs_ft",
    }
except Exception as e:
    print(f"  ✗ Source separation failed: {e}", file=sys.stderr)
    results["analyses"]["source_separation"] = {"success": False, "error": str(e)}

# 2. Try MIDI transcription
try:
    from basic_pitch.inference import predict
    from basic_pitch import ICASSP_2022_MODEL_PATH

    print("🎹 Transcribing to MIDI with Basic Pitch...", file=sys.stderr)

    model_output, midi_data, note_events = predict(audio_file)
    midi_path = audio_file.replace(".mp3", ".mid")
    midi_data.write(midi_path)

    results["analyses"]["transcription"] = {
        "success": True,
        "midi_file": midi_path,
        "note_count": len(note_events),
        "first_notes": [
            {"pitch": int(n[0]), "start": float(n[1]), "duration": float(n[2] - n[1])}
            for n in note_events[:10]
        ],
    }
    print(f"  ✓ Transcribed {len(note_events)} notes", file=sys.stderr)
except Exception as e:
    print(f"  ✗ MIDI transcription failed: {e}", file=sys.stderr)
    results["analyses"]["transcription"] = {"success": False, "error": str(e)}

# 3. Advanced audio features
try:
    import librosa
    import numpy as np

    print("📊 Extracting advanced features...", file=sys.stderr)

    y, sr = librosa.load(audio_file)

    # Detailed tempo analysis
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)

    # Harmonic analysis
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key_strengths = chroma.mean(axis=1)
    estimated_key = int(np.argmax(key_strengths))

    # Structure detection
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    bounds = librosa.segment.agglomerative(mfcc, k=8)
    bound_times = librosa.frames_to_time(bounds, sr=sr)

    results["analyses"]["advanced_features"] = {
        "success": True,
        "tempo": float(tempo),
        "estimated_key": estimated_key,
        "key_confidence": float(key_strengths[estimated_key]),
        "section_boundaries": bound_times.tolist(),
        "section_count": len(bounds),
    }
    print(f"  ✓ Detected {len(bounds)} sections", file=sys.stderr)
except Exception as e:
    print(f"  ✗ Advanced features failed: {e}", file=sys.stderr)
    results["analyses"]["advanced_features"] = {"success": False, "error": str(e)}

# Save results
with open(output_file, "w") as f:
    json.dump(results, f, indent=2)

print(f"✨ Fancy analysis complete: {output_file}", file=sys.stderr)

# Print summary
successful = sum(1 for a in results["analyses"].values() if a.get("success", False))
print(f"\n📊 Summary: {successful}/3 analyses succeeded", file=sys.stderr)
