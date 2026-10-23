"use client";

import { useState } from "react";
import type { MenuRead } from "@/lib/menu-handler";
import { Button, inputClass } from "./ui";

const ACCEPT = [
  "image/*",
  ".pdf",
  ".docx",
  ".xlsx",
  ".csv",
  ".txt",
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;
const MAX_PHOTO_SIDE = 2400;

/** Phone photos are often 5-10 MB; a 2400px JPEG keeps handwriting legible at a fraction of the upload. */
async function shrinkPhoto(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < SHRINK_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

async function post(body: BodyInit, json: boolean): Promise<MenuRead> {
  const res = await fetch("/api/menu", {
    method: "POST",
    body,
    ...(json ? { headers: { "content-type": "application/json" } } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `The menu could not be read (${res.status}).`);
  return data as MenuRead;
}

const UploadIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="shrink-0 text-accent-700 dark:text-accent-400">
    <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The upload and Google-link panels. Either one hands the dishes it read to `onRead`, with where they came from. */
export function MenuImport({
  mode,
  disabled,
  onRead,
}: {
  mode: "upload" | "link";
  disabled?: boolean;
  onRead: (read: MenuRead, from: string) => void;
}) {
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [link, setLink] = useState("");

  async function run(label: string, send: () => Promise<MenuRead>) {
    setBusy(label);
    setError(undefined);
    try {
      onRead(await send(), label);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The menu could not be read.");
    } finally {
      setBusy(undefined);
    }
  }

  function readFile(file: File | undefined) {
    if (!file) return;
    void run(file.name, async () => {
      const form = new FormData();
      form.set("file", await shrinkPhoto(file), file.name);
      return post(form, false);
    });
  }

  const status = (
    <>
      {busy && (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          Reading {busy}… this can take up to half a minute.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/60 dark:text-red-200">
          {error}
        </p>
      )}
    </>
  );

  if (mode === "link") {
    return (
      <div className="flex flex-col gap-3">
        <label htmlFor="menu-link" className="block font-medium">
          Google Docs or Sheets link
        </label>
        <div className="flex gap-2 max-sm:flex-col">
          <input
            id="menu-link"
            type="url"
            inputMode="url"
            className={`${inputClass} text-base`}
            placeholder="https://docs.google.com/spreadsheets/d/…/edit"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (link.trim()) void run("the document", () => post(JSON.stringify({ link }), true));
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="min-h-[44px] shrink-0"
            disabled={disabled || Boolean(busy) || !link.trim()}
            onClick={() => run("the document", () => post(JSON.stringify({ link }), true))}
          >
            Read menu
          </Button>
        </div>
        <p className="text-sm text-zinc-500">
          In Google, set Share → General access to &quot;Anyone with the link&quot; (Viewer). No Google sign-in is
          needed here.
        </p>
        {status}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy && !disabled) readFile(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-wrap items-center gap-4 rounded-2xl border-2 border-dashed p-6 transition ${
          dragging
            ? "border-accent-500 bg-accent-100 dark:bg-accent-950"
            : "border-accent-300 bg-accent-50 hover:border-accent-400 dark:border-accent-800 dark:bg-accent-950/40"
        }`}
      >
        <UploadIcon />
        <span className="min-w-0 flex-[1_1_240px]">
          <span className="block font-semibold">Upload a photo or file of your menu</span>
          <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">
            Photo, PDF, Word, Excel or CSV, up to 10 MB. Handwriting works if it is legible. The file goes to the
            language model to read and is not kept here.
          </span>
        </span>
        <span className="inline-flex min-h-[44px] items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold max-sm:w-full max-sm:justify-center dark:border-zinc-700 dark:bg-zinc-900">
          {busy ? "Reading…" : "Choose file"}
        </span>
        <input
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled || Boolean(busy)}
          onChange={(e) => {
            readFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {status}
    </div>
  );
}
