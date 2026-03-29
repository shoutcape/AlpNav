import { Container, Graphics, Text } from "pixi.js";
import type { MapLabel } from "@/lib/domain/types";

// Returns one Container per tier [tier1, tier2, tier3, tier4].
// Callers control visibility of each based on viewport scale.
export function drawLabelOverlay(container: Container, labels: MapLabel[]): [Container, Container, Container, Container] {
  const tierContainers = [
    new Container(),
    new Container(),
    new Container(),
    new Container(),
  ] as [Container, Container, Container, Container];

  tierContainers[0].label = "labels-tier1";
  tierContainers[1].label = "labels-tier2";
  tierContainers[2].label = "labels-tier3";
  tierContainers[3].label = "labels-tier4";

  // Group labels by tier
  const byTier: [MapLabel[], MapLabel[], MapLabel[], MapLabel[]] = [[], [], [], []];

  for (const label of labels) {
    byTier[label.tier - 1].push(label);
  }

  for (let t = 0; t < 4; t++) {
    const tc = tierContainers[t];
    const g = new Graphics();

    const BG_PAD = 2;

    // Background pass — deduplicate boxes that are shared by multiple labels
    const drawnBgs = new Set<string>();
    for (const label of byTier[t]) {
      if (label.bgColor === undefined || label.bgX === undefined || label.bgY === undefined || label.bgW === undefined || label.bgH === undefined) {
        continue;
      }

      const key = `${label.bgX},${label.bgY},${label.bgW},${label.bgH}`;
      if (drawnBgs.has(key)) continue;
      drawnBgs.add(key);

      g.rect(label.bgX - BG_PAD, label.bgY - BG_PAD, label.bgW + BG_PAD * 2, label.bgH + BG_PAD * 2);
      g.fill({ color: label.bgColor });
      g.stroke({ width: 1, color: 0x000000, alpha: 0.5 });
    }

    tc.addChild(g);

    // Text pass
    for (const label of byTier[t]) {
      const text = new Text({
        text: label.text,
        style: {
          fontFamily: "Arial",
          fontSize: label.fontSize,
          fontWeight: label.fontWeight,
          fill: label.color,
        },
      });
      text.x = label.x;

      if (label.bgY !== undefined) {
        // SVG y = baseline; PixiJS anchor(0,0.5) = vertical center.
        // Ascent is ~0.7× fontSize, so center ≈ baseline − 0.35× fontSize.
        text.anchor.set(0, 0.5);
        text.y = label.y - label.fontSize * 0.35;
      } else {
        text.anchor.set(0, 1);
        text.y = label.y;
      }

      tc.addChild(text);
    }

    container.addChild(tc);
  }

  return tierContainers;
}
