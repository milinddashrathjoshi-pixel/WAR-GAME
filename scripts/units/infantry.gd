class_name Infantry
extends Node2D
## Basic ground unit. On spawn it locates the enemy target via the Level, asks
## the grid for an AStar path to a free cell beside it, walks the waypoints,
## then enters an attack loop dealing `damage` every `attack_interval` seconds.

@export var speed: float = 120.0          # px/sec
@export var arrive_epsilon: float = 2.0   # px snap distance to a waypoint
@export var damage: int = 25
@export var attack_interval: float = 0.7  # seconds between hits

var _grid: GridManager
var _target: Building
var _path: PackedVector2Array = []
var _path_index: int = 0
var _arrived: bool = false
var _attack_timer: float = 0.0


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
	if not is_instance_valid(_target):
		return   # target gone (destroyed) — idle in place
	if _arrived:
		_attack(delta)
		return
	if _path_index >= _path.size():
		_arrived = true
		return
	var dest := _path[_path_index]
	var to_dest := dest - global_position
	var step := speed * delta
	if to_dest.length() <= step + arrive_epsilon:
		global_position = dest
		_path_index += 1
	else:
		global_position += to_dest.normalized() * step


func _attack(delta: float) -> void:
	_attack_timer -= delta
	if _attack_timer <= 0.0:
		_spawn_tracer()
		_target.take_damage(damage)
		_attack_timer = attack_interval


func _spawn_tracer() -> void:
	# Brief firing line from this unit to the target that fades out.
	var line := Line2D.new()
	line.width = 3.0
	line.default_color = Color(1.0, 0.9, 0.35, 0.9)
	line.add_point(global_position)
	line.add_point(_target.global_position)
	get_parent().add_child(line)
	var t := line.create_tween()
	t.tween_property(line, "modulate:a", 0.0, 0.15)
	t.tween_callback(line.queue_free)
