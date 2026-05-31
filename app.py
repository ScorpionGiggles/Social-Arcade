import os
from flask import Flask, render_template, request, session, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room

import game_state as gs

MAX_PLAYER_TEMPLATES = {"x_o": 2, "battleship": 2}

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev_key")
socketio = SocketIO(app, cors_allowed_origins="*")


@app.route("/")
def index():
    initial_user = None
    if "username" in session:
        initial_user = {"username": session["username"], "color": session["color"]}
    return render_template("index.html", initial_user=initial_user)


@app.route("/api/save-session", methods=["POST"])
def save_session():
    data = request.json
    if data and data.get("username"):
        session["username"] = data["username"]
        session["color"] = data.get("color", "#ff4444")
        return jsonify({"ok": True})
    return jsonify({"ok": False}), 400


@socketio.on("connect")
def on_connect():
    pass


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    for code in list(gs.rooms.keys()):
        room = gs.rooms[code]
        for pid, player in list(room.players.items()):
            if player.sid == sid:
                room.remove_player(pid)
                leave_room(code)
                if room.host_sid == sid:
                    emit("room_closed", {"message": "Host disconnected"}, to=code)
                    del gs.rooms[code]
                else:
                    emit("player_left", {"player_id": pid}, to=code)
                return


@socketio.on("login")
def on_login(data):
    username = data.get("username", "").strip()[:20]
    color = data.get("color", "#ff4444")
    if not username:
        emit("error", {"message": "Username required"})
        return
    request._sid_info = {"username": username, "color": color}
    emit("logged_in", {"username": username, "color": color})


@socketio.on("create_room")
def on_create_room(data):
    sid_info = getattr(request, "_sid_info", {"username": "Host", "color": "#ff4444"})
    uname = sid_info.get("username", "Host")
    col = sid_info.get("color", "#ff4444")
    template = data.get("template", "blank") if data else "blank"
    bg_color = data.get("bg_color", "#0f0f18") if data else "#0f0f18"

    code = gs.generate_room_code()
    while code in gs.rooms:
        code = gs.generate_room_code()

    room = gs.Room(code, request.sid, uname)
    room.template = template
    room.bg_color = bg_color
    room.max_players = MAX_PLAYER_TEMPLATES.get(template)
    if template == "battleship":
        room.battleship = {"boards": {}, "hits": {}, "misses": {}, "turn": None, "ships": {}, "winner": None}
    room.blocks = gs.generate_template_blocks(template)
    player = gs.Player(request.sid, uname, col)
    room.add_player(player)
    gs.rooms[code] = room

    join_room(code)
    emit("room_created", {"code": code, "room": room.to_dict(), "your_player_id": player.id})
    emit("player_joined", {"player": player.to_dict()}, to=code, include_self=False)


@socketio.on("login_and_create")
def on_login_and_create(data):
    username = data.get("username", "").strip()[:20]
    color = data.get("color", "#ff4444")
    template = data.get("template", "blank")
    bg_color = data.get("bg_color", "#0f0f18")
    if not username:
        emit("error", {"message": "Username required"})
        return

    request._sid_info = {"username": username, "color": color}

    code = gs.generate_room_code()
    while code in gs.rooms:
        code = gs.generate_room_code()

    room = gs.Room(code, request.sid, username)
    room.template = template
    room.bg_color = bg_color
    room.max_players = MAX_PLAYER_TEMPLATES.get(template)
    if template == "battleship":
        room.battleship = {"boards": {}, "hits": {}, "misses": {}, "turn": None, "ships": {}, "winner": None}
    room.blocks = gs.generate_template_blocks(template)
    player = gs.Player(request.sid, username, color)
    room.add_player(player)
    gs.rooms[code] = room

    join_room(code)
    emit("room_created", {"code": code, "room": room.to_dict(), "your_player_id": player.id})
    emit("player_joined", {"player": player.to_dict()}, to=code, include_self=False)


@socketio.on("login_and_join")
def on_login_and_join(data):
    username = data.get("username", "").strip()[:20]
    color = data.get("color", "#ff4444")
    code = data.get("code", "").upper().strip()
    if not username:
        emit("error", {"message": "Username required"})
        return
    if code not in gs.rooms:
        emit("error", {"message": "Room not found"})
        return

    room = gs.rooms[code]
    if room.max_players and len(room.players) >= room.max_players:
        emit("error", {"message": "Room is full (max " + str(room.max_players) + " players)"})
        return

    request._sid_info = {"username": username, "color": color}

    player = gs.Player(request.sid, username, color)
    room.add_player(player)

    join_room(code)

    # Init battleship when 2nd player joins
    if room.template == "battleship" and len(room.players) == 2 and room.battleship:
        bs = room.battleship
        bs["ships"] = {}
        bs["hits"] = {}
        bs["misses"] = {}
        for pid in room.players:
            bs["ships"][pid] = gs.generate_battleship_board()
            bs["hits"][pid] = []
            bs["misses"][pid] = []
        pids = list(room.players.keys())
        bs["turn"] = pids[0]
        bs["winner"] = None
        emit("battleship_state", bs, to=room.code)

    emit("room_joined", {"code": code, "room": room.to_dict(), "your_player_id": player.id})
    emit("player_joined", {"player": player.to_dict()}, to=code)


@socketio.on("join_room")
def on_join_room(data):
    code = data.get("code", "").upper().strip()
    if code not in gs.rooms:
        emit("error", {"message": "Room not found"})
        return
    room = gs.rooms[code]
    if room.max_players and len(room.players) >= room.max_players:
        emit("error", {"message": "Room is full (max " + str(room.max_players) + " players)"})
        return
    sid_info = getattr(request, "_sid_info", {"username": "Player", "color": "#ff4444"})
    player = gs.Player(request.sid, sid_info["username"], sid_info["color"])
    room.add_player(player)
    join_room(code)

    # Init battleship when 2nd player joins
    if room.template == "battleship" and len(room.players) == 2 and room.battleship:
        bs = room.battleship
        bs["ships"] = {}
        bs["hits"] = {}
        bs["misses"] = {}
        for pid in room.players:
            bs["ships"][pid] = gs.generate_battleship_board()
            bs["hits"][pid] = []
            bs["misses"][pid] = []
        pids = list(room.players.keys())
        bs["turn"] = pids[0]
        bs["winner"] = None
        emit("battleship_state", bs, to=room.code)

    emit("room_joined", {"code": code, "room": room.to_dict(), "your_player_id": player.id})
    emit("player_joined", {"player": player.to_dict()}, to=code)


@socketio.on("player_move")
def on_player_move(data):
    sid = request.sid
    x = data.get("x", 0)
    y = data.get("y", 0)
    for room in gs.rooms.values():
        for pid, player in room.players.items():
            if player.sid == sid:
                player.x = max(0, min(800 - 30, x))
                player.y = max(0, min(600 - 30, y))
                emit("player_moved", {"player_id": pid, "x": player.x, "y": player.y}, to=room.code, include_self=False)
                return


@socketio.on("chat_message")
def on_chat_message(data):
    sid = request.sid
    text = data.get("text", "").strip()[:200]
    if not text:
        return
    for room in gs.rooms.values():
        for pid, player in room.players.items():
            if player.sid == sid:
                emit("chat_message", {
                    "player_id": pid,
                    "username": player.username,
                    "color": player.color,
                    "text": text,
                }, to=room.code)
                return


@socketio.on("chat_image")
def on_chat_image(data):
    sid = request.sid
    url = data.get("url", "").strip()[:500]
    if not url:
        return
    for room in gs.rooms.values():
        for pid, player in room.players.items():
            if player.sid == sid:
                emit("chat_image", {
                    "player_id": pid,
                    "username": player.username,
                    "color": player.color,
                    "url": url,
                }, to=room.code)
                return


@socketio.on("place_block")
def on_place_block(data):
    sid = request.sid
    grid_x = data.get("grid_x")
    grid_y = data.get("grid_y")
    color = data.get("color", "#666666")
    for room in gs.rooms.values():
        if room.host_sid != sid:
            continue
        block_id = f"{grid_x}_{grid_y}"
        if block_id in room.blocks:
            continue
        block = gs.Block(grid_x, grid_y, color)
        room.blocks[block_id] = block
        emit("block_placed", {"block_id": block_id, "grid_x": grid_x, "grid_y": grid_y, "color": color}, to=room.code)


@socketio.on("remove_block")
def on_remove_block(data):
    sid = request.sid
    grid_x = data.get("grid_x")
    grid_y = data.get("grid_y")
    for room in gs.rooms.values():
        if room.host_sid != sid:
            continue
        block_id = f"{grid_x}_{grid_y}"
        if block_id in room.blocks:
            del room.blocks[block_id]
            emit("block_removed", {"block_id": block_id, "grid_x": grid_x, "grid_y": grid_y}, to=room.code)


@socketio.on("battleship_attack")
def on_battleship_attack(data):
    sid = request.sid
    cell = data.get("cell")
    for room in gs.rooms.values():
        if room.template != "battleship" or not room.battleship:
            continue
        bs = room.battleship
        if bs.get("winner"):
            continue
        # Find which player is attacking
        attacker = None
        for pid, p in room.players.items():
            if p.sid == sid:
                attacker = pid
                break
        if not attacker or bs.get("turn") != attacker:
            continue
        defender = [pid for pid in room.players if pid != attacker][0]
        if cell in bs["hits"].get(defender, []) or cell in bs["misses"].get(defender, []):
            continue
        # Check hit (convert cell index to (x,y) for tuple comparison)
        bs_size = 7
        target = (cell % bs_size, cell // bs_size)
        hit = False
        for ship in bs["ships"].get(defender, []):
            if target in ship:
                hit = True
                break
        if hit:
            bs["hits"].setdefault(defender, []).append(cell)
        else:
            bs["misses"].setdefault(defender, []).append(cell)
        # Check win
        total_ship_cells = sum(len(s) for s in bs["ships"].get(defender, []))
        if len(bs["hits"].get(defender, [])) >= total_ship_cells:
            bs["winner"] = attacker
        else:
            bs["turn"] = defender
        emit("battleship_state", bs, to=room.code)
        return


@socketio.on("battleship_get_state")
def on_battleship_get_state():
    sid = request.sid
    for room in gs.rooms.values():
        if room.template != "battleship" or not room.battleship:
            continue
        for pid, p in room.players.items():
            if p.sid == sid:
                emit("battleship_state", room.battleship)
                return


@socketio.on("get_rooms")
def on_get_rooms():
    rooms_list = [{
        "code": code,
        "host_username": room.host_username,
        "player_count": len(room.players),
        "template": room.template,
    } for code, room in gs.rooms.items()]
    emit("rooms_list", {"rooms": rooms_list})


@socketio.on("leave_room")
def on_leave():
    sid = request.sid
    for code in list(gs.rooms.keys()):
        room = gs.rooms[code]
        for pid, player in list(room.players.items()):
            if player.sid == sid:
                room.remove_player(pid)
                leave_room(code)
                if room.host_sid == sid:
                    emit("room_closed", {"message": "Host left"}, to=code)
                    del gs.rooms[code]
                else:
                    emit("player_left", {"player_id": pid}, to=code)
                return


if __name__ == "__main__":
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
