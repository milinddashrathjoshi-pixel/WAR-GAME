class_name PlacementController
extends Node2D
## Build mode controller. A ghost building follows the touch/cursor, snaps to the
## grid, tints green/red by validity (footprint free + affordable), and commits a
## real Building on tap. Mouse events cover touch via emulate_mouse_from_touch.

@export var grid_path: NodePath
@export var buildings_root_path: NodePath

@onready var grid: GridManager = get_node(grid_path)
@onready var buildings_root: Node2D = get_node(buildings_root_path)

const COL_OK := Color(0.4, 1.0, 0.4, 0.6)
const COL_BAD := Color(1.0, 0.3, 0.3, 0.6)

var _active: BuildingData = null
var _ghost: Node2D = null
var _ghost_sprite: Sprite2D = null
var _cell: Vector2i = Vector2i.ZERO
var _can_place: bool = false


func is_placing() -> bool:
	return _active != null


# Called by the HUD build buttons.
func begin_placement(data: BuildingData) -> void:
	cancel_placement()
	if not Economy.can_afford(data.cost):
		return
	_active = data
	_ghost = data.scene.instantiate()
	_ghost.set_process(false)         # ghost is purely visual: no per-frame cost
	_ghost.set_physics_process(false)
	if "is_ghost" in _ghost:          # e.g. Barracks: don't let the ghost spawn troops
		_ghost.set("is_ghost", true)
	_ghost_sprite = _ghost.get_node_or_null("Sprite2D")
	add_child(_ghost)
	_update_ghost()


func cancel_placement() -> void:
	if is_instance_valid(_ghost):
		_ghost.queue_free()
	_ghost = null
	_ghost_sprite = null
	_active = null


func _unhandled_input(event: InputEvent) -> void:
	if not is_placing():
		return
	if event is InputEventMouseMotion:
		_update_ghost()
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			_update_ghost()
			_try_commit()
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			cancel_placement()   # desktop cancel; HUD also exposes a Cancel button


func _update_ghost() -> void:
	var foot := _active.footprint
	# Center the footprint under the finger/cursor.
	_cell = grid.world_to_cell(get_global_mouse_position()) - foot / 2
	_can_place = grid.is_area_free(_cell, foot) and Economy.can_afford(_active.cost)
	_ghost.global_position = grid.footprint_center_to_world(_cell, foot)
	if _ghost_sprite:
		_ghost_sprite.modulate = COL_OK if _can_place else COL_BAD


func _try_commit() -> void:
	if not _can_place or not Economy.spend(_active.cost):
		return
	var b := _active.scene.instantiate() as Building
	buildings_root.add_child(b)
	b.setup(_active, _cell)
	b.global_position = grid.footprint_center_to_world(_cell, _active.footprint)
	grid.occupy_area(_cell, _active.footprint, b)
	Sfx.play(&"place")
	cancel_placement()
