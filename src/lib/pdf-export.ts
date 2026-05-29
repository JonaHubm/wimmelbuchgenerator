import { PDFDocument, PageSizes, StandardFonts, degrees, rgb } from "pdf-lib";
import {
  BookPage,
  ProjectConfig,
  SearchTarget,
  characterInitials,
  dataUrlBase64,
  dataUrlMimeType,
  targetKindLabels,
} from "@/lib/wimmelbuch";

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

function fitRect(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  cover = true,
) {
  const imageRatio = imageWidth / imageHeight;
  const frameRatio = frameWidth / frameHeight;
  const scale = cover
    ? imageRatio > frameRatio
      ? frameHeight / imageHeight
      : frameWidth / imageWidth
    : imageRatio > frameRatio
      ? frameWidth / imageWidth
      : frameHeight / imageHeight;

  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    width,
    height,
    x: (frameWidth - width) / 2,
    y: (frameHeight - height) / 2,
  };
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function embedDataUrlImage(pdf: PDFDocument, dataUrl: string) {
  const bytes = base64ToBytes(dataUrlBase64(dataUrl));
  const mimeType = dataUrlMimeType(dataUrl);
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;

  if (isPng || mimeType.includes("png")) {
    return pdf.embedPng(bytes);
  }

  if (isJpeg || mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return pdf.embedJpg(bytes);
  }

  try {
    return await pdf.embedPng(bytes);
  } catch {
    return pdf.embedJpg(bytes);
  }
}

function drawWrappedText({
  page,
  text,
  x,
  y,
  maxWidth,
  font,
  size,
  lineHeight,
  color,
}: {
  page: ReturnType<PDFDocument["addPage"]>;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  size: number;
  lineHeight: number;
  color: ReturnType<typeof rgb>;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  lines.slice(0, 4).forEach((line, index) => {
    page.drawText(line, { x, y: y - index * lineHeight, size, font, color });
  });
}

type PdfExportOptions = {
  coverVariantId?: string | null;
};

function uniqueTargets(pages: BookPage[]) {
  const targets = new Map<string, SearchTarget>();

  pages.forEach((page) => {
    page.characters.forEach((target) => {
      if (!targets.has(target.id)) {
        targets.set(target.id, target);
      }
    });
  });

  return Array.from(targets.values());
}

async function estimateDataUrlBrightness(dataUrl: string) {
  if (typeof document === "undefined") {
    return 0.5;
  }

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = dataUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const context = canvas.getContext("2d");

    if (!context) {
      return 0.5;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let luminance = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      luminance += (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255;
    }

    return luminance / (pixels.length / 4);
  } catch {
    return 0.5;
  }
}

async function drawContainedImage({
  pdf,
  page,
  dataUrl,
  x,
  y,
  width,
  height,
}: {
  pdf: PDFDocument;
  page: ReturnType<PDFDocument["addPage"]>;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const image = await embedDataUrlImage(pdf, dataUrl);
  const fit = fitRect(image.width, image.height, width, height, false);
  page.drawImage(image, {
    x: x + fit.x,
    y: y + fit.y,
    width: fit.width,
    height: fit.height,
  });
}

async function drawFullBleedImage({
  pdf,
  page,
  dataUrl,
  width,
  height,
}: {
  pdf: PDFDocument;
  page: ReturnType<PDFDocument["addPage"]>;
  dataUrl: string;
  width: number;
  height: number;
}) {
  const image = await embedDataUrlImage(pdf, dataUrl);
  const fit = fitRect(image.width, image.height, width, height, true);
  page.drawImage(image, {
    x: fit.x,
    y: fit.y,
    width: fit.width,
    height: fit.height,
  });
}

function drawMockOverlay({
  page,
  bookPage,
  pageWidth,
  pageHeight,
  bold,
}: {
  page: ReturnType<PDFDocument["addPage"]>;
  bookPage: BookPage;
  pageWidth: number;
  pageHeight: number;
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
}) {
  if (bookPage.variant.generatedImage) {
    return;
  }

  bookPage.variant.doodles.slice(0, 120).forEach((doodle) => {
    const x = (doodle.x / 100) * pageWidth;
    const y = pageHeight - (doodle.y / 100) * pageHeight;
    const color = hexToRgb(doodle.color);
    const radius = 2.5 + doodle.size * 2.3;

    if (doodle.shape === "house") {
      page.drawRectangle({
        x: x - radius,
        y: y - radius,
        width: radius * 2,
        height: radius * 1.5,
        color,
        opacity: doodle.opacity,
        rotate: degrees(doodle.rotation),
      });
    } else if (doodle.shape === "tree") {
      page.drawSvgPath(`M ${x} ${y + radius} L ${x - radius} ${y - radius} L ${x + radius} ${y - radius} Z`, {
        color,
        opacity: doodle.opacity,
        rotate: degrees(doodle.rotation),
      });
    } else {
      page.drawCircle({ x, y, size: radius, color, opacity: doodle.opacity });
    }
  });

  bookPage.variant.targets.forEach((target) => {
    const character = bookPage.characters.find((item) => item.id === target.characterId);
    const x = (target.x / 100) * pageWidth;
    const y = pageHeight - (target.y / 100) * pageHeight;
    const color = hexToRgb(character?.color ?? "#ef476f");
    page.drawRectangle({
      x: x - 8,
      y: y - 8,
      width: 16,
      height: 16,
      color,
      opacity: 0.9,
      rotate: degrees(target.rotation),
    });
    page.drawText(characterInitials(character?.name ?? ""), {
      x: x - 5,
      y: y - 4,
      size: 7,
      font: bold,
      color: rgb(0.05, 0.05, 0.05),
    });
  });
}

export async function createBookPdf(project: ProjectConfig, pages: BookPage[], options: PdfExportOptions = {}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [a4Width, a4Height] = PageSizes.A4;
  const [pageWidth, pageHeight] =
    project.format === "portrait"
      ? [a4Width, a4Height]
      : project.format === "square"
        ? [680, 680]
        : [a4Height, a4Width];

  if (pages.length === 0) {
    return pdf.save();
  }

  const coverBookPage =
    pages.find((page) => page.variant.id === options.coverVariantId) ?? pages[0];
  const coverImage = coverBookPage.variant.generatedImage ?? coverBookPage.sourceImage;
  const brightness = await estimateDataUrlBrightness(coverImage);
  const darkTitle = brightness > 0.54;
  const titleColor = darkTitle ? rgb(0.05, 0.05, 0.05) : rgb(1, 1, 1);
  const titlePanelColor = darkTitle ? rgb(1, 1, 1) : rgb(0.02, 0.02, 0.02);

  const cover = pdf.addPage([pageWidth, pageHeight]);
  await drawFullBleedImage({ pdf, page: cover, dataUrl: coverImage, width: pageWidth, height: pageHeight });
  cover.drawRectangle({
    x: 40,
    y: pageHeight - 186,
    width: pageWidth - 80,
    height: 138,
    color: titlePanelColor,
    opacity: 0.58,
  });
  drawWrappedText({
    page: cover,
    text: project.title,
    x: 58,
    y: pageHeight - 94,
    maxWidth: pageWidth - 116,
    size: 42,
    lineHeight: 44,
    font: bold,
    color: titleColor,
  });
  cover.drawText(project.creator, {
    x: 60,
    y: pageHeight - 164,
    size: 16,
    font: bold,
    color: titleColor,
  });

  for (const bookPage of pages) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.98, 0.97, 0.94) });
    await drawFullBleedImage({
      pdf,
      page,
      dataUrl: bookPage.variant.generatedImage ?? bookPage.sourceImage,
      width: pageWidth,
      height: pageHeight,
    });
    drawMockOverlay({ page, bookPage, pageWidth, pageHeight, bold });
  }

  const backcover = pdf.addPage([pageWidth, pageHeight]);
  const margin = 46;
  const targets = uniqueTargets(pages);
  backcover.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.96, 0.95, 0.91) });
  backcover.drawText(project.title, {
    x: margin,
    y: pageHeight - 72,
    size: 24,
    font: bold,
    color: rgb(0.72, 0.08, 0.1),
  });
  drawWrappedText({
    page: backcover,
    text: `${project.title} contains ${pages.length} Wimmelbuch scenes. Search for these recurring targets on every generated page.`,
    x: margin,
    y: pageHeight - 108,
    maxWidth: pageWidth - margin * 2,
    font,
    size: 13,
    lineHeight: 17,
    color: rgb(0.12, 0.12, 0.12),
  });

  const cardWidth = (pageWidth - margin * 2 - 22) / 2;
  const cardHeight = 76;
  const firstCardY = pageHeight - 214;

  for (const [index, target] of targets.entries()) {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + column * (cardWidth + 22);
    const y = firstCardY - row * (cardHeight + 14);

    backcover.drawRectangle({
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.82, 0.8, 0.75),
      borderWidth: 1,
    });

    if (target.referenceImage) {
      await drawContainedImage({
        pdf,
        page: backcover,
        dataUrl: target.referenceImage,
        x: x + 10,
        y: y + 12,
        width: 52,
        height: 52,
      });
    } else {
      backcover.drawRectangle({ x: x + 10, y: y + 12, width: 52, height: 52, color: hexToRgb(target.color) });
      backcover.drawText(characterInitials(target.name), {
        x: x + 24,
        y: y + 33,
        size: 13,
        font: bold,
        color: rgb(0.04, 0.04, 0.04),
      });
    }

    backcover.drawText(targetKindLabels[target.kind ?? "person"], {
      x: x + 74,
      y: y + 52,
      size: 8,
      font: bold,
      color: rgb(0.45, 0.45, 0.45),
    });
    backcover.drawText(target.name, {
      x: x + 74,
      y: y + 36,
      size: 12,
      font: bold,
      color: rgb(0.05, 0.05, 0.05),
      maxWidth: cardWidth - 84,
    });
    drawWrappedText({
      page: backcover,
      text: target.scaleHint ? `${target.clue} Scale: ${target.scaleHint}` : target.clue,
      x: x + 74,
      y: y + 21,
      maxWidth: cardWidth - 84,
      font,
      size: 7,
      lineHeight: 8,
      color: rgb(0.32, 0.32, 0.32),
    });
  }

  const sponsorY = 72;
  backcover.drawText("Sponsors & supporters", {
    x: margin,
    y: sponsorY + 84,
    size: 14,
    font: bold,
    color: rgb(0.12, 0.12, 0.12),
  });
  backcover.drawRectangle({
    x: margin,
    y: sponsorY,
    width: pageWidth - margin * 2,
    height: 68,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.78, 0.76, 0.7),
    borderWidth: 1,
  });
  ["Logo", "Supporter", "Partner", "Thanks"].forEach((label, index) => {
    const width = (pageWidth - margin * 2 - 42) / 4;
    const x = margin + 10 + index * (width + 8);
    backcover.drawRectangle({
      x,
      y: sponsorY + 14,
      width,
      height: 40,
      borderColor: rgb(0.82, 0.8, 0.75),
      borderWidth: 1,
    });
    backcover.drawText(label, {
      x: x + 10,
      y: sponsorY + 31,
      size: 8,
      font: bold,
      color: rgb(0.55, 0.55, 0.55),
    });
  });
  backcover.drawText(`Created by ${project.creator}`, {
    x: margin,
    y: 34,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });

  return pdf.save();
}
