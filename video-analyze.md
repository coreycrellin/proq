# Video Analysis Instructions for Claude Code

When given a video file path, follow these steps to extract visual frames and audio transcript, align them, and produce a structured manifest that you can use for Q&A.

## Prerequisites

Before starting, verify tools are available:

```bash
which ffmpeg && which ffprobe && python3 -c "import whisper; print('whisper OK')"
```

If whisper is missing: `pip install openai-whisper`

## Configuration

Adjust these based on video length:

| Duration   | Max Frames | Approx Interval |
|------------|-----------|------------------|
| 0–2 min    | 15        | ~8s              |
| 2–5 min    | 25        | ~10s             |
| 5–15 min   | 40        | ~20s             |
| 15–30 min  | 50        | ~30s             |
| 30–60 min  | 60        | ~45s             |
| 60+ min    | 80        | ~60s             |

WHISPER_MODEL: `base` (fast, good enough for clear speech). Use `small` or `medium` for noisy audio.
FRAME_WIDTH: 512px (balances detail vs token cost).
SCENE_THRESHOLD: 0.3 (lower = more scene changes detected).

## Step 1: Probe the Video

```bash
OUTDIR="./video_analysis"
mkdir -p "$OUTDIR/frames"
ffprobe -v quiet -print_format json -show_format -show_streams "$VIDEO_PATH"
```

Record: duration, resolution, whether audio stream exists. Use duration to pick MAX_FRAMES from the table above.

## Step 2: Extract Audio

Skip this step if ffprobe shows no audio stream.

```bash
ffmpeg -i "$VIDEO_PATH" -vn -acodec pcm_s16le -ar 16000 -ac 1 "$OUTDIR/audio.wav" -y
```

## Step 3: Transcribe Audio

```bash
python3 -m whisper "$OUTDIR/audio.wav" --model base --output_format json --output_dir "$OUTDIR" --word_timestamps True
```

This produces `$OUTDIR/audio.json` with segment-level timestamps. Each segment has `start`, `end`, and `text` fields.

## Step 4: Detect Scene Changes and Extract Frames

First, try scene-change detection to find visually distinct moments:

```bash
ffmpeg -i "$VIDEO_PATH" -vf "select='gt(scene,0.3)',metadata=print:file=$OUTDIR/scenes.txt" -vsync vfr -f null - 2>/dev/null
```

Then run this Python script to pick frame timestamps and extract them:

```python
import json, subprocess, os, re, sys

VIDEO_PATH = sys.argv[1]
OUTDIR = sys.argv[2]
MAX_FRAMES = int(sys.argv[3])
FRAME_WIDTH = 512

# Get video duration
probe = subprocess.run(
    ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", VIDEO_PATH],
    capture_output=True, text=True
)
duration = float(json.loads(probe.stdout)["format"]["duration"])

# Parse scene-change timestamps
timestamps = []
scenes_file = os.path.join(OUTDIR, "scenes.txt")
if os.path.exists(scenes_file):
    with open(scenes_file) as f:
        for line in f:
            m = re.search(r"pts_time:([\d.]+)", line)
            if m:
                timestamps.append(float(m.group(1)))

# If scene detection gave too few or too many, fall back to fixed interval
if len(timestamps) < 5:
    interval = duration / MAX_FRAMES
    timestamps = [i * interval for i in range(MAX_FRAMES)]
elif len(timestamps) > MAX_FRAMES:
    # Greedy furthest-point sampling to maximize temporal spread
    selected = [timestamps[0]]
    remaining = timestamps[1:]
    while len(selected) < MAX_FRAMES and remaining:
        best = max(remaining, key=lambda t: min(abs(t - s) for s in selected))
        selected.append(best)
        remaining.remove(best)
    timestamps = sorted(selected)

# Always include first and last moments
if timestamps[0] > 1.0:
    timestamps.insert(0, 0.5)
if duration - timestamps[-1] > 5.0:
    timestamps.append(duration - 0.5)

# Cap again after adding endpoints
timestamps = sorted(set(timestamps))[:MAX_FRAMES]

# Extract each frame
frame_list = []
for i, ts in enumerate(timestamps):
    h = int(ts // 3600)
    m = int((ts % 3600) // 60)
    s = int(ts % 60)
    time_label = f"{h:02d}h{m:02d}m{s:02d}s" if h > 0 else f"{m:02d}m{s:02d}s"
    filename = f"frame_{i+1:03d}_{time_label}.jpg"
    filepath = os.path.join(OUTDIR, "frames", filename)

    subprocess.run([
        "ffmpeg", "-ss", str(ts), "-i", VIDEO_PATH,
        "-frames:v", "1", "-vf", f"scale={FRAME_WIDTH}:-1",
        "-q:v", "2", filepath, "-y"
    ], capture_output=True)

    frame_list.append({"index": i + 1, "timestamp": ts, "time_label": time_label, "file": filename})

# Save frame manifest for alignment step
with open(os.path.join(OUTDIR, "frames.json"), "w") as f:
    json.dump(frame_list, f, indent=2)

print(f"Extracted {len(frame_list)} frames")
```

Run it:
```bash
python3 "$OUTDIR/extract_frames.py" "$VIDEO_PATH" "$OUTDIR" MAX_FRAMES
```

## Step 5: Align Transcript to Frames and Generate Manifest

```python
import json, os, sys

OUTDIR = sys.argv[1]
VIDEO_NAME = sys.argv[2]

# Load frames
with open(os.path.join(OUTDIR, "frames.json")) as f:
    frames = json.load(f)

# Load transcript (may not exist if no audio)
segments = []
transcript_file = os.path.join(OUTDIR, "audio.json")
if os.path.exists(transcript_file):
    with open(transcript_file) as f:
        data = json.load(f)
        segments = data.get("segments", [])

# For each frame, find overlapping transcript segments
# Window: from previous frame's midpoint to next frame's midpoint
def get_window(i, frames):
    if i == 0:
        start = 0
    else:
        start = (frames[i-1]["timestamp"] + frames[i]["timestamp"]) / 2
    if i == len(frames) - 1:
        end = frames[i]["timestamp"] + 30  # generous end
    else:
        end = (frames[i]["timestamp"] + frames[i+1]["timestamp"]) / 2
    return start, end

lines = []
lines.append(f"# Video Analysis: {VIDEO_NAME}\n")
lines.append(f"Frames extracted: {len(frames)} | Transcript segments: {len(segments)}\n")
lines.append("---\n")
lines.append("## Timeline\n")

for i, frame in enumerate(frames):
    ts = frame["timestamp"]
    label = frame["time_label"]
    win_start, win_end = get_window(i, frames)

    # Find matching transcript segments
    matched_text = []
    for seg in segments:
        seg_start = seg["start"]
        seg_end = seg["end"]
        # Overlap check
        if seg_start < win_end and seg_end > win_start:
            matched_text.append(seg["text"].strip())

    transcript_block = " ".join(matched_text) if matched_text else "_[no speech]_"

    lines.append(f"### [{label}] Frame {frame['index']}\n")
    lines.append(f"![frame](frames/{frame['file']})\n")
    lines.append(f"> {transcript_block}\n")
    lines.append("")

# Append full transcript
if segments:
    lines.append("---\n")
    lines.append("## Full Transcript\n")
    for seg in segments:
        start = seg["start"]
        m = int(start // 60)
        s = int(start % 60)
        lines.append(f"**[{m:02d}:{s:02d}]** {seg['text'].strip()}\n")

# Usage instructions
lines.append("---\n")
lines.append("## How to Use This Analysis\n")
lines.append("When answering questions about this video:\n")
lines.append("1. Read this manifest for an overview of what happens and when\n")
lines.append("2. Read specific frame image files from frames/ when visual detail matters\n")
lines.append("3. Use the full transcript to search for specific topics or quotes\n")
lines.append("4. Cite timestamps in your answers so the user can jump to that point\n")

with open(os.path.join(OUTDIR, "manifest.md"), "w") as f:
    f.write("\n".join(lines))

print(f"Manifest written to {OUTDIR}/manifest.md")
```

Run it:
```bash
python3 "$OUTDIR/build_manifest.py" "$OUTDIR" "$(basename "$VIDEO_PATH")"
```

## Step 6: Read the Manifest

After generating, read `$OUTDIR/manifest.md`. This is the primary document for understanding the video. When a question requires visual inspection of a specific moment, read the corresponding frame image from `frames/`.

## Output Structure

```
video_analysis/
  manifest.md              # Main document: timeline of frames + aligned transcript
  frames/
    frame_001_00m00s.jpg
    frame_002_00m12s.jpg
    ...
  frames.json              # Frame metadata (timestamps, filenames)
  audio.wav                # Extracted audio (can delete after transcription)
  audio.json               # Raw Whisper output with word-level timestamps
  scenes.txt               # Scene detection output
```

## Notes

- **Token budget**: At 512px width, each frame is ~800-1200 tokens. 40 frames ~ 40K tokens. The manifest text adds ~5-10K. Total is well within Claude's context.
- **No audio?** The pipeline still works -- you get a visual-only timeline with `[no speech]` annotations.
- **Screencasts/slides**: These have few scene changes. The fixed-interval fallback handles this. Consider lowering SCENE_THRESHOLD to 0.15.
- **Long videos (60+ min)**: Whisper handles these fine internally (it chunks at 30s). Frame extraction stays fast since we seek to specific timestamps.
- **Cleanup**: `audio.wav` can be large. Delete it after transcription to save space.
