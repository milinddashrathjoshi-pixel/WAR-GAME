class_name Level
extends Node2D
## Arena coordinator. Spawns the pre-placed enemy building, spawns Infantry on
## request from the Barracks, serves the current attack target, and emits
## victory_triggered when the enemy is destroyed.

signal victory_triggered

@export var grid_path: NodePath
@export var placement_path: NodePath
@export var units_root_path: NodePath
@export var enemy_root_path: NodePath
@export var infantry_scene: PackedScene
@export var enemy_data: BuildingData
@export var enemy_cell: Vector2i = Vector2i(18, 4)

@onready var grid: GridManager = get_node(grid_path)
@onready var placement: PlacementController = get_node(placement_path)
@onready var units_root: Node2D = get_node(units_root_path)
@onready var enemy_root: Node2D = get_node(enemy_root_path)


func _ready() -> void:
	add_to_group("level")
	_spawn_enemy()


func _spawn_enemy() -> void:
	if enemy_data == null or grid == null:
		return
	var e := enemy_data.scene.instantiate() as Building
	enemy_root.add_child(e)
	e.setup(enemy_data, enemy_cell)
	e.global_position = grid.footprint_center_to_world(enemy_cell, enemy_data.footprint)
	grid.occupy_area(enemy_cell, enemy_data.footprint, e)
	e.add_to_group("enemy_buildings")
	e.destroyed.connect(_on_enemy_destroyed)


func _on_enemy_destroyed() -> void:
	victory_triggered.emit()


# Called by the Barracks when tapped. Spawns the unit on a free cell on the
# ring around the building so AStar can immediately path away from it.
func spawn_infantry(from_building: Building) -> void:
	if infantry_scene == null or from_building == null:
		return
	var ring_cell := grid.get_attack_cell(
		from_building.origin_cell, from_building.data.footprint, from_building.origin_cell)
	if ring_cell.x < 0:
		return
	var u := infantry_scene.instantiate()
	units_root.add_child(u)
	u.global_position = grid.cell_center_to_world(ring_cell)
	Sfx.play(&"spawn")


func get_target_building() -> Building:
	for b in get_tree().get_nodes_in_group("enemy_buildings"):
		if is_instance_valid(b):
			return b
	return null


func is_placing() -> bool:
	return placement != null and placement.is_placing()
