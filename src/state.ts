import { defaultTiers } from "./defaults";
import type { Card, ContainerId, RankingState, Tier } from "./types";

export function createInitialState(cards: Card[], now = new Date().toISOString()): RankingState {
  return {
    tiers: defaultTiers.map((tier) => ({ ...tier, cardIds: [] })),
    unrankedCardIds: cards.map((card) => card.id),
    updatedAt: now,
  };
}

export function hydrateState(cards: Card[], savedState: RankingState | null, now = new Date().toISOString()) {
  if (!savedState) {
    return createInitialState(cards, now);
  }

  const validIds = new Set(cards.map((card) => card.id));
  const assignedIds = new Set<string>();
  const tiers = defaultTiers.map((fallbackTier) => {
    const savedTier = savedState.tiers.find((tier) => tier.id === fallbackTier.id);
    const cardIds = (savedTier?.cardIds ?? []).filter((id) => {
      if (!validIds.has(id) || assignedIds.has(id)) return false;
      assignedIds.add(id);
      return true;
    });

    return {
      ...fallbackTier,
      label: savedTier?.label || fallbackTier.label,
      color: savedTier?.color || fallbackTier.color,
      cardIds,
    };
  });

  const unrankedCardIds = [
    ...(savedState.unrankedCardIds ?? []).filter((id) => {
      if (!validIds.has(id) || assignedIds.has(id)) return false;
      assignedIds.add(id);
      return true;
    }),
    ...cards.map((card) => card.id).filter((id) => !assignedIds.has(id)),
  ];

  return {
    tiers,
    unrankedCardIds,
    updatedAt: savedState.updatedAt || now,
  };
}

export function findContainer(state: RankingState, itemOrContainerId: string): ContainerId | null {
  if (itemOrContainerId === "unranked") return "unranked";
  if (state.tiers.some((tier) => tier.id === itemOrContainerId)) return itemOrContainerId;
  if (state.unrankedCardIds.includes(itemOrContainerId)) return "unranked";
  return state.tiers.find((tier) => tier.cardIds.includes(itemOrContainerId))?.id ?? null;
}

export function getContainerItems(state: RankingState, containerId: ContainerId) {
  if (containerId === "unranked") return state.unrankedCardIds;
  return state.tiers.find((tier) => tier.id === containerId)?.cardIds ?? [];
}

export function setContainerItems(state: RankingState, containerId: ContainerId, cardIds: string[]) {
  if (containerId === "unranked") {
    return { ...state, unrankedCardIds: cardIds };
  }

  return {
    ...state,
    tiers: state.tiers.map((tier) => (tier.id === containerId ? { ...tier, cardIds } : tier)),
  };
}

export function moveCardBetweenContainers(
  state: RankingState,
  activeId: string,
  fromContainer: ContainerId,
  toContainer: ContainerId,
  overId?: string,
  now = new Date().toISOString(),
) {
  const fromItems = getContainerItems(state, fromContainer);
  const toItems = getContainerItems(state, toContainer);
  const nextFromItems = fromItems.filter((id) => id !== activeId);
  const overIndex = overId && toItems.includes(overId) ? toItems.indexOf(overId) : toItems.length;
  const nextToItems = [...toItems.slice(0, overIndex), activeId, ...toItems.slice(overIndex)];

  return {
    ...setContainerItems(setContainerItems(state, fromContainer, nextFromItems), toContainer, nextToItems),
    updatedAt: now,
  };
}

export function reorderContainer(
  state: RankingState,
  containerId: ContainerId,
  cardIds: string[],
  now = new Date().toISOString(),
) {
  return {
    ...setContainerItems(state, containerId, cardIds),
    updatedAt: now,
  };
}

export function updateTierSettings(
  state: RankingState,
  tierId: string,
  patch: Pick<Tier, "label" | "color">,
  now = new Date().toISOString(),
) {
  return {
    ...state,
    tiers: state.tiers.map((tier) => (tier.id === tierId ? { ...tier, ...patch } : tier)),
    updatedAt: now,
  };
}
