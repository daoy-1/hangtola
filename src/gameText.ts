export function formatGameText(text: string) {
  return text
    .replace(/\{(?:Energy|energyPrefix):energyIcons\((\d+)\)\}/g, "$1 能量")
    .replace(/\{Cards:diff\(\)\}/g, "若干")
    .replace(/\[energy:(\d+)\]/g, "$1 能量")
    .replace(/\[(?:blue|gold|green|red|purple|white|gray)\]/g, "")
    .replace(/\[\/(?:blue|gold|green|red|purple|white|gray)\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
