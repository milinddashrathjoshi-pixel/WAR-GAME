class_name Infantry
extends Node2D
## Basic ground unit. On spawn it locates the enemy target via the Level, asks
## the grid for an AStar path to a free cell beside it, and walks the waypoints.
## Reaching the target fires _on_reached_target() — the Phase 3 combat hook.

@export var speed: float = 120.0          # px/sec
@export var arrive_epsilon: float = 2.0   # px snap distance to a waypoint

var _grid: GridManager
var _target: Building
var _path: PackedVector2Array = []
var _path_index: int = 0
var _arrived: bool = false


func _ready() -> void:
	var level := get_tree().get_first_node_in_group("level") as Level
	if level:
		_grid = level.grid
		_target = level.get_target_building()
	_recompute_path()


func _recompute_path() -> void:
	if _grid == null or _target == null:
		return
	var from_cell := _grid.world_to_cell(global_position)
	var attack_cell := _grid.get_attack_cell(
		_target.origin_cell, _target.data.footprint, from_cell)
	if attack_cell.x < 0:
		return
	_path = _grid.find_path_world(from_cell, attack_cell)
	_path_index = 0
	_arrived = false


func _physics_process(delta: float) -> void:
	if _arrived or not is_instance_valid(_target):
		return
	if _path_index >= _path.size():
		_arrived = true
		_on_reached_target()
		return
	var dest := _path[_path_index]
	var to_dest := dest - global_position
	var step := speed * delta
	if to_dest.length() <= step + arrive_epsilon:
		global_position = dest
		_path_index += 1
	else:
		global_position += to_dest.normalized() * step


func _on_reached_target() -> void:
	# Phase 3 hook: begin the auto-attack loop against _target here.
	pass
