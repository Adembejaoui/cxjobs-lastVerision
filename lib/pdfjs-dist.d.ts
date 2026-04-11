/**
 * Type declarations for pdfjs-dist v2.x
 * Since the types are bundled in the package but TypeScript may not find them automatically
 */

declare module "pdfjs-dist/build/pdf" {
  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  export interface PDFPageProxy {
    getTextContent(): Promise<PDFTextContent>;
  }

  export interface PDFTextContent {
    items: PDFTextItem[];
  }

  export interface PDFTextItem {
    str: string;
  }

  export interface PDFDocumentInitParams {
    data: Buffer | Uint8Array | ArrayBuffer;
  }

  export interface GlobalWorkerOptions {
    workerSrc: string;
  }

  export function getDocument(
    params: PDFDocumentInitParams
  ): {
    promise: Promise<PDFDocumentProxy>;
  };

  export const GlobalWorkerOptions: GlobalWorkerOptions;
}
