const defaultOptions = {
  width: 26,
  height: 18,
  hazardRate: 0.12,
  roughTerrainRate: 0.22,
  roverCount: 3,
  targetCount: 3,
  roverEnergy: 55,
};

const roverPalette = ["#f59e0b", "#06b6d4", "#a855f7", "#22c55e", "#ef4444"];

function key(x, y) {
  return `${x},${y}`;
}

function heuristic(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createGrid(options) {
  const grid = [];

  for (let y = 0; y < options.height; y++) {
    const row = [];

    for (let x = 0; x < options.width; x++) {
      const isEdge =
        x === 0 ||
        y === 0 ||
        x === options.width - 1 ||
        y === options.height - 1;

      const isHazard = !isEdge && Math.random() < options.hazardRate;
      const isRough =
        !isEdge && !isHazard && Math.random() < options.roughTerrainRate;

      let cost = 1;
      let roughness = 1;

      if (isHazard) {
        cost = Infinity;
        roughness = 999;
      } else if (isRough) {
        roughness = randInt(2, 5);
        cost = roughness;
      }

      row.push({
        x,
        y,
        type: isHazard ? "hazard" : "empty",
        cost,
        roughness,
      });
    }

    grid.push(row);
  }

  grid[1][1].type = "start";
  grid[1][1].cost = 1;
  grid[1][1].roughness = 1;

  return grid;
}

function isWalkable(cell) {
  return cell.cost < Infinity;
}

function neighbors(grid, x, y) {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  const result = [];

  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;

    if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
      const cell = grid[ny][nx];
      if (isWalkable(cell)) {
        result.push(cell);
      }
    }
  }

  return result;
}

function getRandomEmptyCell(grid, avoidRadius = 2) {
  const candidates = [];

  for (const row of grid) {
    for (const cell of row) {
      const nearStart =
        Math.abs(cell.x - 1) <= avoidRadius && Math.abs(cell.y - 1) <= avoidRadius;

      if (cell.type === "empty" && !nearStart) {
        candidates.push(cell);
      }
    }
  }

  if (candidates.length === 0) return null;
  return candidates[randInt(0, candidates.length - 1)];
}

function placeTargets(grid, count) {
  const targets = [];

  for (let i = 0; i < count; i++) {
    const cell = getRandomEmptyCell(grid, 3);
    if (!cell) break;

    cell.type = "target";
    targets.push({
      id: `T-${i + 1}`,
      x: cell.x,
      y: cell.y,
      reached: false,
    });
  }

  return targets;
}

function createRovers(count, roverEnergy) {
  const rovers = [];

  for (let i = 0; i < count; i++) {
    rovers.push({
      id: `R-${i + 1}`,
      x: 1,
      y: 1,
      energy: roverEnergy,
      maxEnergy: roverEnergy,
      assignedTargetIndex: null,
      path: [],
      completed: false,
      failed: false,
      color: roverPalette[i % roverPalette.length],
    });
  }

  return rovers;
}

function findPath(grid, startX, startY, goalX, goalY) {
  const open = [{ x: startX, y: startY, f: 0 }];
  const cameFrom = new Map();
  const gScore = new Map();
  gScore.set(key(startX, startY), 0);

  const visited = new Set();
  let exploredNodes = 0;

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    if (!current) break;

    const currentKey = key(current.x, current.y);
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);
    exploredNodes++;

    if (current.x === goalX && current.y === goalY) {
      const path = [];
      let walkKey = currentKey;

      while (walkKey) {
        const [px, py] = walkKey.split(",").map(Number);
        path.push(grid[py][px]);
        walkKey = cameFrom.get(walkKey);
      }

      path.reverse();

      const totalCost = path.reduce((sum, cell) => {
        if (cell.type === "start") return sum;
        return sum + cell.cost;
      }, 0);

      return {
        path,
        exploredNodes,
        totalCost,
        solved: true,
      };
    }

    for (const next of neighbors(grid, current.x, current.y)) {
      const nextKey = key(next.x, next.y);
      const movementCost = next.cost;
      const tentative = (gScore.get(currentKey) ?? Infinity) + movementCost;

      if (tentative < (gScore.get(nextKey) ?? Infinity)) {
        cameFrom.set(nextKey, currentKey);
        gScore.set(nextKey, tentative);

        const f = tentative + heuristic(next.x, next.y, goalX, goalY);
        open.push({
          x: next.x,
          y: next.y,
          f,
        });
      }
    }
  }

  return {
    path: [],
    exploredNodes,
    totalCost: 0,
    solved: false,
  };
}

function assignTargets(rovers, targets) {
  const assigned = new Set();

  for (const rover of rovers) {
    let bestIndex = null;
    let bestDistance = Infinity;

    targets.forEach((target, index) => {
      if (target.reached || assigned.has(index)) return;

      const d = heuristic(rover.x, rover.y, target.x, target.y);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = index;
      }
    });

    rover.assignedTargetIndex = bestIndex;
    if (bestIndex !== null) assigned.add(bestIndex);
  }
}

function stampMissionPaths(grid, rovers) {
  for (const rover of rovers) {
    for (const cell of rover.path) {
      if (cell.type === "empty") {
        cell.type = "path";
      }
    }
  }

  for (const rover of rovers) {
    const cell = grid[rover.y][rover.x];
    if (cell.type === "empty" || cell.type === "path" || cell.type === "start") {
      cell.type = "rover";
    }
  }
}

function runMission(grid, rovers, targets) {
  assignTargets(rovers, targets);

  const roverResults = [];
  let totalExploredNodes = 0;
  let totalPathLength = 0;
  let totalEnergyUsed = 0;

  for (const rover of rovers) {
    const targetIndex = rover.assignedTargetIndex;

    if (targetIndex === null) {
      rover.failed = true;
      roverResults.push({
        roverId: rover.id,
        solved: false,
        exploredNodes: 0,
        pathLength: 0,
        totalCost: 0,
        energyRemaining: rover.energy,
        reachedTarget: false,
      });
      continue;
    }

    const target = targets[targetIndex];
    const result = findPath(grid, rover.x, rover.y, target.x, target.y);

    let solved = false;
    let reachedTarget = false;

    if (result.solved && result.totalCost <= rover.energy) {
      rover.path = result.path;
      rover.energy -= result.totalCost;
      rover.x = target.x;
      rover.y = target.y;
      rover.completed = true;

      target.reached = true;
      reachedTarget = true;
      solved = true;
    } else {
      rover.failed = true;
    }

    totalExploredNodes += result.exploredNodes;
    totalPathLength += result.path.length;
    totalEnergyUsed += Math.max(0, rover.maxEnergy - rover.energy);

    roverResults.push({
      roverId: rover.id,
      solved,
      exploredNodes: result.exploredNodes,
      pathLength: result.path.length,
      totalCost: result.totalCost,
      energyRemaining: rover.energy,
      reachedTarget,
    });
  }

  stampMissionPaths(grid, rovers);

  const walkableCells = grid.flat().filter((cell) => cell.cost < Infinity);
  const averageTerrainCost =
    walkableCells.reduce((sum, cell) => sum + cell.cost, 0) / walkableCells.length;

  const missionTargetsReached = targets.filter((t) => t.reached).length;
  const success = missionTargetsReached === targets.length && targets.length > 0;

  return {
    success,
    roverResults,
    missionTargetsReached,
    totalTargets: targets.length,
    totalExploredNodes,
    totalPathLength,
    totalEnergyUsed,
    averageTerrainCost: Number(averageTerrainCost.toFixed(2)),
  };
}

function terrainColor(cell) {
  if (cell.type === "hazard") return "#7a1f1f";
  if (cell.type === "start") return "#0f766e";
  if (cell.type === "target") return "#1d4ed8";
  if (cell.type === "path") return "#7c3aed";
  if (cell.type === "rover") return "#f59e0b";

  if (cell.cost === 1) return "#334155";
  if (cell.cost === 2) return "#475569";
  if (cell.cost === 3) return "#64748b";
  if (cell.cost === 4) return "#78716c";
  return "#a16207";
}

function terrainLabel(cell) {
  switch (cell.type) {
    case "hazard":
      return "H";
    case "start":
      return "S";
    case "target":
      return "T";
    case "path":
      return "•";
    case "rover":
      return "R";
    default:
      return cell.cost > 1 ? String(cell.cost) : "";
  }
}

function createMetricCard(title, value) {
  const card = document.createElement("div");
  card.style.background = "#111827";
  card.style.border = "1px solid #1f2937";
  card.style.borderRadius = "12px";
  card.style.padding = "12px";

  const heading = document.createElement("div");
  heading.textContent = title;
  heading.style.fontSize = "12px";
  heading.style.opacity = "0.8";
  heading.style.marginBottom = "6px";

  const val = document.createElement("div");
  val.textContent = value;
  val.style.fontSize = "20px";
  val.style.fontWeight = "700";

  card.appendChild(heading);
  card.appendChild(val);
  return card;
}

function render(container, grid, rovers, targets, metrics) {
  const cellSize = 28;
  container.innerHTML = "";
  container.style.maxWidth = "1300px";
  container.style.margin = "0 auto";
  container.style.padding = "24px";
  container.style.fontFamily = "Arial, Helvetica, sans-serif";
  container.style.color = "#e2e8f0";

  const title = document.createElement("h1");
  title.textContent = "Helvarix Autonomous Simulator — Advanced Proof of Concept";
  title.style.marginBottom = "8px";
  container.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.textContent =
    "Demonstrates weighted terrain, multi-rover tasking, autonomous route planning, energy constraints, and mission-level performance metrics for planetary robotics simulation.";
  subtitle.style.maxWidth = "980px";
  subtitle.style.lineHeight = "1.5";
  container.appendChild(subtitle);

  const metricGrid = document.createElement("div");
  metricGrid.style.display = "grid";
  metricGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(180px, 1fr))";
  metricGrid.style.gap = "12px";
  metricGrid.style.marginTop = "18px";
  metricGrid.style.marginBottom = "24px";

  metricGrid.appendChild(
    createMetricCard("Mission Success", metrics.success ? "Yes" : "No")
  );
  metricGrid.appendChild(
    createMetricCard(
      "Targets Reached",
      `${metrics.missionTargetsReached}/${metrics.totalTargets}`
    )
  );
  metricGrid.appendChild(
    createMetricCard("Explored Nodes", String(metrics.totalExploredNodes))
  );
  metricGrid.appendChild(
    createMetricCard("Total Path Length", String(metrics.totalPathLength))
  );
  metricGrid.appendChild(
    createMetricCard("Energy Used", String(metrics.totalEnergyUsed))
  );
  metricGrid.appendChild(
    createMetricCard("Avg Terrain Cost", String(metrics.averageTerrainCost))
  );

  container.appendChild(metricGrid);

  const contentWrap = document.createElement("div");
  contentWrap.style.display = "grid";
  contentWrap.style.gridTemplateColumns = "minmax(700px, auto) 360px";
  contentWrap.style.gap = "24px";
  contentWrap.style.alignItems = "start";

  const boardWrap = document.createElement("div");

  const board = document.createElement("div");
  board.style.display = "grid";
  board.style.gridTemplateColumns = `repeat(${grid[0].length}, ${cellSize}px)`;
  board.style.gap = "2px";
  board.style.background = "#020617";
  board.style.padding = "12px";
  board.style.borderRadius = "16px";
  board.style.border = "1px solid #1e293b";
  board.style.width = "fit-content";

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
      el.style.fontWeight = "700";
      el.style.color = "white";
      el.style.background = terrainColor(cell);
      el.textContent = terrainLabel(cell);
      el.title = `(${cell.x}, ${cell.y}) | type=${cell.type} | cost=${cell.cost}`;
      board.appendChild(el);
    }
  }

  boardWrap.appendChild(board);

  const legend = document.createElement("div");
  legend.style.display = "flex";
  legend.style.flexWrap = "wrap";
  legend.style.gap = "10px";
  legend.style.marginTop = "14px";

  const legendItems = [
    ["Start", "#0f766e"],
    ["Target", "#1d4ed8"],
    ["Hazard", "#7a1f1f"],
    ["Path", "#7c3aed"],
    ["Rover", "#f59e0b"],
    ["Rough Terrain", "#78716c"],
  ];

  for (const [label, color] of legendItems) {
    const item = document.createElement("div");
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.gap = "6px";

    const swatch = document.createElement("span");
    swatch.style.display = "inline-block";
    swatch.style.width = "14px";
    swatch.style.height = "14px";
    swatch.style.borderRadius = "3px";
    swatch.style.background = color;

    const text = document.createElement("span");
    text.textContent = label;
    text.style.fontSize = "12px";

    item.appendChild(swatch);
    item.appendChild(text);
    legend.appendChild(item);
  }

  boardWrap.appendChild(legend);
  contentWrap.appendChild(boardWrap);

  const sidebar = document.createElement("div");
  sidebar.style.display = "flex";
  sidebar.style.flexDirection = "column";
  sidebar.style.gap = "14px";

  const roverCard = document.createElement("div");
  roverCard.style.background = "#111827";
  roverCard.style.border = "1px solid #1f2937";
  roverCard.style.borderRadius = "12px";
  roverCard.style.padding = "16px";

  const roverCardTitle = document.createElement("h2");
  roverCardTitle.textContent = "Rover Results";
  roverCardTitle.style.marginTop = "0";
  roverCardTitle.style.fontSize = "18px";
  roverCard.appendChild(roverCardTitle);

  metrics.roverResults.forEach((result, idx) => {
    const rover = rovers[idx];
    const row = document.createElement("div");
    row.style.padding = "10px 0";
    row.style.borderTop = idx === 0 ? "none" : "1px solid #1f2937";

    row.innerHTML = `
      <div style="font-weight:700; margin-bottom:6px;">
        ${result.roverId}
      </div>
      <div style="font-size:13px; line-height:1.5;">
        Solved: ${result.solved ? "Yes" : "No"}<br/>
        Reached Target: ${result.reachedTarget ? "Yes" : "No"}<br/>
        Explored Nodes: ${result.exploredNodes}<br/>
        Path Length: ${result.pathLength}<br/>
        Total Cost: ${result.totalCost}<br/>
        Energy Remaining: ${result.energyRemaining}/${rover.maxEnergy}
      </div>
    `;

    roverCard.appendChild(row);
  });

  sidebar.appendChild(roverCard);

  const targetCard = document.createElement("div");
  targetCard.style.background = "#111827";
  targetCard.style.border = "1px solid #1f2937";
  targetCard.style.borderRadius = "12px";
  targetCard.style.padding = "16px";

  const targetCardTitle = document.createElement("h2");
  targetCardTitle.textContent = "Mission Targets";
  targetCardTitle.style.marginTop = "0";
  targetCardTitle.style.fontSize = "18px";
  targetCard.appendChild(targetCardTitle);

  for (const target of targets) {
    const row = document.createElement("div");
    row.style.padding = "8px 0";
    row.style.borderTop = target.id === "T-1" ? "none" : "1px solid #1f2937";
    row.innerHTML = `
      <div style="font-weight:700;">${target.id}</div>
      <div style="font-size:13px;">
        Position: (${target.x}, ${target.y})<br/>
        Reached: ${target.reached ? "Yes" : "No"}
      </div>
    `;
    targetCard.appendChild(row);
  }

  sidebar.appendChild(targetCard);

  const notesCard = document.createElement("div");
  notesCard.style.background = "#111827";
  notesCard.style.border = "1px solid #1f2937";
  notesCard.style.borderRadius = "12px";
  notesCard.style.padding = "16px";

  const notesTitle = document.createElement("h2");
  notesTitle.textContent = "Prototype Scope";
  notesTitle.style.marginTop = "0";
  notesTitle.style.fontSize = "18px";

  const notesBody = document.createElement("p");
  notesBody.style.fontSize = "13px";
  notesBody.style.lineHeight = "1.6";
  notesBody.textContent =
    "This prototype demonstrates mission-task allocation, weighted path planning, and energy-constrained autonomous traversal. It is a proof of concept, not a high-fidelity physics simulator.";

  notesCard.appendChild(notesTitle);
  notesCard.appendChild(notesBody);
  sidebar.appendChild(notesCard);

  contentWrap.appendChild(sidebar);
  container.appendChild(contentWrap);
}

function tryBuildMission(options) {
  let attempts = 0;

  while (attempts < 30) {
    const grid = createGrid(options);
    const targets = placeTargets(grid, options.targetCount);
    const rovers = createRovers(options.roverCount, options.roverEnergy);
    const metrics = runMission(grid, rovers, targets);

    if (targets.length > 0) {
      return { grid, rovers, targets, metrics };
    }

    attempts++;
  }

  const fallbackGrid = createGrid(options);
  const fallbackTargets = placeTargets(fallbackGrid, options.targetCount);
  const fallbackRovers = createRovers(options.roverCount, options.roverEnergy);
  const fallbackMetrics = runMission(fallbackGrid, fallbackRovers, fallbackTargets);

  return {
    grid: fallbackGrid,
    rovers: fallbackRovers,
    targets: fallbackTargets,
    metrics: fallbackMetrics,
  };
}

export function runDemo(rootId = "app", options = defaultOptions) {
  const root = document.getElementById(rootId);
  if (!root) {
    throw new Error(`Missing root element: ${rootId}`);
  }

  const mission = tryBuildMission(options);
  render(root, mission.grid, mission.rovers, mission.targets, mission.metrics);
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    runDemo();
  });
}
