import { pdf } from "pdf-to-img";
import { promises as fs } from "fs";

export interface PageImage {
  pageNumber: number;
  base64: string;
  mimeType: string;
}

export interface PdfProcessorOptions {
  scale?: number;
}

const DEFAULT_OPTIONS: Required<PdfProcessorOptions> = {
  scale: 2.0, // 2x scale for good quality
};

/**
 * Convert specific pages of a PDF to base64 images
 */
export async function convertPdfPagesToImages(
  pdfPath: string,
  pageNumbers: number[],
  options: PdfProcessorOptions = {}
): Promise<PageImage[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const images: PageImage[] = [];
  const pageSet = new Set(pageNumbers);

  try {
    const pdfBuffer = await fs.readFile(pdfPath);
    const document = await pdf(pdfBuffer, { scale: opts.scale });

    let pageIndex = 1;
    for await (const image of document) {
      if (pageSet.has(pageIndex)) {
        // image is a Buffer containing PNG data
        const base64 = image.toString("base64");
        images.push({
          pageNumber: pageIndex,
          base64,
          mimeType: "image/png",
        });
      }
      pageIndex++;
    }
  } catch (err) {
    console.error("Failed to convert PDF pages:", err);
    throw err;
  }

  // Sort by page number to maintain order
  images.sort((a, b) => a.pageNumber - b.pageNumber);

  return images;
}

/**
 * Convert a range of pages to images
 */
export async function convertPdfPageRange(
  pdfPath: string,
  startPage: number,
  endPage: number,
  options: PdfProcessorOptions = {}
): Promise<PageImage[]> {
  const pageNumbers = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );
  return convertPdfPagesToImages(pdfPath, pageNumbers, options);
}

/**
 * Convert PDF buffer to images (for file uploads)
 */
export async function convertPdfBufferToImages(
  pdfBuffer: Buffer,
  pageNumbers: number[],
  options: PdfProcessorOptions = {}
): Promise<PageImage[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const images: PageImage[] = [];
  const pageSet = new Set(pageNumbers);

  try {
    const document = await pdf(pdfBuffer, { scale: opts.scale });

    let pageIndex = 1;
    for await (const image of document) {
      if (pageSet.has(pageIndex)) {
        const base64 = image.toString("base64");
        images.push({
          pageNumber: pageIndex,
          base64,
          mimeType: "image/png",
        });
      }
      pageIndex++;
    }
  } catch (err) {
    console.error("Failed to convert PDF buffer:", err);
    throw err;
  }

  images.sort((a, b) => a.pageNumber - b.pageNumber);

  return images;
}

/**
 * Get total page count of a PDF
 */
export async function getPdfPageCount(pdfPath: string): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const pdfBuffer = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  return pdfDoc.getPageCount();
}
