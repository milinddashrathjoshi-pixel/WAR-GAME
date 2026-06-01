class_name Level
extends Node2D
## Arena coordinator. Spawns the pre-placed enemy building, spawns Infantry on
## request from the Barracks, and serves the current attack target. Lives in the
## "level" group so buildings/units can find it without hard references.

@export var grid: GridManager
@export var placement: PlacementController
@export var units_root: Node2D
@export var enemy_root: Node2D
@export var infantry_scene: PackedScene
@export var enemy_data: BuildingData
@export var enemy_cell: Vector2i = Vector2i(18, 4)


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


# Called by the Barracks when tapped.
func spawn_infantry(at_world: Vector2) -> void:
	if infantry_scene == null:
		return
	var u := infantry_scene.instantiate()
	units_root.add_child(u)
	u.global_position = at_world


func get_target_building() -> Building:
	for b in get_tree().get_nodes_in_group("enemy_buildings"):
		if is_instance_valid(b):
			return b
	return null


func is_placing() -> bool:
	return placement != null and placement.is_placing()
