export type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  /** Expo web: gerçek tarayıcı File nesnesi */
  file?: File;
};

function guessMime(name: string, fallback: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".heic")) return "image/heic";
  if (n.endsWith(".heif")) return "image/heif";
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return fallback;
}

export function isFormDataBody(body: unknown): boolean {
  if (body == null || typeof body !== "object") return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;
  return Object.prototype.toString.call(body) === "[object FormData]";
}

/** Native `{uri,name,type}` web’de multer’a gitmez; blob/File’a çevir. */
export async function appendFormFile(
  form: FormData,
  field: string,
  input: PickedFile | File,
  fallbackMime = "application/octet-stream",
) {
  if (typeof File !== "undefined" && input instanceof File) {
    form.append(field, input);
    return;
  }
  const f = input as PickedFile;
  if (typeof File !== "undefined" && f.file instanceof File) {
    form.append(field, f.file);
    return;
  }
  const uri = f.uri || "";
  const name = f.name || "upload.bin";
  const webUri =
    uri.startsWith("blob:") ||
    uri.startsWith("data:") ||
    uri.startsWith("http://") ||
    uri.startsWith("https://");
  if (typeof File !== "undefined" && webUri) {
    const res = await fetch(uri);
    const blob = await res.blob();
    const type = f.mimeType || blob.type || guessMime(name, fallbackMime);
    form.append(field, new File([blob], name, { type }));
    return;
  }
  form.append(field, {
    uri,
    name,
    type: f.mimeType || guessMime(name, fallbackMime),
  } as never);
}
