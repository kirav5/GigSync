import { readQrInPhoto } from "./camera.js";

/**
 * Reading the Secure QR off an e-Aadhaar PDF (myAadhaar → Download Aadhaar), on the phone: pdf.js opens it with its
 * password and draws page 1 large enough for the dense QR's squares, then the same reader as a photo finds it. The
 * file, the password and the drawing live only in memory for the length of the read; nothing is kept or sent. pdf.js
 * is loaded only here, the first time someone chooses a PDF.
 */

/** Why a PDF gave no QR text. */
export const PdfProblem = {
  /** The password does not open it (or none was typed and it needs one). */
  password: "password",
  /** Not a PDF pdf.js can open, or far bigger than an e-Aadhaar. */
  not_pdf: "not_pdf",
  /** Opened, but no QR code was found on its first page. */
  no_qr: "no_qr",
} as const;
export type PdfProblem = (typeof PdfProblem)[keyof typeof PdfProblem];

export type PdfQr = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly problem: PdfProblem };

/** An e-Aadhaar PDF is a few hundred KB; anything past this is not one. */
export const MAX_AADHAAR_PDF_BYTES = 5 * 1024 * 1024;
/** pdf.js draws at 72 points to the inch; 4x gives the big QR's squares about 3 pixels each on an A4 page. */
const RENDER_SCALE = 4;
/** The page the e-Aadhaar's QR is printed on. */
const FIRST_PAGE = 1;
const PASSWORD_EXCEPTION = "PasswordException";
const CANVAS_2D = "2d";
const PNG = "image/png";
/** A Secure QR holds one long decimal number; any other QR on the page (a link, an older XML one) is not it. */
const SECURE_QR = /^\d{100,}$/;

/** Loads pdf.js and points it at its worker, once; both stay out of the app's first load. */
let library: Promise<typeof import("pdfjs-dist")> | undefined;
function pdfjs() {
  library ??= Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]).then(
    ([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    },
  );
  return library;
}

/** The first page drawn on a canvas, or a problem when the PDF does not open. */
async function firstPage(file: File, password: string): Promise<HTMLCanvasElement | PdfProblem> {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = lib.getDocument({ data, password, isEvalSupported: false });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(FIRST_PAGE);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return canvas;
  } catch (err) {
    // pdf.js's exceptions come back from its worker as plain objects with a name, not Error instances.
    const name = typeof err === "object" && err !== null && "name" in err ? err.name : undefined;
    return name === PASSWORD_EXCEPTION ? PdfProblem.password : PdfProblem.not_pdf;
  } finally {
    // pdf.js moved `data` into its worker (the buffer here is detached); destroying the task frees it there.
    await task.destroy();
  }
}

/** A part of the canvas as a PNG, for the photo reader. */
function part(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number): Promise<Blob | null> {
  const cut = document.createElement("canvas");
  cut.width = width;
  cut.height = height;
  cut.getContext(CANVAS_2D)?.drawImage(canvas, x, y, width, height, 0, 0, width, height);
  return new Promise((resolve) => cut.toBlob(resolve, PNG));
}

/**
 * The Secure QR's text from an e-Aadhaar PDF. The whole page first; if that finds another QR or none, each half and
 * quarter, since a reader returns the first code it sees and a page can carry more than one.
 */
export async function readQrInPdf(file: File, password: string): Promise<PdfQr> {
  if (file.size > MAX_AADHAAR_PDF_BYTES) return { ok: false, problem: PdfProblem.not_pdf };
  const canvas = await firstPage(file, password);
  if (!(canvas instanceof HTMLCanvasElement)) return { ok: false, problem: canvas };
  const { width: w, height: h } = canvas;
  const [halfW, halfH] = [Math.floor(w / 2), Math.floor(h / 2)];
  const areas: [number, number, number, number][] = [
    [0, 0, w, h],
    [0, halfH, w, h - halfH],
    [0, 0, w, halfH],
    [halfW, halfH, w - halfW, h - halfH],
    [0, halfH, halfW, h - halfH],
  ];
  try {
    for (const [x, y, width, height] of areas) {
      const png = await part(canvas, x, y, width, height);
      const text = png ? await readQrInPhoto(png).catch(() => undefined) : undefined;
      if (text && SECURE_QR.test(text.trim())) return { ok: true, text };
    }
    return { ok: false, problem: PdfProblem.no_qr };
  } finally {
    canvas.width = 0;
  }
}
