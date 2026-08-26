import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

const SignaturePad = forwardRef(({ height = 180, className }, ref) => {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [hasInk, setHasInk] = useState(false);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, rect.width) * ratio;
    canvas.height = height * ratio;
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, height);
  };

  useEffect(() => {
    initCanvas();
    const onResize = () => { initCanvas(); setHasInk(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [height]);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const down = (e) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    try { canvasRef.current.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  };
  const up = (e) => { e.preventDefault(); drawing.current = false; last.current = null; };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, height);
    setHasInk(false);
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => !hasInk,
    toDataURL: () => (hasInk ? canvasRef.current.toDataURL("image/png") : null),
  }));

  return (
    <div className={className}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-white touch-none cursor-crosshair"
          style={{ height, touchAction: "none" }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          onPointerCancel={up}
        />
        {!hasInk && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-sm font-medium select-none">
            ✍️ Assine aqui com o dedo ou caneta stylus
          </div>
        )}
      </div>
      {hasInk && (
        <Button type="button" variant="ghost" size="sm" onClick={clear} className="mt-1 gap-1 text-xs text-slate-500">
          <Eraser className="w-3 h-3" /> Limpar assinatura
        </Button>
      )}
    </div>
  );
});
SignaturePad.displayName = "SignaturePad";
export default SignaturePad;