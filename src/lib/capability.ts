import type { Capability } from '../types'

export async function detectCapability(): Promise<Capability> {
  try {
    if (!navigator.gpu) return 'wasm'
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) return 'wasm'
    const device = await adapter.requestDevice()
    const hasFP16 = device.features.has('shader-f16')
    device.destroy()
    return hasFP16 ? 'webgpu-fp16' : 'webgpu'
  } catch {
    return 'wasm'
  }
}
