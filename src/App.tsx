import { useEffect, useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Download,
  Eraser,
  Palette,
  RefreshCcw,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";
import cardsData from "./data/sts2-ironclad-cards.generated.json";
import { cardTypeLabels, defaultTiers, rarityLabels, STORAGE_KEY } from "./defaults";
import { exportRankingPngBlob } from "./exportBoard";
import { formatGameText } from "./gameText";
import {
  createInitialState,
  findContainer,
  getContainerItems,
  hydrateState,
  moveCardBetweenContainers,
  reorderContainer,
  updateTierSettings,
} from "./state";
import type { Card, ContainerId, RankingState, Tier } from "./types";

const cards = cardsData as Card[];

function readSavedState(): RankingState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RankingState) : null;
  } catch {
    return null;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function SortableCard({ card, compact = false }: { card: Card; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`card-tile ${compact ? "card-tile--compact" : ""} ${isDragging ? "is-dragging" : ""}`}
      data-testid={`card-${card.id}`}
      {...attributes}
      {...listeners}
    >
      <img src={card.imagePath} alt={card.name} draggable={false} />
      <div className="card-meta">
        <div className="card-meta__line">
          <strong>{card.name}</strong>
          <span>{card.energy ?? "X"}</span>
        </div>
        <p>{formatGameText(card.description)}</p>
      </div>
    </article>
  );
}

function CardPreview({ card }: { card: Card }) {
  return (
    <article className="card-tile card-tile--preview">
      <img src={card.imagePath} alt={card.name} draggable={false} />
      <div className="card-meta">
        <div className="card-meta__line">
          <strong>{card.name}</strong>
          <span>{card.energy ?? "X"}</span>
        </div>
      </div>
    </article>
  );
}

function DroppableList({
  id,
  cardIds,
  cardsById,
  compact,
  className = "",
}: {
  id: ContainerId;
  cardIds: string[];
  cardsById: Map<string, Card>;
  compact?: boolean;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <SortableContext items={cardIds} strategy={rectSortingStrategy}>
      <div ref={setNodeRef} className={`drop-zone ${isOver ? "is-over" : ""} ${className}`} data-testid={`drop-${id}`}>
        {cardIds.map((cardId) => {
          const card = cardsById.get(cardId);
          return card ? <SortableCard key={card.id} card={card} compact={compact} /> : null;
        })}
      </div>
    </SortableContext>
  );
}

function TierSettingsPanel({
  tier,
  onChange,
  onClose,
}: {
  tier: Tier;
  onChange: (patch: Pick<Tier, "label" | "color">) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(tier.label);
  const [color, setColor] = useState(tier.color);

  useEffect(() => {
    setLabel(tier.label);
    setColor(tier.color);
  }, [tier]);

  return (
    <aside className="settings-panel" aria-label="层级设置">
      <div className="settings-panel__header">
        <Palette size={18} />
        <strong>层级</strong>
        <button className="icon-button" type="button" onClick={onClose} title="关闭">
          <X size={18} />
        </button>
      </div>
      <label>
        <span>名称</span>
        <input
          value={label}
          maxLength={8}
          onChange={(event) => {
            setLabel(event.target.value);
            onChange({ label: event.target.value.trim() || tier.label, color });
          }}
        />
      </label>
      <label>
        <span>颜色</span>
        <input
          type="color"
          value={color}
          onChange={(event) => {
            setColor(event.target.value);
            onChange({ label: label.trim() || tier.label, color: event.target.value });
          }}
        />
      </label>
    </aside>
  );
}

function App() {
  const [state, setState] = useState<RankingState>(() => hydrateState(cards, readSavedState()));
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), []);
  const activeCard = activeCardId ? cardsById.get(activeCardId) ?? null : null;
  const selectedTier = state.tiers.find((tier) => tier.id === selectedTierId) ?? null;

  const visibleUnrankedIds = useMemo(() => {
    const query = search.trim().toLowerCase();
    return state.unrankedCardIds.filter((cardId) => {
      const card = cardsById.get(cardId);
      if (!card) return false;
      const matchSearch =
        !query ||
        card.name.toLowerCase().includes(query) ||
        card.id.toLowerCase().includes(query) ||
        formatGameText(card.description).toLowerCase().includes(query);
      const matchType = typeFilter === "all" || card.cardType === typeFilter;
      const matchRarity = rarityFilter === "all" || card.rarity === rarityFilter;
      return matchSearch && matchType && matchRarity;
    });
  }, [cardsById, rarityFilter, search, state.unrankedCardIds, typeFilter]);

  const cardTypes = useMemo(() => Array.from(new Set(cards.map((card) => card.cardType))).sort(), []);
  const rarities = useMemo(() => Array.from(new Set(cards.map((card) => card.rarity))).sort(), []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) return;

    const fromContainer = findContainer(state, activeId);
    const toContainer = findContainer(state, overId);
    if (!fromContainer || !toContainer || fromContainer === toContainer) return;

    setState((current) =>
      moveCardBetweenContainers(current, activeId, fromContainer, toContainer, overId === toContainer ? undefined : overId),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveCardId(null);
    if (!overId) return;

    const containerId = findContainer(state, activeId);
    if (!containerId) return;

    const items = getContainerItems(state, containerId);
    const oldIndex = items.indexOf(activeId);
    const newIndex = items.indexOf(overId);
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      setState((current) => reorderContainer(current, containerId, arrayMove(items, oldIndex, newIndex)));
    }
  }

  function resetRanking() {
    setState((current) => ({
      tiers: current.tiers.map((tier) => ({ ...tier, cardIds: [] })),
      unrankedCardIds: cards.map((card) => card.id),
      updatedAt: new Date().toISOString(),
    }));
  }

  function resetTiers() {
    setState((current) => ({
      ...current,
      tiers: defaultTiers.map((tier) => ({
        ...tier,
        cardIds: current.tiers.find((currentTier) => currentTier.id === tier.id)?.cardIds ?? [],
      })),
      updatedAt: new Date().toISOString(),
    }));
  }

  function restoreEverything() {
    setState(createInitialState(cards));
    setSearch("");
    setTypeFilter("all");
    setRarityFilter("all");
  }

  async function exportImage() {
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await exportRankingPngBlob(state, cardsById);
      downloadBlob(blob, `从夯到拉-铁甲战士-${new Date().toISOString().slice(0, 10)}.png`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      console.error("导出失败", error);
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }

  if (cards.length === 0) {
    return (
      <main className="empty-app">
        <h1>从夯到拉</h1>
        <p>先运行 npm run scrape:sts2 生成铁甲战士卡牌数据。</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>从夯到拉</h1>
          <p>杀戮尖塔 2 · 铁甲战士 · {cards.length} 张</p>
        </div>
        {exportError ? <p className="topbar__error">导出失败：{exportError}</p> : null}
        <div className="topbar__actions">
          <button className="toolbar-button" type="button" onClick={exportImage} disabled={isExporting}>
            <Download size={18} />
            <span>{isExporting ? "导出中" : "导出图片"}</span>
          </button>
          <button className="icon-button" type="button" onClick={resetRanking} title="清空排名">
            <Eraser size={18} />
          </button>
          <button className="icon-button" type="button" onClick={resetTiers} title="恢复层级">
            <RefreshCcw size={18} />
          </button>
          <button className="icon-button" type="button" onClick={restoreEverything} title="全部重置">
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveCardId(null)}
      >
        <section className="workspace">
          <div className="tier-board" data-testid="tier-board">
            {state.tiers.map((tier) => (
              <section className="tier-row" key={tier.id}>
                <div className="tier-label" style={{ backgroundColor: tier.color }}>
                  <strong>{tier.label}</strong>
                  <button
                    className="tier-label__settings"
                    type="button"
                    onClick={() => setSelectedTierId(tier.id)}
                    title="设置层级"
                  >
                    <Settings size={20} />
                  </button>
                </div>
                <DroppableList id={tier.id} cardIds={tier.cardIds} cardsById={cardsById} compact />
              </section>
            ))}
          </div>

          <aside className="side-rail">
            {selectedTier ? (
              <TierSettingsPanel
                tier={selectedTier}
                onChange={(patch) => setState((current) => updateTierSettings(current, selectedTier.id, patch))}
                onClose={() => setSelectedTierId(null)}
              />
            ) : null}
            <section className="pool-panel">
              <div className="pool-panel__header">
                <div>
                  <h2>未排名</h2>
                  <p>
                    {visibleUnrankedIds.length} / {state.unrankedCardIds.length}
                  </p>
                </div>
                <SlidersHorizontal size={18} />
              </div>
              <div className="filters">
                <label className="search-box">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="搜索卡牌"
                  />
                </label>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="类型">
                  <option value="all">全部类型</option>
                  {cardTypes.map((type) => (
                    <option key={type} value={type}>
                      {cardTypeLabels[type] ?? type}
                    </option>
                  ))}
                </select>
                <select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value)} aria-label="稀有度">
                  <option value="all">全部稀有度</option>
                  {rarities.map((rarity) => (
                    <option key={rarity} value={rarity}>
                      {rarityLabels[rarity] ?? rarity}
                    </option>
                  ))}
                </select>
              </div>
              <DroppableList id="unranked" cardIds={visibleUnrankedIds} cardsById={cardsById} className="pool-grid" />
            </section>
          </aside>
        </section>

        <DragOverlay>{activeCard ? <CardPreview card={activeCard} /> : null}</DragOverlay>
      </DndContext>
    </main>
  );
}

export default App;
