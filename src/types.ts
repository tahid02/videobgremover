export type Capability = 'webgpu-fp16' | 'webgpu' | 'wasm'

export type PipelineState =
  | { status: 'idle' }
  | { status: 'capability-check' }
  | { status: 'model-loading'; percent: number; mb: string }
  | { status: 'extracting'; frame: number; total: number }
  | { status: 'paused'; frame: number; total: number }
  | { status: 'processing'; frame: number; total: number; previewUrl: string; eta: string }
  | { status: 'assembling'; percent: number; tabWarning: boolean }
  | { status: 'done'; blob: Blob; sizeMb: number }
  | { status: 'error'; message: string }

export type PipelineProgressEvent =
  | { stage: 'model-download'; percent: number; mbLoaded: number; mbTotal: number }
  | { stage: 'extract'; frame: number; total: number }
  | { stage: 'process'; frame: number; total: number; previewDataUrl: string }
  | { stage: 'assemble'; percent: number }
  | { stage: 'done'; blob: Blob; durationSec: number; sizeMb: number }
  | { stage: 'error'; message: string }
