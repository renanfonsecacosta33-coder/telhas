import React, { useState } from "react";
import ImageViewer from "@/components/ui/ImageViewer";

/**
 * Wrapper that opens the ImageViewer (rotate, zoom, download) on click.
 * Use as <ImageLink url={...} name={...} className="...">children</ImageLink>
 * children can be text, icons, or an <img> thumbnail.
 */
export default function ImageLink({ url, name, images, initialIndex = 0, className, children }) {
  const [open, setOpen] = useState(false);
  const targetUrl = url || images?.[initialIndex]?.url || images?.[0]?.url;
  if (!targetUrl && (!images || images.length === 0)) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>
      <ImageViewer
        open={open}
        onClose={() => setOpen(false)}
        url={targetUrl}
        name={name}
        images={images}
        initialIndex={initialIndex}
      />
    </>
  );
}