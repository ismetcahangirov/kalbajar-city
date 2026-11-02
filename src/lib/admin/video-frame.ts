/**
 * A video's poster frame, captured in the browser (#25): the server has no
 * video decoder, so the console draws a frame on a canvas and uploads it as
 * an image. A stored video is read with CORS (`pnpm storage:setup` allows GET
 * from the site's origins); without it the canvas could not be read.
 */

/** Where the automatic poster is taken: 1 s in, or 10 % of a shorter video. */
export function posterTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, duration * 0.1);
}

const timeoutMs = 20_000;

function once(target: EventTarget, type: string): Promise<void> {
  return new Promise((resolve) => target.addEventListener(type, () => resolve(), { once: true }));
}

/**
 * The frame at `time` seconds (by default `posterTime`) of the video at
 * `src`, a stored file's URL or a local file's object URL, as a JPEG.
 * Rejects when the browser cannot decode the video or read the frame.
 */
export async function captureFrame(src: string, { time }: { time?: number } = {}): Promise<Blob> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  if (!src.startsWith("blob:")) video.crossOrigin = "anonymous";

  let timer: ReturnType<typeof setTimeout> | undefined;
  const failed = new Promise<never>((_, reject) => {
    video.addEventListener("error", () => reject(new Error("The video could not be decoded")), {
      once: true,
    });
    timer = setTimeout(() => reject(new Error("Capturing the frame timed out")), timeoutMs);
  });
  // Raced below; once a frame is out, a late failure has no one to tell.
  failed.catch(() => {});

  try {
    const loaded = once(video, "loadeddata");
    video.src = src;
    await Promise.race([loaded, failed]);

    const target = Math.min(time ?? posterTime(video.duration), Math.max(0, video.duration - 0.05));
    if (target > 0 && Math.abs(video.currentTime - target) > 0.01) {
      const seeked = once(video, "seeked");
      video.currentTime = target;
      await Promise.race([seeked, failed]);
    }

    const { videoWidth: width, videoHeight: height } = video;
    if (!width || !height) throw new Error("The video has no frame size");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    context.drawImage(video, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("The frame could not be encoded"))),
        "image/jpeg",
        0.9,
      ),
    );
  } finally {
    clearTimeout(timer);
    video.removeAttribute("src");
    video.load();
  }
}
