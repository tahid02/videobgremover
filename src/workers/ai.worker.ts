import { expose } from 'comlink'

// Stub — real RMBG-1.4 implementation added in Phase 4
const worker = {
  async loadModel(_onProgress: (p: unknown) => void): Promise<void> {
    // no-op stub
  },

  async processFrame(imageData: {
    data: Uint8ClampedArray
    width: number
    height: number
  }): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
    // Pass-through stub — returns unchanged frame
    return imageData
  },
}

expose(worker)

export type AIWorker = typeof worker
