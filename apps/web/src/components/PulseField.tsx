import { useEffect, useRef } from "react";

const shader = /* wgsl */ `
struct Uniforms {
  resolution: vec2f,
  time: f32,
  padding: f32,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(positions[index], 0.0, 1.0);
}

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  var uv = position.xy / uniforms.resolution;
  uv = uv * 2.0 - 1.0;
  uv.x *= uniforms.resolution.x / uniforms.resolution.y;
  let center = vec2f(0.22, -0.02);
  let distanceFromCenter = distance(uv, center);
  let wave = abs(sin(distanceFromCenter * 38.0 - uniforms.time * 0.9));
  let line = smoothstep(0.96, 1.0, wave);
  let envelope = smoothstep(0.72, 0.12, distanceFromCenter);
  let alpha = line * envelope * 0.035;
  return vec4f(0.19, 0.61, 0.34, alpha);
}
`;

async function startWebGpu(canvas: HTMLCanvasElement): Promise<(() => void) | null> {
  if (!("gpu" in navigator)) return null;
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "low-power" });
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu") as GPUCanvasContext | null;
  if (!context) {
    device.destroy();
    return null;
  }
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });
  const module = device.createShaderModule({ code: shader });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module, entryPoint: "vertexMain" },
    fragment: {
      module,
      entryPoint: "fragmentMain",
      targets: [
        {
          format,
          blend: {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list" },
  });
  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });
  const startedAt = performance.now();
  let animation = 0;
  const draw = (time: number) => {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      new Float32Array([width, height, (time - startedAt) / 1000, 0]),
    );
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
    animation = requestAnimationFrame(draw);
  };
  animation = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(animation);
    uniformBuffer.destroy();
    device.destroy();
  };
}

function startCanvasFallback(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext("2d");
  if (!context) return () => undefined;
  let frame = 0;
  let animation = 0;
  const draw = () => {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio, 2);
    if (canvas.width !== rect.width * ratio || canvas.height !== rect.height * ratio) {
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.scale(ratio, ratio);
    const x = rect.width * 0.62;
    const y = rect.height * 0.48;
    for (let ring = 0; ring < 3; ring += 1) {
      const phase = (frame * 0.25 + ring * 28) % 86;
      context.beginPath();
      context.arc(x, y, 20 + phase, 0, Math.PI * 2);
      context.strokeStyle = `rgba(85, 178, 111, ${Math.max(0, 0.09 - phase / 1100)})`;
      context.lineWidth = 1;
      context.stroke();
    }
    context.restore();
    frame += 1;
    animation = requestAnimationFrame(draw);
  };
  animation = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(animation);
}

export function PulseField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let disposed = false;
    let cleanup: () => void = () => undefined;
    void startWebGpu(canvas)
      .then((stop) => {
        if (disposed) {
          stop?.();
          return;
        }
        cleanup = stop ?? startCanvasFallback(canvas);
      })
      .catch(() => {
        if (!disposed) cleanup = startCanvasFallback(canvas);
      });
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);
  return <canvas className="pulse-field" ref={canvasRef} />;
}
