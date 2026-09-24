"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ImageCropper.module.css";
import ThemedModal from "./ThemedModal";
import { makePollImagePath, uploadPollImage } from "../lib/storageImages";

const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 1280;

export default function ImageCropper({
  imageSrc,
  onCropComplete,
  onCancel,
  forThumbnail,
}) {
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const [imageMeta, setImageMeta] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [noticeDialog, setNoticeDialog] = useState(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  }, [imageSrc]);

  const getImageLayout = () => {
    if (!imageMeta || !stageSize.width || !stageSize.height) return null;

    const coverScale = Math.max(
      stageSize.width / imageMeta.width,
      stageSize.height / imageMeta.height
    );
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

  const clampPosition = (nextPosition, nextZoom = zoom) => {
    if (!imageMeta || !stageSize.width || !stageSize.height) return nextPosition;

    const coverScale = Math.max(
      stageSize.width / imageMeta.width,
      stageSize.height / imageMeta.height
    );
    const width = imageMeta.width * coverScale * nextZoom;
    const height = imageMeta.height * coverScale * nextZoom;
    const maxX = Math.max(0, (width - stageSize.width) / 2);
    const maxY = Math.max(0, (height - stageSize.height) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, nextPosition.x)),
      y: Math.min(maxY, Math.max(-maxY, nextPosition.y)),
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
    ctx.fillStyle = "#071127";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sourceX = Math.max(0, -layout.left / layout.scale);
    const sourceY = Math.max(0, -layout.top / layout.scale);
    const sourceWidth = Math.min(
      imageMeta.width - sourceX,
      stageSize.width / layout.scale
    );
    const sourceHeight = Math.min(
      imageMeta.height - sourceY,
      stageSize.height / layout.scale
    );

    const destX = layout.left > 0 ? (layout.left / stageSize.width) * OUTPUT_WIDTH : 0;
    const destY = layout.top > 0 ? (layout.top / stageSize.height) * OUTPUT_HEIGHT : 0;
    const destWidth = (sourceWidth * layout.scale / stageSize.width) * OUTPUT_WIDTH;
    const destHeight = (sourceHeight * layout.scale / stageSize.height) * OUTPUT_HEIGHT;

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      destX,
      destY,
      destWidth,
      destHeight
    );

    return new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
  };

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current) return;

    setPosition(
      clampPosition({
        x: dragRef.current.startX + event.clientX - dragRef.current.x,
        y: dragRef.current.startY + event.clientY - dragRef.current.y,
      })
    );
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleZoom = (delta) => {
    setZoom((value) => {
      const nextZoom = Math.max(1, Math.min(4, Number((value + delta).toFixed(2))));
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
  const previewPosition = {
    x: `${Math.max(0, Math.min(100, 50 - (position.x / Math.max(stageSize.width, 1)) * 70))}%`,
    y: `${Math.max(0, Math.min(100, 50 - (position.y / Math.max(stageSize.height, 1)) * 70))}%`,
  };
  const previewStyle = {
    objectPosition: `${previewPosition.x} ${previewPosition.y}`,
    transform: `scale(${Math.min(1.24, Math.max(1, zoom * 0.18 + 0.88))})`,
  };

  return (
    <div className={styles.cropperOverlay}>
      <div className={styles.cropperBox}>
        <div className={styles.cropperHeader}>
          <div>
            <h2 className={styles.cropperTitle}>
              Crop {forThumbnail ? "Poll Cover" : "Option Image"}
            </h2>
            <p className={styles.cropperHint}>
              Make your image look great on desktop and mobile.
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onCancel} type="button">
            Close
          </button>
        </div>

        <div className={styles.cropperGrid}>
          <div>
            <div
              ref={stageRef}
              className={styles.stage}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={(event) => {
                event.preventDefault();
                handleZoom(event.deltaY > 0 ? -0.08 : 0.08);
              }}
            >
              <img
                ref={imageRef}
                src={imageSrc}
                alt=""
                className={styles.sourceImage}
                draggable={false}
                onLoad={(event) => {
                  setImageMeta({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
                }}
                style={
                  layout
                    ? {
                        width: `${layout.width}px`,
                        height: `${layout.height}px`,
                        transform: `translate(${layout.left}px, ${layout.top}px)`,
                      }
                    : undefined
                }
              />
              <div className={styles.frameOverlay} />
              <div className={styles.safeArea} />
            </div>

            <div className={styles.controls}>
              <button className={styles.zoomBtn} onClick={() => handleZoom(-0.15)} type="button">
                Zoom Out
              </button>
              <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
              <button className={styles.zoomBtn} onClick={() => handleZoom(0.15)} type="button">
                Zoom In
              </button>
              <button className={styles.resetBtn} onClick={handleReset} type="button">
                Reset crop
              </button>
            </div>
          </div>

          <div className={styles.previewPane} aria-label="Crop previews">
            <h3 className={styles.previewTitle}>Preview</h3>
            <p className={styles.previewHint}>One crop, two live card ratios.</p>

            <div className={styles.previewCards}>
              <div className={styles.previewCard}>
                <span>Desktop</span>
                <div className={`${styles.previewImageFrame} ${styles.desktopPreview}`}>
                  <img src={imageSrc} alt="" style={previewStyle} />
                </div>
                <strong>Option image</strong>
              </div>

              <div className={styles.previewCard}>
                <span>Mobile</span>
                <div className={`${styles.previewImageFrame} ${styles.mobilePreview}`}>
                  <img src={imageSrc} alt="" style={previewStyle} />
                </div>
                <strong>Option image</strong>
              </div>
            </div>

            <p className={styles.safeHint}>
              Keep the subject inside the inner guide so it survives tighter mobile crops.
            </p>
          </div>
        </div>

        <div className={styles.cropperActions}>
          <button className={styles.cropBtn} onClick={handleCrop} type="button" disabled={isUploading}>
            {isUploading ? "Uploading..." : "Crop & Done"}
          </button>
          <button className={styles.cancelBtn} onClick={onCancel} type="button" disabled={isUploading}>
            Cancel
          </button>
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
  );
}
