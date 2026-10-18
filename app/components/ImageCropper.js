"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./ImageCropper.module.css";
import ThemedModal from "./ThemedModal";
import { makePollImagePath, uploadPollImage } from "../lib/storageImages";
import { POLL_IMAGE_ASPECT_RATIO } from "../lib/pollImageFrame";

const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / POLL_IMAGE_ASPECT_RATIO);
const MAX_ZOOM = 4;

export default function ImageCropper({ imageSrc, onCropComplete, onCancel, forThumbnail }) {
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const [imageMeta, setImageMeta] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [noticeDialog, setNoticeDialog] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMounted]);

  const measureStage = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
  }, []);

  useLayoutEffect(() => {
    if (!isMounted) return;
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(measureStage);
    measureStage();
    observer.observe(stage);
    return () => observer.disconnect();
  }, [isMounted, measureStage]);

  useEffect(() => {
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  }, [imageSrc]);

  const getCoverScale = () => {
    if (!imageMeta || !stageSize.width || !stageSize.height) return 0;
    return Math.max(stageSize.width / imageMeta.width, stageSize.height / imageMeta.height);
  };

  const clampPosition = (nextPosition, nextZoom = zoom) => {
    const coverScale = getCoverScale();
    if (!coverScale) return nextPosition;
    const width = imageMeta.width * coverScale * nextZoom;
    const height = imageMeta.height * coverScale * nextZoom;
    const maxX = Math.max(0, (width - stageSize.width) / 2);
    const maxY = Math.max(0, (height - stageSize.height) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, nextPosition.x)),
      y: Math.min(maxY, Math.max(-maxY, nextPosition.y)),
    };
  };

  const getImageLayout = () => {
    const coverScale = getCoverScale();
    if (!coverScale) return null;
    const scale = coverScale * zoom;
    const width = imageMeta.width * scale;
    const height = imageMeta.height * scale;
    return {
      scale,
      width,
      height,
      left: stageSize.width / 2 - width / 2 + position.x,
      top: stageSize.height / 2 - height / 2 + position.y,
    };
  };

  const renderCrop = () => {
    const img = imageRef.current;
    const layout = getImageLayout();
    if (!img || !layout) return Promise.resolve(null);
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext("2d");
    const sourceX = Math.max(0, -layout.left / layout.scale);
    const sourceY = Math.max(0, -layout.top / layout.scale);
    const sourceWidth = Math.min(imageMeta.width - sourceX, stageSize.width / layout.scale);
    const sourceHeight = Math.min(imageMeta.height - sourceY, stageSize.height / layout.scale);
    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  };

  const handlePointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), zoom };
      dragRef.current = null;
      return;
    }
    dragRef.current = { x: event.clientX, y: event.clientY, startX: position.x, startY: position.y };
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const nextZoom = Math.max(1, Math.min(MAX_ZOOM, pinchRef.current.zoom * distance / pinchRef.current.distance));
      setZoom(nextZoom);
      setPosition((current) => clampPosition(current, nextZoom));
      return;
    }
    if (!dragRef.current) return;
    setPosition(clampPosition({
      x: dragRef.current.startX + event.clientX - dragRef.current.x,
      y: dragRef.current.startY + event.clientY - dragRef.current.y,
    }));
  };

  const handlePointerUp = (event) => {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    dragRef.current = null;
    if (pointersRef.current.size === 1) {
      const [pointer] = pointersRef.current.values();
      dragRef.current = { x: pointer.x, y: pointer.y, startX: position.x, startY: position.y };
    }
  };

  const handleZoom = (delta) => {
    setZoom((value) => {
      const nextZoom = Math.max(1, Math.min(MAX_ZOOM, Number((value + delta).toFixed(2))));
      setPosition((current) => clampPosition(current, nextZoom));
      return nextZoom;
    });
  };

  const handleReset = () => {
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleCrop = async () => {
    if (isUploading) return;
    setIsUploading(true);
    try {
      const crop = await renderCrop();
      if (!crop) throw new Error("Could not crop this image.");
      const url = await uploadPollImage(crop, makePollImagePath());
      onCropComplete?.(url);
    } catch (err) {
      console.error("Image upload failed:", err);
      setNoticeDialog({ title: "Image upload failed", message: err?.message || "Please try again." });
    } finally {
      setIsUploading(false);
    }
  };

  const layout = getImageLayout();
  if (!isMounted) return null;

  return createPortal((
    <div className={styles.cropperOverlay}>
      <div className={styles.cropperBox}>
        <div className={styles.cropperHeader}>
          <div>
            <h2 className={styles.cropperTitle}>Crop {forThumbnail ? "Poll Cover" : "Option Image"}</h2>
            <p className={styles.cropperHint}>Drag to position. Use the buttons, scroll, or pinch to zoom.</p>
          </div>
          <button className={styles.closeBtn} onClick={onCancel} type="button">Close</button>
        </div>
        <div className={styles.cropperWorkArea}>
          <div
            ref={stageRef}
            className={styles.stage}
            style={{ aspectRatio: POLL_IMAGE_ASPECT_RATIO }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onLostPointerCapture={handlePointerUp}
            onWheel={(event) => { event.preventDefault(); handleZoom(event.deltaY > 0 ? -0.08 : 0.08); }}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt=""
              className={styles.sourceImage}
              draggable={false}
              onLoad={(event) => {
                setImageMeta({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
                measureStage();
              }}
              style={layout ? {
                width: `${layout.width}px`,
                height: `${layout.height}px`,
                transform: `translate(${layout.left}px, ${layout.top}px)`,
              } : undefined}
            />
          </div>
          <div className={styles.controls}>
            <button className={styles.zoomBtn} onClick={() => handleZoom(-0.15)} type="button">Zoom Out</button>
            <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
            <button className={styles.zoomBtn} onClick={() => handleZoom(0.15)} type="button">Zoom In</button>
            <button className={styles.resetBtn} onClick={handleReset} type="button">Reset</button>
          </div>
        </div>
        <div className={styles.cropperActions}>
          <button className={styles.cropBtn} onClick={handleCrop} type="button" disabled={isUploading}>
            {isUploading ? "Uploading..." : "Crop & Done"}
          </button>
          <button className={styles.cancelBtn} onClick={onCancel} type="button" disabled={isUploading}>Cancel</button>
        </div>
      </div>
      <ThemedModal
        open={Boolean(noticeDialog)}
        title={noticeDialog?.title}
        message={noticeDialog?.message}
        confirmLabel="OK"
        onConfirm={() => setNoticeDialog(null)}
      />
    </div>
  ), document.body);
}
