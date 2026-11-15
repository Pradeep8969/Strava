import type { ChosenPhoto } from "./avatar";
import {
  MAX_AVATAR_BYTES,
  validateAvatar,
} from "../features/athlete/edit-profile";
export async function recoverAvatarSelection(): Promise<ChosenPhoto | null> {
  return null;
}
async function readPhoto(file: Blob): Promise<ChosenPhoto> {
  if (file.size > MAX_AVATAR_BYTES)
    throw new Error("Choose a photo smaller than 5 MB.");
  validateAvatar(new Uint8Array(await file.arrayBuffer()), file.type);
  const uri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Photo could not be read."));
    reader.readAsDataURL(file);
  });
  return { uri, mime: file.type, data: uri.split(",")[1] };
}
export function chooseAvatar(camera: boolean): Promise<ChosenPhoto | null> {
  if (camera) return capture();
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.setAttribute("aria-label", "Choose profile picture");
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (file) void readPhoto(file).then(resolve, reject);
      else resolve(null);
    };
    input.addEventListener("cancel", () => {
      input.remove();
      resolve(null);
    });
    input.style.display = "none";
    document.body.append(input);
    input.click();
  });
}
async function capture(): Promise<ChosenPhoto | null> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
    throw new Error(
      "Camera requires HTTPS and a supported browser. Use Choose Existing instead.",
    );
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
  } catch {
    throw new Error(
      "Camera access was denied or no camera is available. Check browser permissions or choose an existing picture.",
    );
  }
  return new Promise((resolve, reject) => {
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", "Take profile picture");
    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.cssText = "max-width:100%;width:360px";
    const snap = document.createElement("button");
    snap.textContent = "Use this photo";
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel camera";
    const previous = document.activeElement as HTMLElement | null;
    const close = () => {
      stream.getTracks().forEach((track) => track.stop());
      dialog.close();
      dialog.remove();
      previous?.focus();
    };
    cancel.onclick = () => {
      close();
      resolve(null);
    };
    dialog.oncancel = (event) => {
      event.preventDefault();
      close();
      resolve(null);
    };
    snap.onclick = () => {
      if (!video.videoWidth) return;
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1024 / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      canvas
        .getContext("2d")!
        .drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          close();
          if (blob) void readPhoto(blob).then(resolve, reject);
          else reject(new Error("Camera photo could not be read."));
        },
        "image/jpeg",
        0.8,
      );
    };
    dialog.append(video, snap, cancel);
    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}
