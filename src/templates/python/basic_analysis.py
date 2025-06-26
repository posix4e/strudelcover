import json
import sys
import warnings

warnings.filterwarnings("ignore")

audio_file = sys.argv[1]
output_file = sys.argv[2]

results = {"audio_file": audio_file, "ml_available": False, "features": {}}

# Basic analysis with librosa
try:
    import librosa
    import numpy as np

    print("Loading audio...", file=sys.stderr)
    y, sr = librosa.load(audio_file, sr=None)
    duration = len(y) / sr

    print("Extracting features...", file=sys.stderr)

    # Tempo and beats
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)

    # Chroma features for harmony
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)

    # Onset detection
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)

    # Structure analysis using self-similarity
    hop_length = 512
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop_length)
    sim_matrix = librosa.segment.recurrence_matrix(mfcc, mode="affinity")

    results["features"] = {
        "duration": float(duration),
        "tempo": float(tempo),
        "beat_count": len(beats),
        "onset_count": len(onset_times),
        "key_estimate": int(np.argmax(chroma.mean(axis=1))),
        "energy_mean": float(np.mean(np.abs(y))),
        "energy_std": float(np.std(np.abs(y))),
    }
    results["ml_available"] = True

    # Try advanced features if available
    try:
        import torch

        results["features"]["torch_available"] = True
    except:
        pass

    # Try source separation if available
    try:
        import demucs.api

        print("Demucs available for source separation", file=sys.stderr)
        results["features"]["demucs_available"] = True
    except:
        pass

    # Try transcription if available
    try:
        from basic_pitch.inference import predict

        print("Basic-pitch available for transcription", file=sys.stderr)
        results["features"]["basic_pitch_available"] = True
    except:
        pass

except Exception as e:
    print(f"Error in ML analysis: {e}", file=sys.stderr)

# Save results
with open(output_file, "w") as f:
    json.dump(results, f, indent=2)

print(f"Analysis saved to {output_file}", file=sys.stderr)
