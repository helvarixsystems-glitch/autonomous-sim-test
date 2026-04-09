export type CellType =
  | "empty"
  | "hazard"
  | "start"
  | "goal"
  | "path"
  | "rover";

export interface Cell {
  x: number;
  y: number;
  type: CellType;
  cost: number;
}

export interface Metrics {
  exploredNodes: number;
  pathLength: number;
  totalCost: number;
  solved: boolean;
}

export interface DemoOptions {
  width: number;
  height: number;
  hazardRate: number;
}

const defaultOptions: DemoOptions = {
  width: 24,
  height: 16,
  hazardRate: 0.18,
};

// ---------- Utility ----------

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  // Manhattan distance
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

// ---------- Grid Generation ----------

function createGrid(options: DemoOptions): Cell[][] {
  const grid: Cell[][] = [];

  for (let y = 0; y < options.height; y++) {
    const row: Cell[] = [];

    for (let x = 0; x < options.width; x++) {
      const isEdge =
        x === 0 ||
        y === 0 ||
        x === options.width - 1 ||
        y === options.height - 1;

      const hazard = !isEdge && Math.random() < options.hazardRate;

      row.push({
        x,
        y,
        type: hazard ? "hazard" : "empty",
        cost: hazard ? Infinity : 1,
      });
    }

    grid.push(row);
  }

  // Start
  grid[1][1].type = "start";
  grid[1][1].cost = 1;

  // Goal
  const gx = options.width - 2;
  const gy = options.height - 2;
  grid[gy][gx].type = "goal";
  grid[gy][gx].cost = 1;

  return grid;
}

// ---------- Neighbor Lookup ----------

function neighbors(grid: Cell[][], x: number, y: number): Cell[] {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  const result: Cell[] = [];

  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;

    if (
      ny >= 0 &&
      ny < grid.length &&
      nx >= 0 &&
      nx < grid[0].length
    ) {
      const cell = grid[ny][nx];
      if (cell.cost < Infinity) {
        result.push(cell);
      }
    }
  }

  return result;
}

// ---------- A* Pathfinding ----------

function findPath(grid: Cell[][]): { path: Cell[]; metrics: Metrics } {
  const start = grid[1][1];
  const goal = grid[grid.length - 2][grid[0].length - 2];

  const open: Array<{ x: number; y: number; f: number }> = [
    { x: start.x, y: start.y, f: 0 },
  ];

  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  gScore.set(key(start.x, start.y), 0);

  const visited = new Set<string>();

  let exploredNodes = 0;

  while (open.length > 0) {
    // Sort by lowest f score
    open.sort((a, b) => a.f - b.f);

    const current = open.shift();
    if (!current) break;

    const currentKey = key(current.x, current.y);

    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    exploredNodes++;

    // Goal reached
    if (current.x === goal.x && current.y === goal.y) {
      const path: Cell[] = [];
      let walkKey: string | undefined = currentKey;

      while (walkKey) {
        const [px, py] = walkKey.split(",").map(Number);
        path.push(grid[py][px]);
        walkKey = cameFrom.get(walkKey);
      }

      path.reverse();

      const totalCost = path.reduce((sum, c) => sum + c.cost, 0);

      return {
        path,
        metrics: {
          exploredNodes,
          pathLength: path.length,
          totalCost,
          solved: true,
        },
      };
    }

    for (const next of neighbors(grid, current.x, current.y)) {
      const nextKey = key(next.x, next.y);

      const tentative =
        (gScore.get(currentKey) ?? Infinity) + next.cost;

      if (tentative < (gScore.get(nextKey) ?? Infinity)) {
        cameFrom.set(nextKey, currentKey);
        gScore.set(nextKey, tentative);

        const f =
          tentative +
          heuristic(next.x, next.y, goal.x, goal.y);

        open.push({
          x: next.x,
          y: next.y,
          f,
        });
      }
    }
  }

  // No solution
  return {
    path: [],
    metrics: {
      exploredNodes,
      pathLength: 0,
      totalCost: 0,
      solved: false,
    },
  };
}

// ---------- Visualization ----------

function render(
  container: HTMLElement,
  grid: Cell[][],
  metrics: Metrics
): void {
  const cellSize = 28;
  container.innerHTML = "";

  const title = document.createElement("h1");
  title.textContent =
    "Helvarix Autonomous Simulator — Proof of Concept";
  container.appendChild(title);

  const description = document.createElement("p");
  description.textContent =
    "Terrain generation, hazard avoidance, A* pathfinding, rover traversal, and mission metrics.";
  container.appendChild(description);

  const stats = document.createElement("div");
  stats.innerHTML = `
    <strong>Solved:</strong> ${metrics.solved ? "Yes" : "No"}<br/>
    <strong>Explored Nodes:</strong> ${metrics.exploredNodes}<br/>
    <strong>Path Length:</strong> ${metrics.pathLength}<br/>
    <strong>Total Cost:</strong> ${metrics.totalCost}
  `;
  container.appendChild(stats);

  const board = document.createElement("div");
  board.style.display = "grid";
  board.style.gridTemplateColumns = `repeat(${grid[0].length}, ${cellSize}px)`;
  board.style.gap = "2px";
  board.style.marginTop = "16px";

  for (const row of grid) {
    for (const cell of row) {
      const el = document.createElement("div");

      el.style.width = `${cellSize}px`;
      el.style.height = `${cellSize}px`;
      el.style.borderRadius = "4px";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontSize = "12px";
      el.style.color = "white";

      switch (cell.type) {
        case "hazard":
          el.style.background = "#7a1f1f";
          el.textContent = "H";
          break;
        case "start":
          el.style.background = "#0f766e";
          el.textContent = "S";
          break;
        case "goal":
          el.style.background = "#1d4ed8";
          el.textContent = "G";
          break;
        case "path":
          el.style.background = "#7c3aed";
          el.textContent = "•";
          break;
        case "rover":
          el.style.background = "#f59e0b";
          el.textContent = "R";
          break;
        default:
          el.style.background = "#334155";
      }

      board.appendChild(el);
    }
  }

  container.appendChild(board);
}

// ---------- Path Marking ----------

function stampPath(grid: Cell[][], path: Cell[]): void {
  for (const cell of path) {
    if (cell.type === "empty") {
      cell.type = "path";
    }
  }

  if (path.length > 1) {
    const roverCell = path[1];
    if (roverCell.type === "path") {
      roverCell.type = "rover";
    }
  }
}

// ---------- Main Runner ----------

export function runDemo(
  rootId = "app",
  options: DemoOptions = defaultOptions
): void {
  const root = document.getElementById(rootId);
  if (!root) {
    throw new Error(`Missing root element: ${rootId}`);
  }

  let attempts = 0;
  let grid = createGrid(options);
  let result = findPath(grid);

  // Retry until solvable terrain
  while (!result.metrics.solved && attempts < 20) {
    grid = createGrid(options);
    result = findPath(grid);
    attempts++;
  }

  stampPath(grid, result.path);
  render(root, grid, result.metrics);
}

// Auto-run in browser
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    runDemo();
  });
}
