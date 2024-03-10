/* eslint-disable no-undef */
import { AutoModel, AutoProcessor, RawImage } from "@xenova/transformers";

// env.allowLocalModels = true;
// env.backends.onnx.wasm.proxy = false;
// // env.localModelPath = new URL("../public/models", import.meta.url).pathname;
// env.backends.onnx.wasm.wasmPaths = new URL(
//   "../public/models",
//   import.meta.url
// ).pathname;

class RemoveBackground {
  static instance = null;
  static processorInstance = null;

  static async getModelInstance() {
    if (this.instance === null) {
      const model = await AutoModel.from_pretrained("briaai/RMBG-1.4", {
        config: { model_type: "custom" },
      });
      this.instance = model;
    }

    return this.instance;
  }
  static async getProcessorInstance() {
    if (this.processorInstance === null) {
      const processor = await AutoProcessor.from_pretrained("briaai/RMBG-1.4", {
        config: {
          do_normalize: true,
          do_pad: false,
          do_rescale: true,
          do_resize: true,
          image_mean: [0.5, 0.5, 0.5],
          feature_extractor_type: "ImageFeatureExtractor",
          image_std: [1, 1, 1],
          resample: 2,
          rescale_factor: 0.00392156862745098,
          size: { width: 1024, height: 1024 },
        },
      });
      this.processorInstance = processor;
    }

    return this.processorInstance;
  }
}

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
  // Send the output back to the main thread
  console.log(event);
  // Read image
  const image = await RawImage.fromURL(event.data);
  // Preprocess image
  let processor = await RemoveBackground.getProcessorInstance();
  const { pixel_values } = await processor(image);
  let model = await RemoveBackground.getModelInstance();
  // Predict alpha matte
  const { output } = await model({ input: pixel_values });

  // Resize mask back to original size
  const mask = await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(
    image.width,
    image.height
  );

  const canvas = new OffscreenCanvas(image.width, image.height);
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image.toCanvas(), 0, 0);

  // Update alpha channel
  const pixelData = ctx.getImageData(0, 0, image.width, image.height);
  for (let i = 0; i < mask.data.length; ++i) {
    pixelData.data[4 * i + 3] = mask.data[i];
  }
  ctx.putImageData(pixelData, 0, 0);

  canvas[
    canvas.convertToBlob
      ? "convertToBlob" // specs
      : "toBlob" // current Firefox
  ]().then((blob) => {
    self.postMessage({
      status: "complete",
      dataUrl: new FileReaderSync().readAsDataURL(blob),
      output: "output",
    });
  });
});
