// Pure Tetris game engine based on original MukulBarai/Block-Tetris (tetris.py)

export interface BlockCell {
  fill: boolean;
  color: string;
}

export interface ShapeDefinition {
  name: string;
  width: number;
  height: number;
  color: string;
  shape: number[][];
}

export interface ActiveShape {
  name: string;
  xCor: number;
  yCor: number;
  width: number;
  height: number;
  color: string;
  shape: number[][];
}

export const SHAPES_DATA: ShapeDefinition[] = [
  {
    name: 'Z',
    width: 3,
    height: 2,
    color: '#3aeb34', // RGB (58, 235, 52)
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
  },
  {
    name: 'S',
    width: 3,
    height: 2,
    color: '#3aeb34', // RGB (58, 235, 52)
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
  },
  {
    name: 'T',
    width: 3,
    height: 2,
    color: '#ebe834', // RGB (235, 232, 52)
    shape: [
      [1, 1, 1],
      [0, 1, 0],
    ],
  },
  {
    name: 'F', // Inverted L (J)
    width: 2,
    height: 3,
    color: '#eb34df', // RGB (235, 52, 223)
    shape: [
      [0, 1],
      [0, 1],
      [1, 1],
    ],
  },
  {
    name: 'L',
    width: 2,
    height: 3,
    color: '#eb34df', // RGB (235, 52, 223)
    shape: [
      [1, 0],
      [1, 0],
      [1, 1],
    ],
  },
  {
    name: 'I',
    width: 1,
    height: 4,
    color: '#eb344c', // RGB (235, 52, 76)
    shape: [
      [1],
      [1],
      [1],
      [1],
    ],
  },
  {
    name: 'O',
    width: 2,
    height: 2,
    color: '#34ebcf', // RGB (52, 235, 207)
    shape: [
      [1, 1],
      [1, 1],
    ],
  },
];

export function getRandomShape(cols: number = 20): ActiveShape {
  // Pool matches tetris.py: [ShapeZ, ShapeS, ShapeT, ShapeF, ShapeL, ShapeI, ShapeF, ShapeO]
  const poolNames = ['Z', 'S', 'T', 'F', 'L', 'I', 'F', 'O'];
  const chosenName = poolNames[Math.floor(Math.random() * poolNames.length)];
  const def = SHAPES_DATA.find((s) => s.name === chosenName) || SHAPES_DATA[0];

  const spawnX = Math.max(0, Math.floor((cols - def.width) / 2));

  return {
    name: def.name,
    xCor: spawnX,
    yCor: 0,
    width: def.width,
    height: def.height,
    color: def.color,
    shape: def.shape.map((row) => [...row]),
  };
}

export function createEmptyGrid(rows: number, cols: number): BlockCell[][] {
  const grid: BlockCell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: BlockCell[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({ fill: false, color: '#00fa00' });
    }
    grid.push(row);
  }
  return grid;
}

export function checkCollision(
  shape: ActiveShape,
  grid: BlockCell[][],
  rows: number,
  cols: number
): boolean {
  if (shape.xCor < 0) return false;
  if (shape.xCor + shape.width > cols) return false;
  if (shape.yCor + shape.height > rows) return false;

  for (let i = 0; i < shape.height; i++) {
    for (let j = 0; j < shape.width; j++) {
      if (shape.shape[i][j]) {
        const targetY = shape.yCor + i;
        const targetX = shape.xCor + j;
        if (targetY >= rows || targetX < 0 || targetX >= cols) {
          return false;
        }
        if (grid[targetY] && grid[targetY][targetX] && grid[targetY][targetX].fill) {
          return false;
        }
      }
    }
  }
  return true;
}

// 90-degree clockwise rotation exactly mirroring tetris.py getRotation()
export function getRotation(
  currentShape: ActiveShape,
  grid: BlockCell[][],
  rows: number,
  cols: number
): ActiveShape {
  const newCols: number[][] = [];
  const oldWidth = currentShape.width;
  const oldHeight = currentShape.height;

  for (let i = 0; i < oldWidth; i++) {
    const newRow: number[] = [];
    for (let j = 0; j < oldHeight; j++) {
      newRow.push(currentShape.shape[oldHeight - j - 1][i]);
    }
    newCols.push(newRow);
  }

  const newHeight = oldWidth;
  const newWidth = oldHeight;

  let newX = currentShape.xCor + Math.round((newHeight - newWidth) / 2);
  let newY = currentShape.yCor - Math.round((newHeight - newWidth) / 2);

  // Wall kicks & bounds guard
  if (newX < 0) newX = 0;
  if (newX + newWidth > cols) newX = cols - newWidth;
  if (newY < 0) newY = 0;
  if (newY + newHeight > rows) newY = rows - newHeight;

  const candidate: ActiveShape = {
    ...currentShape,
    width: newWidth,
    height: newHeight,
    xCor: newX,
    yCor: newY,
    shape: newCols,
  };

  if (checkCollision(candidate, grid, rows, cols)) {
    return candidate;
  }

  // Try slight horizontal nudge kicks
  const offsets = [-1, 1, -2, 2];
  for (const offset of offsets) {
    const kicked = { ...candidate, xCor: candidate.xCor + offset };
    if (checkCollision(kicked, grid, rows, cols)) {
      return kicked;
    }
  }

  // If rotation not possible, return original shape
  return currentShape;
}

export function checkLeft(
  shape: ActiveShape,
  grid: BlockCell[][]
): boolean {
  if (shape.xCor - 1 < 0) return false;
  for (let i = 0; i < shape.height; i++) {
    for (let j = 0; j < shape.width; j++) {
      if (shape.shape[i][j]) {
        const cell = grid[shape.yCor + i]?.[shape.xCor + j - 1];
        if (cell && cell.fill) {
          return false;
        }
      }
    }
  }
  return true;
}

export function checkRight(
  shape: ActiveShape,
  grid: BlockCell[][],
  cols: number
): boolean {
  if (shape.xCor + shape.width >= cols) return false;
  for (let i = 0; i < shape.height; i++) {
    for (let j = 0; j < shape.width; j++) {
      if (shape.shape[i][j]) {
        const cell = grid[shape.yCor + i]?.[shape.xCor + j + 1];
        if (cell && cell.fill) {
          return false;
        }
      }
    }
  }
  return true;
}

export function checkBottom(
  shape: ActiveShape,
  grid: BlockCell[][],
  rows: number
): boolean {
  if (shape.yCor + shape.height >= rows) return false;
  for (let i = 0; i < shape.height; i++) {
    for (let j = 0; j < shape.width; j++) {
      if (shape.shape[i][j]) {
        const cell = grid[shape.yCor + i + 1]?.[shape.xCor + j];
        if (cell && cell.fill) {
          return false;
        }
      }
    }
  }
  return true;
}

// Compute ghost drop distance for visual preview
export function getGhostY(
  shape: ActiveShape,
  grid: BlockCell[][],
  rows: number
): number {
  let testY = shape.yCor;
  while (true) {
    const testShape = { ...shape, yCor: testY };
    if (!checkBottom(testShape, grid, rows)) {
      break;
    }
    testY++;
  }
  return testY;
}
