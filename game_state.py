import uuid
import random
import string


rooms = {}
START_POSITIONS = [(400, 300), (300, 250), (500, 350), (200, 200), (600, 250), (350, 400), (450, 180), (250, 450)]


def generate_room_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


class Player:
    def __init__(self, sid, username, color):
        self.id = str(uuid.uuid4())[:8]
        self.sid = sid
        self.username = username
        self.color = color
        self.x = 400
        self.y = 300
        self.room_code = None

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "color": self.color,
            "x": self.x,
            "y": self.y,
        }


class Block:
    def __init__(self, grid_x, grid_y, color):
        self.grid_x = grid_x
        self.grid_y = grid_y
        self.color = color

    def to_dict(self):
        return {"grid_x": self.grid_x, "grid_y": self.grid_y, "color": self.color}


class Room:
    def __init__(self, code, host_sid, host_username):
        self.code = code
        self.host_sid = host_sid
        self.host_username = host_username
        self.players = {}
        self.blocks = {}
        self.template = "blank"
        self.bg_color = "#0f0f18"
        self.max_players = None
        self.battleship = None

    def add_player(self, player):
        pos_idx = len(self.players) % len(START_POSITIONS)
        player.x, player.y = START_POSITIONS[pos_idx]
        self.players[player.id] = player
        player.room_code = self.code

    def remove_player(self, player_id):
        self.players.pop(player_id, None)

    def to_dict(self):
        return {
            "code": self.code,
            "host_username": self.host_username,
            "template": self.template,
            "bg_color": self.bg_color,
            "players": {pid: p.to_dict() for pid, p in self.players.items()},
            "blocks": {bid: b.to_dict() for bid, b in self.blocks.items()},
        }


TEMPLATES = {
    "blank":    {"label": "Blank",    "bg": "#0f0f18", "desc": "Empty world"},
    "maze":     {"label": "Maze",     "bg": "#08080f", "desc": "Random maze"},
    "snake":    {"label": "Snake.io",  "bg": "#0a140a", "desc": "Arena with obstacles"},
    "geometry": {"label": "Geometry Dash", "bg": "#1a0a0a", "desc": "Obstacle course"},
    "tiles":    {"label": "Tiles",    "bg": "#0e0e1a", "desc": "Tap the tiles"},
    "racer":    {"label": "Drift Racer","bg": "#0a0a18", "desc": "Drift, dodge, collect coins"},
    "x_o":      {"label": "X O",       "bg": "#0a1a10", "desc": "Tic Tac Toe"},
    "battleship":{"label": "Battleship","bg": "#0a1420", "desc": "Naval combat 2p"},
}

TEMPLATE_COLORS = {
    "maze":     {"wall": "#4a6a8a", "floor": "#1a2a3a"},
    "snake":    {"border": "#44ff88", "obstacle": "#ff4488", "floor": "#0a1a0a"},
    "geometry": {"block": "#ff4444", "spike": "#ff8844", "ground": "#664444"},
    "tiles":    {"a": "#1a1a2e", "b": "#222244"},
    "racer":    {"wall": "#ff4444", "obstacle": "#ff8844", "coin": "#ffdd44"},
    "x_o":      {"board": "#44cc88", "line": "#338866", "cell": "#0f1f15"},
}

W = 20
H = 15


def set_block(blocks, gx, gy, color):
    if 0 <= gx < W and 0 <= gy < H:
        blocks[f"{gx}_{gy}"] = Block(gx, gy, color)


def generate_template_blocks(template_name):
    random.seed()
    blocks = {}
    t = TEMPLATE_COLORS.get(template_name, {})

    if template_name == "blank":
        pass

    elif template_name == "maze":
        wall_c = t.get("wall", "#4a6a8a")
        # Recursive backtracker on a grid of cells
        maze_cols, maze_rows = 9, 7  # cells
        cell_w = 2
        cell_h = 2
        total_w = maze_cols * cell_w + (maze_cols - 1)  # 9*2+8=26 > 20, adjust
        # Actually let me just do 7 cols x 5 rows, cell size 2, wall 1 => 7*2+6=20 wide, 5*2+4=14 high
        maze_cols, maze_rows = 7, 5
        total_w = maze_cols * 2 + (maze_cols - 1)  # 20
        total_h = maze_rows * 2 + (maze_rows - 1)  # 14

        # Fill all walls
        wall_grid = [[True for _ in range(total_w)] for _ in range(total_h)]

        def carve(cx, cy):
            wx = cx * 3
            wy = cy * 3
            for dy in range(cell_h):
                for dx in range(cell_w):
                    wall_grid[wy + dy][wx + dx] = False
            dirs = [(0, 1), (1, 0), (0, -1), (-1, 0)]
            random.shuffle(dirs)
            for dx, dy in dirs:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < maze_cols and 0 <= ny < maze_rows:
                    nwx = nx * 3
                    nwy = ny * 3
                    if wall_grid[nwy][nwx]:
                        if dx == 1:
                            wall_grid[wy][wx + 2] = False
                            wall_grid[wy + 1][wx + 2] = False
                        elif dx == -1:
                            wall_grid[wy][wx - 1] = False
                            wall_grid[wy + 1][wx - 1] = False
                        elif dy == 1:
                            wall_grid[wy + 2][wx] = False
                            wall_grid[wy + 2][wx + 1] = False
                        elif dy == -1:
                            wall_grid[wy - 1][wx] = False
                            wall_grid[wy - 1][wx + 1] = False
                        carve(nx, ny)

        carve(0, 0)
        for gy in range(total_h):
            for gx in range(total_w):
                if wall_grid[gy][gx]:
                    set_block(blocks, gx, gy, wall_c)
        # Bottom wall with exit gap (covers row 14)
        for x in range(W):
            set_block(blocks, x, H - 1, wall_c)
        exit_x = random.choice([x for x in range(0, total_w, 3) if x < W])
        blocks.pop(f"{exit_x}_{H - 1}", None)

    elif template_name == "snake":
        border_c = t.get("border", "#44ff88")
        obst_c = t.get("obstacle", "#ff4488")
        for x in range(W):
            set_block(blocks, x, 0, border_c)
            set_block(blocks, x, H - 1, border_c)
        for y in range(H):
            set_block(blocks, 0, y, border_c)
            set_block(blocks, W - 1, y, border_c)
        # Random obstacles
        for _ in range(25):
            gx = random.randint(2, W - 3)
            gy = random.randint(2, H - 3)
            if f"{gx}_{gy}" not in blocks:
                set_block(blocks, gx, gy, obst_c)

    elif template_name == "geometry":
        block_c = t.get("block", "#ff4444")
        spike_c = t.get("spike", "#ff8844")
        ground_c = t.get("ground", "#664444")
        # Ground
        for x in range(W):
            set_block(blocks, x, H - 1, ground_c)
        # Obstacles at varying heights
        obstacles = [
            (2, 12, 3, block_c), (6, 11, 4, block_c), (9, 13, 2, spike_c),
            (11, 10, 5, block_c), (15, 12, 3, spike_c), (18, 11, 4, block_c),
        ]
        for ox, oy, oh, oc in obstacles:
            for dy in range(oh):
                set_block(blocks, ox, oy - dy, oc)

    elif template_name == "tiles":
        pass  # No floor blocks; tiles are virtual entities

    elif template_name == "racer":
        coin_c = t.get("coin", "#ffdd44")
        coin_positions = [
            (2, 2), (5, 5), (8, 3), (14, 2), (18, 4),
            (16, 7), (10, 5), (6, 9), (3, 7), (8, 11),
            (13, 11), (17, 9), (14, 13), (9, 13), (4, 12),
            (7, 7), (12, 7), (15, 5), (11, 9), (5, 3),
            (1, 8), (18, 11), (3, 13), (10, 1), (15, 12),
        ]
        for cx, cy in coin_positions:
            set_block(blocks, cx, cy, coin_c)

    elif template_name == "x_o":
        board_c = t.get("board", "#44cc88")
        line_c = t.get("line", "#338866")
        cell_c = t.get("cell", "#0f1f15")
        # Fill board area with cell color
        for gx in range(2, 18):
            for gy in range(1, 14):
                set_block(blocks, gx, gy, cell_c)
        # Outer border
        for gx in range(1, 19):
            set_block(blocks, gx, 0, board_c)
            set_block(blocks, gx, 14, board_c)
        for gy in range(15):
            set_block(blocks, 0, gy, board_c)
            set_block(blocks, 19, gy, board_c)
        # Tic Tac Toe grid lines (vertical)
        for gy in range(1, 14):
            set_block(blocks, 6, gy, line_c)
            set_block(blocks, 13, gy, line_c)
        # Horizontal lines
        for gx in range(1, 19):
            set_block(blocks, gx, 4, line_c)
            set_block(blocks, gx, 9, line_c)

    return blocks


def generate_battleship_board():
    """Generate a 7x7 board with random ship placements.
    Ships: size 3, size 2, size 2. Returns list of ships, each ship is [(x,y),...]."""
    size = 7
    ships = []
    occupied = set()
    ship_sizes = [3, 2, 2]
    for ssize in ship_sizes:
        placed = False
        for _ in range(200):
            horizontal = random.random() < 0.5
            if horizontal:
                max_x = size - ssize
                x = random.randint(0, max_x)
                y = random.randint(0, size - 1)
                cells = [(x + i, y) for i in range(ssize)]
            else:
                max_y = size - ssize
                x = random.randint(0, size - 1)
                y = random.randint(0, max_y)
                cells = [(x, y + i) for i in range(ssize)]
            if not any(c in occupied for c in cells):
                for c in cells:
                    occupied.add(c)
                ships.append(cells)
                placed = True
                break
        if not placed:
            ships.append([])
    return ships
