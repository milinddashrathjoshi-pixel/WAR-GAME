class_name GridManager
extends Node2D
## Logical orthogonal build grid. Owns cell-occupancy + world<->cell math.
## All cell math is in this node's local space; world helpers convert via the
## node transform, so the whole base can be moved/zoomed freely.

@export var cell_size: int = 64          # px/cell; power-of-two = mobile friendly
@export var grid_width: int = 24         # cells
@export var grid_height: int = 24
@export var draw_debug_grid: bool = true # turn OFF for release builds

var _occupied: Dictionary = {}           # Vector2i cell -> Building (absent = free)


func _ready() -> void:
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
			_occupied[origin + Vector2i(x, y)] = building


func free_area(origin: Vector2i, footprint: Vector2i) -> void:
	for x in footprint.x:
		for y in footprint.y:
			_occupied.erase(origin + Vector2i(x, y))


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
