import { createWorker } from 'tesseract.js'

export async function recognizeWordPrintout(
  image: File | Blob,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const worker = await createWorker(['eng', 'kor'], undefined, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/core/tesseract-core-lstm.wasm.js',
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  try {
    const {
      data: { text },
    } = await worker.recognize(image)
    return text
  } finally {
    await worker.terminate()
  }
}
