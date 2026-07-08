import React, { useState } from "react";
import ImageViewer from "@/components/ui/ImageViewer";

/**
 * Wrapper that opens the ImageViewer (rotate, zoom, download) on click.
 * Use as <ImageLink url={...} name={...} className="...">children</ImageLink>
 * children can be text, icons, or an <img> thumbnail.
 */
export default function ImageLink({ url, name, className, children }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <ImageViewer open={open} onClose={() => setOpen(false)} url={url} name={name} />
    </>
  );
}