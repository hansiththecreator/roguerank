"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ImageCropper.module.css";

const MAX_ZOOM = 5;
const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 720;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function ImageCropper({ src, onConfirm, onCancel }) {
  const frameRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const pinchRef = useRef(null);

  const [natural, setNatural] = useState(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Smallest scale that still fully covers the crop frame.
  const coverScale =
    natural && frame.width
      ? Math.max(frame.width / natural.width, frame.height / natural.height)
      : 1;
  const scale = coverScale * zoom;
  const displayWidth = natural ? natural.width * scale : 0;
  const displayHeight = natural ? natural.height * scale : 0;

  const clampOffset = useCallback(
    (next, dw = displayWidth, dh = displayHeight) => ({
      x: clamp(next.x, frame.width - dw, 0),
      y: clamp(next.y, frame.height - dh, 0),
    }),
    [displayWidth, displayHeight, frame.width, frame.height]
  );

  // Measure the crop frame and keep it in sync with viewport changes.
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setFrame({ width: rect.width, height: rect.height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Center the image once we know both the frame and the image dimensions.
  useEffect(() => {
    if (!natural || !frame.width) return;
    const dw = natural.width * coverScale;
    const dh = natural.height * coverScale;
    setZoom(1);
    setOffset({ x: (frame.width - dw) / 2, y: (frame.height - dh) / 2 });
  }, [natural, frame.width, frame.height, coverScale]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  // zoomTarget may be an absolute number (slider/pinch) or a function of the
  // previous zoom (wheel), so rapid events that fire before a re-render compose
  // off the latest value instead of a stale closure.
  const applyZoom = useCallback(
    (zoomTarget, focalX, focalY) => {
      if (!natural || !frame.width) return;
      setZoom((prevZoom) => {
        const requested =
          typeof zoomTarget === "function" ? zoomTarget(prevZoom) : zoomTarget;
        const clampedZoom = clamp(requested, 1, MAX_ZOOM);
        const ratio = clampedZoom / prevZoom;
        setOffset((prevOffset) => {
          const nextDw = natural.width * coverScale * clampedZoom;
          const nextDh = natural.height * coverScale * clampedZoom;
          const moved = {
            x: focalX - (focalX - prevOffset.x) * ratio,
            y: focalY - (focalY - prevOffset.y) * ratio,
          };
          return clampOffset(moved, nextDw, nextDh);
        });
        return clampedZoom;
      });
    },
    [natural, frame.width, coverScale, clampOffset]
  );

  const handleWheel = useCallback(
    (event) => {
      event.preventDefault();
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect) return;
      const focalX = event.clientX - rect.left;
      const focalY = event.clientY - rect.top;
      const factor = Math.exp(-event.deltaY * 0.0015);
      applyZoom((prev) => prev * factor, focalX, focalY);
    },
    [applyZoom]
  );

  // Wheel listener is attached manually so it can be non-passive (preventDefault).
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;
    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = (event) => {
    event.preventDefault();
    dragRef.current = { x: event.clientX, y: event.clientY };
  };

  useEffect(() => {
    const onMove = (event) => {
      if (!dragRef.current) return;
      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      dragRef.current = { x: event.clientX, y: event.clientY };
      setOffset((prev) => clampOffset({ x: prev.x + dx, y: prev.y + dy }));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [clampOffset]);

  const touchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (event) => {
    if (event.touches.length === 1) {
      dragRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
      pinchRef.current = null;
    } else if (event.touches.length === 2) {
      dragRef.current = null;
      pinchRef.current = { distance: touchDistance(event.touches), zoom };
    }
  };

  const handleTouchMove = (event) => {
    event.preventDefault();
    if (event.touches.length === 1 && dragRef.current) {
      const touch = event.touches[0];
      const dx = touch.clientX - dragRef.current.x;
      const dy = touch.clientY - dragRef.current.y;
      dragRef.current = { x: touch.clientX, y: touch.clientY };
      setOffset((prev) => clampOffset({ x: prev.x + dx, y: prev.y + dy }));
    } else if (event.touches.length === 2 && pinchRef.current) {
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect) return;
      const distance = touchDistance(event.touches);
      const nextZoom =
        (distance / pinchRef.current.distance) * pinchRef.current.zoom;
      const focalX =
        (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      const focalY =
        (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
      applyZoom(nextZoom, focalX, focalY);
    }
  };

  const handleTouchEnd = (event) => {
    if (event.touches.length === 0) {
      dragRef.current = null;
      pinchRef.current = null;
    } else if (event.touches.length === 1) {
      pinchRef.current = null;
      dragRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    }
  };

  const handleConfirm = () => {
    if (!natural || !frame.width) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sourceX = -offset.x / scale;
    const sourceY = -offset.y / scale;
    const sourceWidth = frame.width / scale;
    const sourceHeight = frame.height / scale;

    ctx.drawImage(
      imageRef.current,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      OUTPUT_WIDTH,
      OUTPUT_HEIGHT
    );

    onConfirm?.(canvas.toDataURL("image/jpeg", 0.9));
  };

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) onCancel?.();
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      onClick={handleOverlayClick}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Crop image</h3>
          <p className={styles.subtitle}>
            Drag to reposition · scroll or pinch to zoom
          </p>
        </div>

        <div
          ref={frameRef}
          className={styles.frame}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={src}
            alt="Crop preview"
            className={styles.image}
            draggable={false}
            onLoad={(event) =>
              setNatural({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            style={{
              width: displayWidth ? `${displayWidth}px` : "auto",
              height: displayHeight ? `${displayHeight}px` : "auto",
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
          <div className={styles.grid} aria-hidden="true" />
        </div>

        <div className={styles.controls}>
          <span className={styles.zoomIcon} aria-hidden="true">
            −
          </span>
          <input
            type="range"
            className={styles.slider}
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) =>
              applyZoom(Number(event.target.value), frame.width / 2, frame.height / 2)
            }
            aria-label="Zoom"
          />
          <span className={styles.zoomIcon} aria-hidden="true">
            +
          </span>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => onCancel?.()}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={!natural}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
