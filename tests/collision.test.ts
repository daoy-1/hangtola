import { describe, expect, it } from "vitest";
import { createLaneCollisionDetection } from "../src/collision";

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

function droppable(id: string, containerId?: string) {
  return {
    id,
    disabled: false,
    data: { current: containerId ? { sortable: { containerId } } : {} },
  };
}

describe("lane collision detection", () => {
  it("prefers the lane under the pointer over nearby cards in adjacent lanes", () => {
    const detect = createLaneCollisionDetection(new Set(["top", "middle", "bottom"]));

    const collisions = detect({
      active: { id: "dragging-card" },
      collisionRect: rect(430, 375, 120, 160),
      droppableRects: new Map([
        ["top", rect(100, 0, 800, 360)],
        ["top-card", rect(420, 230, 120, 160)],
        ["middle", rect(100, 360, 800, 154)],
        ["bottom", rect(100, 514, 800, 360)],
        ["bottom-card", rect(420, 514, 120, 160)],
      ]),
      droppableContainers: [
        droppable("top"),
        droppable("top-card", "top"),
        droppable("middle"),
        droppable("bottom"),
        droppable("bottom-card", "bottom"),
      ],
      pointerCoordinates: { x: 500, y: 440 },
    } as never);

    expect(collisions[0]?.id).toBe("middle");
  });

  it("keeps card-level sorting when the pointer is over a card in the target lane", () => {
    const detect = createLaneCollisionDetection(new Set(["middle"]));

    const collisions = detect({
      active: { id: "dragging-card" },
      collisionRect: rect(430, 375, 120, 160),
      droppableRects: new Map([
        ["middle", rect(100, 360, 800, 154)],
        ["middle-card", rect(420, 370, 120, 130)],
      ]),
      droppableContainers: [droppable("middle"), droppable("middle-card", "middle")],
      pointerCoordinates: { x: 500, y: 440 },
    } as never);

    expect(collisions.map((collision) => collision.id)).toEqual(["middle-card", "middle"]);
  });
});
