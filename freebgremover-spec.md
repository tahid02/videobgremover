# PetCut — Spec

**Client-side video background remover for pet videos.**  
Companion tool to the Pet Gatekeeper browser extension.  
Runs 100% in the user's browser. No server. No upload. No cost.

---

## 1. Project Overview

Users of Pet Gatekeeper want to use their own pet videos as the overlay instead of the default cat. The blocker is background removal — most free tools output a green-screen chroma key rather than a true alpha channel, and paid tools cost money.

PetCut solves this: a static website where users upload a pet video, the browser removes the background using an on-device AI model (WebGPU-accelerated), and the user downloads a WebM file with a real transparent background ready to upload into Pet Gatekeeper.

Nothing leaves the device. The AI runs on the user's GPU. Hosting is free (GitHub Pages).

---

## 2. Goals & Non-Goals

### Goals
- Remove background from uploaded pet video entirely in the browser
- Output a WebM VP9 file with true alpha transparency (not green screen)
- Use WebGPU acceleration (FP16) with WASM fallback for older browsers
- Cache the AI model locally so it only downloads once (~50 MB)
- Show clear, granular progress throughout the pipeline (frame-level status text + bar)
- Handle tab visibility correctly: pause extraction when tab is hidden, alert user before Assemble
- Work without any account, login, or payment
- Deploy as a fully static site (GitHub Pages / Vercel)

### Non-Goals
- Real-time/live camera background removal
- Audio preservation in the output (pet videos in Pet Gatekeeper are muted)
- Server-side processing of any kind
- Support for images (videos only)
- Mobile support (desktop browser only — WebGPU availability)

---

## 3. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 18 + TypeScript | Familiar, good Worker support |
| Build tool | Vite 5 | Native ESM, Worker support, fast HMR |
| Styling | Tailwind CSS v3 | Consistent with Pet Gatekeeper |
| AI model | `@huggingface/transformers` (RMBG-1.4) | Best open-source segmentation model; WebGPU/WASM fallback built in |
| Video encoding | `@ffmpeg/ffmpeg` (ffmpeg.wasm) | Only browser-side tool that can encode VP9 with alpha (`yuva420p`) |
| Model caching | IndexedDB (via `idb` helper) | Persist ~50 MB model weights across sessions |
| Worker comms | Native `Worker` + `Comlink` | Type-safe postMessage between threads |
| Hosting | GitHub Pages | Free, static, CI via GitHub Actions |

### Key dependency versions (locked)
```
@huggingface/transformers  ^3.x
@ffmpeg/ffmpeg             ^0.12.x
@ffmpeg/util               ^0.12.x
comlink                    ^4.x
idb                        ^8.x
```

---

## 4. Architecture

### Thread model

```
┌─────────────────────────────────────────────────────┐
│                    Main Thread (UI)                  │
│  React app, progress state, user interactions        │
│  Comlink proxy calls → Workers                       │
└────────────────┬────────────────┬────────────────────┘
                 │                │
    ┌────────────▼────┐    ┌──────▼──────────────────┐
    │  AI Worker      │    │  Encoder Worker          │
    │                 │    │                          │
    │  transformers.js│    │  ffmpeg.wasm             │
    │  RMBG-1.4 model │    │  VP9 + yuva420p          │
    │  WebGPU / WASM  │    │  → WebM with alpha       │
    └────────────┬────┘    └──────▲──────────────────┘
                 │                │
    ┌────────────▼────────────────┴──────────────────┐
    │               Frame Buffer (SharedArrayBuffer)  │
    │  RGBA pixel data passed between workers         │
    └─────────────────────────────────────────────────┘
```

### Data flow (Extract → Process → Assemble)

```
User uploads video file
        │
        ▼
[EXTRACT — Main Thread, tab must be active]
  HTMLVideoElement seeks frame by frame
  → draws to Canvas, extracts RGBA ImageData
  → pauses automatically if tab goes to background
  → resumes when tab becomes visible again
        │
        ▼ (frame batch, 4 frames at a time)
[PROCESS — AI Worker, tab can be in background]
  RMBG-1.4 segments each frame via WebGPU / WASM
  → returns soft alpha mask (float32, 0.0–1.0)
  → composites: original RGB + mask → RGBA with transparent BG
  → emits per-frame status: "Removing background from frame N of M..."
        │
  [Audio alert fires here — signals user to return to tab]
        ▼
[ASSEMBLE — Encoder Worker, tab must be active]
  ffmpeg.wasm receives all processed RGBA frames
  → writes to virtual FS
  → encodes: VP9 + yuva420p → output.webm with alpha
  → emits encoding percent progress
        │
        ▼
User downloads output.webm (transparent background, ready for Pet Gatekeeper)
```

### Model caching

```
First visit:
  transformers.js downloads RMBG-1.4 weights (~50 MB)
  → stored in browser Cache API (transformers.js handles this automatically)

Subsequent visits:
  model loads from local cache in seconds, no network request
```

---

## 5. User Flow

### Step 0 — Landing
- Page loads instantly (static assets only)
- Hero: "Remove your pet's video background. Free. Private. In your browser."
- Single large upload drop zone
- Small note: "First run downloads a ~50 MB AI model. Cached after that."

### Step 1 — Upload
- User drags or clicks to upload a video file
- Accepted: `.mp4`, `.mov`, `.webm`, `.avi`
- Max file size: 200 MB (soft limit with warning, not hard block)
- Preview: thumbnail of first frame shown immediately

### Step 2 — Capability Detection
- Check for WebGPU + FP16 support
- Show badge: `WebGPU FP16 ⚡` or `WebGPU ⚡` or `CPU mode (slower)`
- Show estimated processing time based on video duration and capability

### Step 3 — Model Loading
- If model not cached: show download progress bar (0–100%, MB downloaded)
- If model cached: "AI model ready ✓" (instant)
- This step auto-advances once model is ready

### Step 4 — Extract + Process
- Persistent warning banner shown immediately when this step starts:
  > "You can switch tabs, but come back before it finishes! A sound will play when the final assembly starts — return immediately when you hear it."
- Progress bar: `Extract → Process → Assemble` three-phase indicator
- Running status text updated every frame: `"Removing background from frame 42 of 180..."`
- Live preview: checkered canvas showing current processed frame (transparent BG)
- Estimated time remaining
- Cancel button
- If tab goes to background during Extract: extraction pauses, banner updates to `"Paused — waiting for tab to become active..."`; resumes automatically when user returns

### Step 5 — Assemble
- Audio alert plays (short beep) the moment all frames are processed and Assemble begins
- Banner changes to: `"Assembling your video — stay on this tab!"`
- Progress bar shows ffmpeg encoding percent: `"Assembling... 68%"`
- Tab visibility is monitored: if user leaves during Assemble, a prominent red warning flashes: `"Please return to this tab — assembly may corrupt if the tab is suspended"`

### Step 6 — Done
- Preview: plays the output WebM on a checkered background (to show transparency)
- Download button: `Download transparent.webm`
- "How to use in Pet Gatekeeper" — collapsible guide
- "Process another video" button resets to Step 1

---

## 6. UI Layout

### Page structure
```
┌─────────────────────────────────────────────────────┐
│  🐾 PetCut          [How to use] [GitHub]           │  ← Navbar (minimal)
├─────────────────────────────────────────────────────┤
│                                                     │
│         Drop your pet video here                    │  ← DropZone (full width)
│         or click to browse                          │
│                                                     │
│         Accepted: MP4, MOV, WEBM · Max 200 MB       │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [Status Panel]                                     │  ← Shown after upload
│   Step indicator: Upload → Model → Extract → Process → Assemble → Done
│   Tab visibility warning banner (persistent during processing)   │
│   Progress bar (contextual per step)                             │
│   Status text: "Removing background from frame N of M..."        │
│   Live frame preview (checkered + processed frame)               │
├─────────────────────────────────────────────────────┤
│  [Result Panel]                                     │  ← Shown at Done step
│   Video preview (checkered background)             │
│   Download button                                  │
│   Usage guide accordion                            │
└─────────────────────────────────────────────────────┘
```

### Checkered background (transparency indicator)
- CSS: `background-image: linear-gradient(45deg, #ccc 25%, transparent 25%)` repeating pattern
- Standard "transparency grid" pattern editors use — users immediately understand the BG is gone

---

## 7. Component Tree

```
App
├── Navbar
├── DropZone                        ← file input + drag-and-drop
├── PipelinePanel (conditional)     ← shown after upload
│   ├── StepIndicator               ← Upload / Model / Extract / Process / Assemble / Done
│   ├── CapabilityBadge             ← WebGPU FP16 / WebGPU / CPU
│   ├── TabVisibilityWarning        ← persistent banner; changes message per phase
│   ├── ModelLoadProgress           ← download progress bar + MB count
│   ├── ProcessingProgress          ← frame counter text + progress bar + live preview canvas
│   ├── AssemblyProgress            ← ffmpeg percent bar + "stay on tab" alert
│   └── CancelButton
└── ResultPanel (conditional)       ← shown at Done
    ├── TransparentVideoPreview     ← <video> on checkered canvas
    ├── DownloadButton
    ├── UsageGuide (accordion)
    └── ResetButton
```

---

## 8. Technical Implementation Details

### 8.1 Frame Extraction

```typescript
// Seek-based frame extraction (works for any video format the browser can decode)
async function* extractFrames(file: File, fps: number) {
  const video = document.createElement('video')
  video.src = URL.createObjectURL(file)
  await video.play().then(() => video.pause())

  const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight)
  const ctx = canvas.getContext('2d')!
  const duration = video.duration
  const frameInterval = 1 / fps

  for (let t = 0; t < duration; t += frameInterval) {
    video.currentTime = t
    await new Promise(r => video.addEventListener('seeked', r, { once: true }))
    ctx.drawImage(video, 0, 0)
    yield ctx.getImageData(0, 0, canvas.width, canvas.height)
  }
}
```

**Notes:**
- Respect original video FPS (cap at 30 FPS for processing performance)
- For a 10s video at 30fps = 300 frames to process
- Each frame is RGBA Uint8ClampedArray
- **Tab visibility**: `HTMLVideoElement.seeked` events are throttled or never fire when the tab is backgrounded in Chrome. The extractor must check `document.visibilityState` before each seek and await a `visibilitychange` event if hidden.

```typescript
// Pause seek loop if tab goes to background
async function waitForVisible() {
  if (document.visibilityState === 'visible') return
  await new Promise<void>(resolve => {
    document.addEventListener('visibilitychange', function handler() {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', handler)
        resolve()
      }
    })
  })
}

// Inside the frame loop, before each seek:
await waitForVisible()
video.currentTime = t
await new Promise(r => video.addEventListener('seeked', r, { once: true }))
```

### 8.2 AI Segmentation (AI Worker)

```typescript
// ai.worker.ts
import { pipeline, env } from '@huggingface/transformers'

env.allowLocalModels = false
env.useBrowserCache = true  // uses Cache API — persists across sessions

let segmenter: any = null

async function loadModel(onProgress: (p: number) => void) {
  segmenter = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
    device: 'webgpu',   // falls back to 'wasm' automatically
    dtype: 'fp16',      // FP16 if WebGPU supports shader-f16, else fp32
    progress_callback: onProgress,
  })
}

async function removeBackground(imageData: ImageData): Promise<ImageData> {
  const result = await segmenter(imageDataToTensor(imageData))
  const mask = result[0].mask  // Float32Array, 0.0 = background, 1.0 = foreground

  // Apply mask to original RGBA: set alpha = mask value * 255
  const output = new Uint8ClampedArray(imageData.data)
  for (let i = 0; i < mask.data.length; i++) {
    output[i * 4 + 3] = Math.round(mask.data[i] * 255)
  }
  return new ImageData(output, imageData.width, imageData.height)
}
```

**Notes:**
- `briaai/RMBG-1.4` is the best open-source general segmentation model (works on animals, not just humans)
- `transformers.js` handles WebGPU capability detection and WASM fallback automatically
- Model weights cached by browser Cache API after first download
- Process frames in batches of 4 (balance between GPU utilization and memory)

### 8.3 Alpha Compositing

After the model returns a mask, apply it per-pixel:

```
output[i].alpha = mask[i] * original[i].alpha
```

The mask is soft-edged (float values 0.0–1.0) so fur, feathers, and fine edges composite cleanly without jagged outlines.

### 8.4 Video Encoding (Encoder Worker)

```typescript
// encoder.worker.ts
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

const ffmpeg = new FFmpeg()
await ffmpeg.load()

async function encodeToWebM(frames: ImageData[], fps: number, w: number, h: number) {
  // Write each frame as a raw RGBA file
  for (let i = 0; i < frames.length; i++) {
    await ffmpeg.writeFile(`frame${String(i).padStart(5, '0')}.rgba`,
      new Uint8Array(frames[i].data.buffer))
  }

  // Encode: raw RGBA → VP9 WebM with alpha
  await ffmpeg.exec([
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${w}x${h}`,
    '-framerate', String(fps),
    '-i', 'frame%05d.rgba',   // sequential input
    '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuva420p',   // ← this is the critical flag for alpha
    '-b:v', '0',
    '-crf', '30',
    '-auto-alt-ref', '0',     // required when alpha channel is present
    'output.webm'
  ])

  const data = await ffmpeg.readFile('output.webm')
  return new Blob([data], { type: 'video/webm' })
}
```

**Critical ffmpeg flags:**
- `-pix_fmt yuva420p` — preserves the alpha channel (omitting this silently drops alpha)
- `-auto-alt-ref 0` — VP9 alt-ref frames are incompatible with alpha; must disable
- `-crf 30` — quality-based bitrate (0 = lossless, 63 = worst); 30 is good for pet overlay use

**Tab visibility during Assemble:**  
`SharedArrayBuffer` + `Atomics.wait()` used by ffmpeg.wasm can be suspended by Chrome when the tab is hidden. This is why the audio alert fires right before Assemble starts — the user must be on the tab for the encode to complete. If the tab is hidden mid-encode, the ffmpeg process may freeze or produce a corrupted file. The `TabVisibilityWarning` component monitors `visibilitychange` during this phase and shows a red urgent banner if the user navigates away.

### 8.5 Memory Management

Processing 300 frames of a 1080p video naively = ~750 MB in RAM. Strategy:

- **Streaming pipeline**: don't hold all frames in memory at once
- **Chunk size**: extract → segment → accumulate in Encoder Worker → free from main memory
- **Chunk size**: 30 frames (~1 second of video) per chunk
- After a chunk is passed to the encoder, release references so GC can collect

```
Extract 30 frames → AI Worker (segment) → Encoder Worker (write to ffmpeg FS)
       ↑                                                        ↓
   free chunk                                          next chunk starts
```

### 8.6 Progress Events

Each worker emits structured progress messages via Comlink:

```typescript
type ProgressEvent =
  | { stage: 'model-download'; percent: number; mbLoaded: number; mbTotal: number }
  | { stage: 'extract';    frame: number; total: number }
  | { stage: 'process';    frame: number; total: number; previewDataUrl: string }
  | { stage: 'assemble';   percent: number }
  | { stage: 'done';       blob: Blob; durationSec: number; sizeMb: number }
  | { stage: 'error';      message: string }
```

The UI derives status text from these events:

| Event | Status text shown |
|---|---|
| `extract` frame N of M | `"Extracting frame N of M..."` |
| `process` frame N of M | `"Removing background from frame N of M..."` |
| `assemble` 68% | `"Assembling... 68%"` |

The `process` event also carries `previewDataUrl` — a data URL of the processed frame rendered on a checkered canvas — so the user can see the AI working in real time.

### 8.7 Audio Alert

A short beep plays the moment all frames are processed and Assemble is about to begin. This is the signal for users who have switched tabs to come back.

```typescript
function playAssembleAlert() {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = 880  // A5 — clearly audible, not jarring
  gain.gain.setValueAtTime(0.3, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.6)
}
```

No external audio file needed — generated via the Web Audio API.

---

## 9. Project File Structure

```
petcut/
├── public/
│   └── favicon.svg              ← paw print (reuse from Pet Gatekeeper)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                ← Tailwind base
│   │
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── DropZone.tsx
│   │   ├── StepIndicator.tsx
│   │   ├── CapabilityBadge.tsx
│   │   ├── ModelLoadProgress.tsx
│   │   ├── ProcessingProgress.tsx
│   │   ├── EncodingProgress.tsx
│   │   ├── TransparentVideoPreview.tsx
│   │   ├── DownloadButton.tsx
│   │   ├── UsageGuide.tsx
│   │   └── CancelButton.tsx
│   │
│   ├── workers/
│   │   ├── ai.worker.ts         ← transformers.js + RMBG-1.4
│   │   └── encoder.worker.ts    ← ffmpeg.wasm VP9 encoder
│   │
│   ├── lib/
│   │   ├── frameExtractor.ts    ← HTMLVideoElement seek-based extraction
│   │   ├── pipeline.ts          ← orchestrates extract → segment → encode
│   │   ├── capability.ts        ← WebGPU / FP16 detection
│   │   └── formatters.ts        ← file size, time remaining helpers
│   │
│   ├── hooks/
│   │   ├── usePipeline.ts       ← main state machine hook
│   │   ├── useDropZone.ts       ← drag-and-drop logic
│   │   └── useTabVisibility.ts  ← Page Visibility API wrapper; returns 'visible' | 'hidden'
│   │
│   └── types.ts                 ← shared types (ProgressEvent, PipelineState, etc.)
│
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 10. State Machine

The pipeline has 8 states. UI renders based on current state.

```
IDLE
  └─(file dropped)──► CAPABILITY_CHECK
                            └─(done)──► MODEL_LOADING
                                              └─(model ready)──► EXTRACTING
                                                                      │
                                                          (tab hidden)─┤
                                                                      ▼
                                                                   PAUSED ──(tab visible)──► EXTRACTING
                                                                      │
                                                          (all frames extracted)
                                                                      ▼
                                                                  PROCESSING
                                                                      │
                                                          (all frames processed)
                                                                      ▼
                                                              [audio alert fires]
                                                                      ▼
                                                                 ASSEMBLING
                                                                      └─(ffmpeg done)──► DONE

Any state ──(cancel / error)──► IDLE
```

```typescript
type PipelineState =
  | { status: 'idle' }
  | { status: 'capability-check' }
  | { status: 'model-loading';  percent: number; mb: string }
  | { status: 'extracting';     frame: number; total: number }
  | { status: 'paused';         frame: number; total: number }   // tab hidden during extract
  | { status: 'processing';     frame: number; total: number; previewUrl: string; eta: string }
  | { status: 'assembling';     percent: number; tabWarning: boolean }
  | { status: 'done';           blob: Blob; sizeMb: number }
  | { status: 'error';          message: string }
```

`tabWarning: true` is set on the `assembling` state if the user navigates away during Assemble — triggers the red banner.

---

## 11. Tab Visibility Strategy

This is the most important UX constraint in the pipeline, learned from observing how unscreen.io handles it.

### Why it matters per phase

| Phase | Tab can be hidden? | What breaks if hidden |
|---|---|---|
| Model Loading | Yes | Nothing — fetch continues in background |
| Extract | No | `HTMLVideoElement.seeked` events stop firing; frame loop hangs silently |
| Process | Yes (mostly) | WebGPU Worker continues, may be slightly throttled |
| Assemble | No | `SharedArrayBuffer` + `Atomics.wait()` may be suspended; encode freezes or corrupts |

### Behavior per phase

**Extract (tab hidden):**
- Extraction loop detects `document.visibilityState === 'hidden'`
- Suspends the seek loop (does not seek next frame)
- State transitions to `paused`
- Banner: `"Paused — return to this tab to continue processing"`
- Automatically resumes on `visibilitychange` → `visible`

**Process (tab hidden):**
- AI Worker continues uninterrupted (Workers aren't subject to same throttling)
- No pause needed, but banner remains visible as reminder

**Assemble (tab hidden):**
- Cannot pause — ffmpeg.wasm is already running; interrupting it corrupts the output
- Banner turns red: `"⚠ Please stay on this tab — leaving may corrupt your video"`
- If user returns, banner goes back to normal
- No forced stop — just strong visual warning

### Audio alert (transition to Assemble)

Fires once, exactly when all frames are processed and Assemble is about to start. Uses Web Audio API (no file dependency). Purpose: pull back users who left the tab during Process.

### `useTabVisibility` hook

```typescript
export function useTabVisibility(): 'visible' | 'hidden' {
  const [visibility, setVisibility] = useState<'visible' | 'hidden'>(
    document.visibilityState === 'visible' ? 'visible' : 'hidden'
  )
  useEffect(() => {
    const handler = () => setVisibility(
      document.visibilityState === 'visible' ? 'visible' : 'hidden'
    )
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])
  return visibility
}
```

### `TabVisibilityWarning` component states

| Pipeline phase | Tab visible | Banner content | Style |
|---|---|---|---|
| Extracting | Yes | `"You can switch tabs during processing — a sound will play when assembly starts"` | Blue info |
| Extracting | No | `"Paused — return to this tab to continue"` | Yellow warning |
| Processing | No | `"Processing in background — come back when you hear the sound"` | Blue info |
| Assembling | Yes | `"Assembling your video — stay on this tab!"` | Yellow warning |
| Assembling | No | `"⚠ Please return immediately — leaving may corrupt your video"` | Red urgent |

---

## 12. Capability Detection

```typescript
export type Capability = 'webgpu-fp16' | 'webgpu' | 'wasm'

export async function detectCapability(): Promise<Capability> {
  if (!navigator.gpu) return 'wasm'

  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) return 'wasm'

  const device = await adapter.requestDevice()
  const hasFP16 = device.features.has('shader-f16')
  device.destroy()

  return hasFP16 ? 'webgpu-fp16' : 'webgpu'
}
```

Show user:
- `webgpu-fp16` → "GPU accelerated ⚡ (fastest)"
- `webgpu` → "GPU accelerated ⚡"
- `wasm` → "CPU mode — processing will be slower"

---

## 13. Performance Targets

| Video | Resolution | Duration | WebGPU FP16 | WebGPU FP32 | WASM (CPU) |
|---|---|---|---|---|---|
| Short pet clip | 720p | 5s | ~30s | ~60s | ~5 min |
| Medium clip | 1080p | 10s | ~90s | ~3 min | ~15 min |
| Long clip | 1080p | 30s | ~4 min | ~8 min | ~45 min |

Recommendation shown to user: "For best results, use clips under 15 seconds."

---

## 14. Browser Support

| Browser | WebGPU FP16 | WebGPU | WASM fallback |
|---|---|---|---|
| Chrome 113+ | ✓ | ✓ | ✓ |
| Edge 113+ | ✓ | ✓ | ✓ |
| Firefox 141+ | — | ✓ (experimental) | ✓ |
| Safari | — | — | ✓ |

**Primary target: Chrome desktop.** Same browser the Pet Gatekeeper extension runs in.

---

## 15. Deployment

### GitHub Pages (recommended)
- Repo: `petcut` (separate from pet-gatekeeper)
- GitHub Actions workflow: on push to `main` → `vite build` → deploy `dist/` to `gh-pages` branch
- URL: `https://[username].github.io/petcut`

### Required Vite config for ffmpeg.wasm (COOP/COEP headers)

ffmpeg.wasm uses `SharedArrayBuffer`, which requires cross-origin isolation headers:

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  }
})
```

For GitHub Pages (static, no server headers), use a **Service Worker** to inject these headers. Package: `coi-serviceworker` (1 script, handles it automatically).

---

## 16. Integration with Pet Gatekeeper

The output `transparent.webm` is a drop-in replacement for the extension's built-in `neko.webm` / `neko2.webm` files.

**Usage guide shown on the result page:**

1. Download `transparent.webm` from PetCut
2. Open Pet Gatekeeper options page
3. Under "Custom Pet Video", click "Upload video"
4. Select your downloaded `transparent.webm`
5. The extension stores the video in `chrome.storage.local`
6. Your pet now appears on your blocked sites instead of the default cat

*(Step 3 and 4 require the upload feature to be built in Pet Gatekeeper — tracked in `todo-features.md` under "Cat customization".)*

---

## 17. Build Order (Implementation Phases)

### Phase 1 — Project scaffold
- Vite + React + TypeScript + Tailwind setup
- Navbar, DropZone, basic layout
- `coi-serviceworker` for GitHub Pages COOP/COEP headers

### Phase 2 — Capability detection + model loading
- `detectCapability()` + CapabilityBadge component
- AI Worker scaffolding with Comlink
- Model download + progress events
- ModelLoadProgress UI

### Phase 3 — Frame extraction + tab visibility
- `frameExtractor.ts` (seek-based, with `waitForVisible()` guard)
- `useTabVisibility` hook
- `TabVisibilityWarning` component (all banner states)
- State transitions: `extracting` ↔ `paused`

### Phase 4 — AI segmentation + audio alert
- AI Worker: RMBG-1.4 inference, mask application
- Per-frame `process` progress events with previewDataUrl
- `playAssembleAlert()` fires when all frames are processed
- ProcessingProgress UI with live frame text + preview canvas

### Phase 5 — Assemble
- Encoder Worker: ffmpeg.wasm setup
- VP9 + `yuva420p` encoding with percent progress
- `tabWarning` flag on assembling state
- AssemblyProgress UI + red banner if tab hidden during encode

### Phase 5 — Result + download
- TransparentVideoPreview on checkered background
- DownloadButton + Blob URL
- UsageGuide accordion

### Phase 6 — Polish + deploy
- Error states and user-friendly messages
- Cancel/reset flow
- Performance testing across browsers
- GitHub Actions deploy workflow
- Link from Pet Gatekeeper options page