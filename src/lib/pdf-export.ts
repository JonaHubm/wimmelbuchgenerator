import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import {
  characterInitials,
  dataUrlBase64,
  dataUrlMimeType,
  targetKindLabels,
} from "@/lib/wimmelbuch";
import type { BookPage, ProjectConfig, SearchTarget } from "@/lib/wimmelbuch";

function mm(value: number) {
  return (value * 72) / 25.4;
}

const COVER_WRAP = {
  width: mm(475),
  height: mm(332),
  bleed: mm(15),
  panelWidth: mm(215),
  panelHeight: mm(302),
  spineWidth: mm(15),
  safe: mm(15),
};

const BOOK_BLOCK = {
  pageWidth: mm(216),
  pageHeight: mm(303),
  trimWidth: mm(210),
  trimHeight: mm(297),
  bleed: mm(3),
  outerSafe: mm(10),
  bindingSafe: mm(15),
};

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
  maxLines = 4,
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
  maxLines?: number;
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

  lines.slice(0, maxLines).forEach((line, index) => {
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
  x = 0,
  y = 0,
  width,
  height,
}: {
  pdf: PDFDocument;
  page: ReturnType<PDFDocument["addPage"]>;
  dataUrl: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
}) {
  const image = await embedDataUrlImage(pdf, dataUrl);
  const fit = fitRect(image.width, image.height, width, height, true);
  page.drawImage(image, {
    x: x + fit.x,
    y: y + fit.y,
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
  xOffset = 0,
}: {
  page: ReturnType<PDFDocument["addPage"]>;
  bookPage: BookPage;
  pageWidth: number;
  pageHeight: number;
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  xOffset?: number;
}) {
  if (bookPage.variant.generatedImage) {
    return;
  }

  bookPage.variant.doodles.slice(0, 120).forEach((doodle) => {
    const x = (doodle.x / 100) * pageWidth - xOffset;
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
    const x = (target.x / 100) * pageWidth - xOffset;
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
  const targets = uniqueTargets(pages);
  const backCoverText =
    project.backCoverText?.trim() ||
    `${project.title} contains ${pages.length} Wimmelbuch scenes. Search for the recurring targets hidden across the book.`;
  const introText =
    project.introText?.trim() ||
    `Welcome to ${project.title}. Every spread is full of local details, tiny stories, and recurring search targets.`;

  const cover = pdf.addPage([COVER_WRAP.width, COVER_WRAP.height]);
  const backPanel = {
    x: COVER_WRAP.bleed,
    y: COVER_WRAP.bleed,
    width: COVER_WRAP.panelWidth,
    height: COVER_WRAP.panelHeight,
  };
  const spinePanel = {
    x: backPanel.x + backPanel.width,
    y: 0,
    width: COVER_WRAP.spineWidth,
    height: COVER_WRAP.height,
  };
  const frontPanel = {
    x: spinePanel.x + spinePanel.width,
    y: COVER_WRAP.bleed,
    width: COVER_WRAP.panelWidth,
    height: COVER_WRAP.panelHeight,
  };
  const frontImageArea = {
    x: frontPanel.x,
    y: 0,
    width: frontPanel.width + COVER_WRAP.bleed,
    height: COVER_WRAP.height,
  };

  cover.drawRectangle({
    x: 0,
    y: 0,
    width: COVER_WRAP.width,
    height: COVER_WRAP.height,
    color: rgb(0.96, 0.95, 0.91),
  });
  cover.drawRectangle({
    x: 0,
    y: 0,
    width: spinePanel.x,
    height: COVER_WRAP.height,
    color: rgb(0.96, 0.95, 0.91),
  });
  await drawFullBleedImage({
    pdf,
    page: cover,
    dataUrl: coverImage,
    x: frontImageArea.x,
    y: frontImageArea.y,
    width: frontImageArea.width,
    height: frontImageArea.height,
  });
  cover.drawRectangle({
    x: spinePanel.x,
    y: spinePanel.y,
    width: spinePanel.width,
    height: spinePanel.height,
    color: rgb(0.72, 0.08, 0.1),
  });

  const frontSafeX = frontPanel.x + COVER_WRAP.safe;
  const frontSafeWidth = frontPanel.width - COVER_WRAP.safe * 2;
  const frontTitleHeight = mm(72);
  const frontTitleY = frontPanel.y + frontPanel.height - COVER_WRAP.safe - frontTitleHeight;

  cover.drawRectangle({
    x: frontSafeX,
    y: frontTitleY,
    width: frontSafeWidth,
    height: frontTitleHeight,
    color: titlePanelColor,
    opacity: 0.62,
  });
  drawWrappedText({
    page: cover,
    text: project.title,
    x: frontSafeX + mm(7),
    y: frontTitleY + frontTitleHeight - mm(20),
    maxWidth: frontSafeWidth - mm(14),
    size: 30,
    lineHeight: 32,
    font: bold,
    color: titleColor,
    maxLines: 2,
  });
  cover.drawText(project.creator, {
    x: frontSafeX + mm(7),
    y: frontTitleY + mm(11),
    size: 12,
    font: bold,
    color: titleColor,
    maxWidth: frontSafeWidth - mm(14),
  });

  const spineTitle = project.title.slice(0, 64);
  const spineCreator = project.creator.slice(0, 48);
  const spineTitleSize = 12;
  const spineCreatorSize = 7;
  cover.drawText(spineTitle, {
    x: spinePanel.x + spinePanel.width * 0.66,
    y: (COVER_WRAP.height - bold.widthOfTextAtSize(spineTitle, spineTitleSize)) / 2,
    size: spineTitleSize,
    font: bold,
    color: rgb(1, 1, 1),
    rotate: degrees(90),
  });
  cover.drawText(spineCreator, {
    x: spinePanel.x + spinePanel.width * 0.33,
    y: (COVER_WRAP.height - font.widthOfTextAtSize(spineCreator, spineCreatorSize)) / 2,
    size: spineCreatorSize,
    font,
    color: rgb(1, 1, 1),
    rotate: degrees(90),
  });

  const backSafeX = backPanel.x + COVER_WRAP.safe;
  const backSafeTop = backPanel.y + backPanel.height - COVER_WRAP.safe;
  const backSafeWidth = backPanel.width - COVER_WRAP.safe * 2;

  cover.drawText(project.title, {
    x: backSafeX,
    y: backSafeTop - mm(5),
    size: 19,
    font: bold,
    color: rgb(0.72, 0.08, 0.1),
    maxWidth: backSafeWidth,
  });
  drawWrappedText({
    page: cover,
    text: backCoverText,
    x: backSafeX,
    y: backSafeTop - mm(18),
    maxWidth: backSafeWidth,
    font,
    size: 9.5,
    lineHeight: 12,
    color: rgb(0.12, 0.12, 0.12),
    maxLines: 6,
  });

  const cardGap = mm(3);
  const cardHeight = mm(21);
  const legendTop = backSafeTop - mm(86);
  for (const [index, target] of targets.slice(0, 5).entries()) {
    const y = legendTop - index * (cardHeight + cardGap);
    cover.drawRectangle({
      x: backSafeX,
      y,
      width: backSafeWidth,
      height: cardHeight,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.82, 0.8, 0.75),
      borderWidth: 0.7,
    });

    if (target.referenceImage) {
      await drawContainedImage({
        pdf,
        page: cover,
        dataUrl: target.referenceImage,
        x: backSafeX + mm(3),
        y: y + mm(2.5),
        width: mm(16),
        height: mm(16),
      });
    } else {
      cover.drawRectangle({
        x: backSafeX + mm(3),
        y: y + mm(2.5),
        width: mm(16),
        height: mm(16),
        color: hexToRgb(target.color),
      });
      cover.drawText(characterInitials(target.name), {
        x: backSafeX + mm(7),
        y: y + mm(8),
        size: 7,
        font: bold,
        color: rgb(0.04, 0.04, 0.04),
      });
    }

    cover.drawText(targetKindLabels[target.kind ?? "person"], {
      x: backSafeX + mm(23),
      y: y + mm(13),
      size: 5.8,
      font: bold,
      color: rgb(0.45, 0.45, 0.45),
    });
    cover.drawText(target.name, {
      x: backSafeX + mm(23),
      y: y + mm(7.2),
      size: 8.5,
      font: bold,
      color: rgb(0.05, 0.05, 0.05),
      maxWidth: backSafeWidth - mm(26),
    });
    drawWrappedText({
      page: cover,
      text: target.clue,
      x: backSafeX + mm(23),
      y: y + mm(3.3),
      maxWidth: backSafeWidth - mm(26),
      font,
      size: 5.4,
      lineHeight: 6,
      color: rgb(0.32, 0.32, 0.32),
      maxLines: 1,
    });
  }

  const sponsorY = backPanel.y + COVER_WRAP.safe;
  cover.drawText("Sponsors & supporters", {
    x: backSafeX,
    y: sponsorY + mm(31),
    size: 9,
    font: bold,
    color: rgb(0.12, 0.12, 0.12),
  });
  cover.drawRectangle({
    x: backSafeX,
    y: sponsorY,
    width: backSafeWidth,
    height: mm(26),
    color: rgb(1, 1, 1),
    borderColor: rgb(0.78, 0.76, 0.7),
    borderWidth: 0.7,
  });
  ["Logo", "Supporter", "Partner", "Thanks"].forEach((label, index) => {
    const boxWidth = (backSafeWidth - mm(10.5)) / 4;
    const x = backSafeX + mm(2.5) + index * (boxWidth + mm(2));
    cover.drawRectangle({
      x,
      y: sponsorY + mm(5),
      width: boxWidth,
      height: mm(15),
      borderColor: rgb(0.82, 0.8, 0.75),
      borderWidth: 0.6,
    });
    cover.drawText(label, {
      x: x + mm(2.5),
      y: sponsorY + mm(11),
      size: 5.5,
      font: bold,
      color: rgb(0.55, 0.55, 0.55),
      maxWidth: boxWidth - mm(5),
    });
  });

  const intro = pdf.addPage([BOOK_BLOCK.pageWidth, BOOK_BLOCK.pageHeight]);
  intro.drawRectangle({
    x: 0,
    y: 0,
    width: BOOK_BLOCK.pageWidth,
    height: BOOK_BLOCK.pageHeight,
    color: rgb(0.98, 0.97, 0.94),
  });
  const introX = BOOK_BLOCK.bleed + BOOK_BLOCK.bindingSafe;
  const introTop = BOOK_BLOCK.pageHeight - BOOK_BLOCK.bleed - mm(28);
  const introWidth = BOOK_BLOCK.trimWidth - BOOK_BLOCK.bindingSafe - BOOK_BLOCK.outerSafe;
  intro.drawText(project.title, {
    x: introX,
    y: introTop,
    size: 25,
    font: bold,
    color: rgb(0.72, 0.08, 0.1),
    maxWidth: introWidth,
  });
  intro.drawText(project.creator, {
    x: introX,
    y: introTop - mm(13),
    size: 11,
    font: bold,
    color: rgb(0.2, 0.2, 0.2),
    maxWidth: introWidth,
  });
  drawWrappedText({
    page: intro,
    text: introText,
    x: introX,
    y: introTop - mm(34),
    maxWidth: introWidth,
    font,
    size: 11,
    lineHeight: 15,
    color: rgb(0.12, 0.12, 0.12),
    maxLines: 12,
  });
  intro.drawText("Search targets", {
    x: introX,
    y: mm(102),
    size: 13,
    font: bold,
    color: rgb(0.12, 0.12, 0.12),
  });
  targets.slice(0, 5).forEach((target, index) => {
    const x = introX + (index % 3) * mm(50);
    const y = mm(72) - Math.floor(index / 3) * mm(30);
    intro.drawRectangle({
      x,
      y,
      width: mm(39),
      height: mm(22),
      color: rgb(1, 1, 1),
      borderColor: rgb(0.82, 0.8, 0.75),
      borderWidth: 0.6,
    });
    intro.drawRectangle({
      x: x + mm(3),
      y: y + mm(5),
      width: mm(12),
      height: mm(12),
      color: hexToRgb(target.color),
    });
    intro.drawText(target.name, {
      x: x + mm(18),
      y: y + mm(12),
      size: 6.8,
      font: bold,
      color: rgb(0.05, 0.05, 0.05),
      maxWidth: mm(18),
    });
    intro.drawText(targetKindLabels[target.kind ?? "person"], {
      x: x + mm(18),
      y: y + mm(6),
      size: 5.2,
      font,
      color: rgb(0.42, 0.42, 0.42),
      maxWidth: mm(18),
    });
  });

  const spreadWidth = BOOK_BLOCK.pageWidth * 2;
  const spreadHeight = BOOK_BLOCK.pageHeight;
  for (const bookPage of pages) {
    const dataUrl = bookPage.variant.generatedImage ?? bookPage.sourceImage;
    const image = await embedDataUrlImage(pdf, dataUrl);
    const fit = fitRect(image.width, image.height, spreadWidth, spreadHeight, true);

    for (const side of [0, 1]) {
      const page = pdf.addPage([BOOK_BLOCK.pageWidth, BOOK_BLOCK.pageHeight]);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: BOOK_BLOCK.pageWidth,
        height: BOOK_BLOCK.pageHeight,
        color: rgb(0.98, 0.97, 0.94),
      });
      page.drawImage(image, {
        x: fit.x - side * BOOK_BLOCK.pageWidth,
        y: fit.y,
        width: fit.width,
        height: fit.height,
      });
      drawMockOverlay({
        page,
        bookPage,
        pageWidth: spreadWidth,
        pageHeight: spreadHeight,
        bold,
        xOffset: side * BOOK_BLOCK.pageWidth,
      });
    }
  }

  return pdf.save();
}
