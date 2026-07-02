import { useEffect, useRef } from "react";

export function PulseField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = canvas.getContext("2d");
    if (!context) return;

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
  }, []);

  return <canvas className="pulse-field" ref={canvasRef} aria-hidden="true" />;
}
