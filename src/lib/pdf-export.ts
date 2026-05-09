import { PDFDocument, PageSizes, StandardFonts, degrees, rgb } from "pdf-lib";
import {
  BookPage,
  ProjectConfig,
  characterInitials,
  dataUrlBase64,
  dataUrlMimeType,
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

export async function createBookPdf(project: ProjectConfig, pages: BookPage[]) {
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

  const cover = pdf.addPage([pageWidth, pageHeight]);
  cover.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.96, 0.94, 0.88) });
  cover.drawText(project.title, {
    x: 54,
    y: pageHeight - 110,
    size: 42,
    font: bold,
    color: rgb(0.04, 0.04, 0.04),
    maxWidth: pageWidth - 108,
  });
  cover.drawText(project.creator, {
    x: 56,
    y: pageHeight - 146,
    size: 16,
    font,
    color: rgb(0.26, 0.26, 0.26),
  });
  cover.drawText(`${pages.length} pages`, {
    x: 56,
    y: 70,
    size: 18,
    font: bold,
    color: rgb(0.04, 0.04, 0.04),
  });

  for (const [index, bookPage] of pages.entries()) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.98, 0.97, 0.94) });

    const margin = 28;
    const headerHeight = 52;
    const searchStripHeight = 94;
    const imageFrame = {
      x: margin,
      y: searchStripHeight + margin,
      width: pageWidth - margin * 2,
      height: pageHeight - headerHeight - searchStripHeight - margin * 2,
    };

    page.drawText(`Page ${index + 1}`, {
      x: margin,
      y: pageHeight - 38,
      size: 16,
      font: bold,
      color: rgb(0.04, 0.04, 0.04),
    });
    page.drawText(bookPage.variant.treatment, {
      x: pageWidth - margin - 240,
      y: pageHeight - 38,
      size: 11,
      font,
      color: rgb(0.32, 0.32, 0.32),
    });

    const sourceImage = await embedDataUrlImage(pdf, bookPage.variant.generatedImage ?? bookPage.sourceImage);
    const fit = fitRect(sourceImage.width, sourceImage.height, imageFrame.width, imageFrame.height, true);
    page.drawImage(sourceImage, {
      x: imageFrame.x + fit.x,
      y: imageFrame.y + fit.y,
      width: fit.width,
      height: fit.height,
    });
    page.drawRectangle({
      x: imageFrame.x,
      y: imageFrame.y,
      width: imageFrame.width,
      height: imageFrame.height,
      borderColor: rgb(0.05, 0.05, 0.05),
      borderWidth: 1,
      opacity: 0.14,
    });

    if (!bookPage.variant.generatedImage) {
      bookPage.variant.doodles.slice(0, 120).forEach((doodle) => {
        const x = imageFrame.x + (doodle.x / 100) * imageFrame.width;
        const y = imageFrame.y + imageFrame.height - (doodle.y / 100) * imageFrame.height;
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
        const x = imageFrame.x + (target.x / 100) * imageFrame.width;
        const y = imageFrame.y + imageFrame.height - (target.y / 100) * imageFrame.height;
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

    page.drawRectangle({
      x: margin,
      y: margin,
      width: pageWidth - margin * 2,
      height: searchStripHeight - 14,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.08, 0.08, 0.08),
      borderWidth: 1,
    });
    page.drawText("Find", { x: margin + 18, y: searchStripHeight - 6, size: 14, font: bold, color: rgb(0.04, 0.04, 0.04) });

    bookPage.characters.forEach((character, characterIndex) => {
      const columnWidth = (pageWidth - margin * 2 - 52) / Math.max(1, bookPage.characters.length);
      const x = margin + 18 + characterIndex * columnWidth;
      const y = margin + 38;
      page.drawRectangle({ x, y, width: 24, height: 24, color: hexToRgb(character.color), opacity: 0.95 });
      page.drawText(characterInitials(character.name), { x: x + 6, y: y + 8, size: 8, font: bold, color: rgb(0.04, 0.04, 0.04) });
      page.drawText(character.name, { x: x + 32, y: y + 13, size: 9, font: bold, color: rgb(0.05, 0.05, 0.05) });
      drawWrappedText({
        page,
        text: character.clue,
        x: x + 32,
        y: y + 1,
        maxWidth: Math.max(80, columnWidth - 38),
        font,
        size: 7,
        lineHeight: 8,
        color: rgb(0.32, 0.32, 0.32),
      });
    });
  }

  return pdf.save();
}
