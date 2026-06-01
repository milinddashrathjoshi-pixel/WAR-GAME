class_name GridManager
extends Node2D
## Logical orthogonal build grid. Owns cell-occupancy + world<->cell math, and a
## grid-backed AStar2D used by units for pathfinding around buildings.
## All cell math is in this node's local space; world helpers convert via the
## node transform, so the whole base can be moved/zoomed freely.

@export var cell_size: int = 64          # px/cell; power-of-two = mobile friendly
@export var grid_width: int = 24         # cells
@export var grid_height: int = 24
@export var draw_debug_grid: bool = true # turn OFF for release builds

var _occupied: Dictionary = {}           # Vector2i cell -> Building (absent = free)
var _astar := AStar2D.new()              # one point per cell; occupied = disabled


func _ready() -> void:
	_build_astar()
	queue_redraw()


# --- coordinate helpers ---

func world_to_cell(world_pos: Vector2) -> Vector2i:
	var local := to_local(world_pos)
	return Vector2i(floori(local.x / cell_size), floori(local.y / cell_size))


func cell_origin_to_world(cell: Vector2i) -> Vector2:
	return to_global(Vector2(cell.x * cell_size, cell.y * cell_size))


func footprint_center_to_world(cell: Vector2i, footprint: Vector2i) -> Vector2:
	var px := Vector2(cell) * cell_size + Vector2(footprint) * cell_size * 0.5
	return to_global(px)


func cell_center_to_world(cell: Vector2i) -> Vector2:
	return footprint_center_to_world(cell, Vector2i.ONE)


# --- occupancy ---

func is_in_bounds(origin: Vector2i, footprint: Vector2i) -> bool:
	return origin.x >= 0 and origin.y >= 0 \
		and origin.x + footprint.x <= grid_width \
		and origin.y + footprint.y <= grid_height


func is_area_free(origin: Vector2i, footprint: Vector2i) -> bool:
	if not is_in_bounds(origin, footprint):
		return false
	for x in footprint.x:
		for y in footprint.y:
			if _occupied.has(origin + Vector2i(x, y)):
				return false
	return true


func occupy_area(origin: Vector2i, footprint: Vector2i, building: Node) -> void:
	for x in footprint.x:
		for y in footprint.y:
			var c := origin + Vector2i(x, y)
			_occupied[c] = building
			_set_cell_walkable(c, false)


func free_area(origin: Vector2i, footprint: Vector2i) -> void:
	for x in footprint.x:
		for y in footprint.y:
			var c := origin + Vector2i(x, y)
			_occupied.erase(c)
			_set_cell_walkable(c, true)


# --- pathfinding (AStar2D over the grid) ---

func _cell_id(cell: Vector2i) -> int:
	return cell.x + cell.y * grid_width


func _id_to_cell(id: int) -> Vector2i:
	return Vector2i(id % grid_width, id / grid_width)


func _build_astar() -> void:
	_astar.clear()
	for x in grid_width:
		for y in grid_height:
			_astar.add_point(_cell_id(Vector2i(x, y)), Vector2(x, y))
	# Connect orthogonal neighbours once (right + down avoids duplicates).
	for x in grid_width:
		for y in grid_height:
			var id := _cell_id(Vector2i(x, y))
			if x + 1 < grid_width:
				_astar.connect_points(id, _cell_id(Vector2i(x + 1, y)))
			if y + 1 < grid_height:
				_astar.connect_points(id, _cell_id(Vector2i(x, y + 1)))
	# Re-apply any occupancy that already exists.
	for cell in _occupied:
		_set_cell_walkable(cell, false)


func _set_cell_walkable(cell: Vector2i, walkable: bool) -> void:
	var id := _cell_id(cell)
	if _astar.has_point(id):
		_astar.set_point_disabled(id, not walkable)


## Returns a free cell on the ring around a footprint, nearest to from_cell.
## Used by units to find a standing spot next to a building they can't enter.
func get_attack_cell(origin: Vector2i, footprint: Vector2i, from_cell: Vector2i) -> Vector2i:
	var best := Vector2i(-1, -1)
	var best_dist := INF
	for x in range(origin.x - 1, origin.x + footprint.x + 1):
		for y in range(origin.y - 1, origin.y + footprint.y + 1):
			var inside := x >= origin.x and x < origin.x + footprint.x \
				and y >= origin.y and y < origin.y + footprint.y
			if inside:
				continue
			var c := Vector2i(x, y)
			if not is_in_bounds(c, Vector2i.ONE) or _occupied.has(c):
				continue
			var d := Vector2(c - from_cell).length_squared()
			if d < best_dist:
				best_dist = d
				best = c
	return best


## World-space waypoints from one cell to another. Endpoints are temporarily
## enabled so a unit standing on an occupied cell can still path out.
func find_path_world(from_cell: Vector2i, to_cell: Vector2i) -> PackedVector2Array:
	var result: PackedVector2Array = []
	var from_id := _cell_id(from_cell)
	var to_id := _cell_id(to_cell)
	if not _astar.has_point(from_id) or not _astar.has_point(to_id):
		return result
	var from_was := _astar.is_point_disabled(from_id)
	var to_was := _astar.is_point_disabled(to_id)
	_astar.set_point_disabled(from_id, false)
	_astar.set_point_disabled(to_id, false)
	for id in _astar.get_id_path(from_id, to_id):
		result.append(cell_center_to_world(_id_to_cell(id)))
	_astar.set_point_disabled(from_id, from_was)
	_astar.set_point_disabled(to_id, to_was)
	return result


# --- debug grid (skipped when draw_debug_grid is off) ---

func _draw() -> void:
	if not draw_debug_grid:
		return
	var col := Color(1, 1, 1, 0.12)
	var w := grid_width * cell_size
	var h := grid_height * cell_size
	for x in grid_width + 1:
		draw_line(Vector2(x * cell_size, 0), Vector2(x * cell_size, h), col)
	for y in grid_height + 1:
		draw_line(Vector2(0, y * cell_size), Vector2(w, y * cell_size), col)
