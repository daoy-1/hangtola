import {
  closestCenter,
  pointerWithin,
  type Collision,
  type CollisionDetection,
  type UniqueIdentifier,
} from "@dnd-kit/core";

function sortableContainerId(collision: Collision) {
  const sortable = collision.data?.droppableContainer.data.current?.sortable;
  return typeof sortable?.containerId === "string" ? sortable.containerId : null;
}

export function createLaneCollisionDetection(laneIds: Set<UniqueIdentifier>): CollisionDetection {
  return (args) => {
    const pointerCollisions = pointerWithin(args);
    const laneCollision = pointerCollisions.find((collision) => laneIds.has(collision.id));

    if (!laneCollision) {
      return closestCenter(args);
    }

    const laneId = laneCollision.id;
    const sameLaneCollisions = pointerCollisions.filter(
      (collision) => collision.id === laneId || sortableContainerId(collision) === laneId,
    );
    const cardCollisions = sameLaneCollisions.filter((collision) => collision.id !== laneId);

    return cardCollisions.length > 0 ? [...cardCollisions, laneCollision] : [laneCollision];
  };
}
