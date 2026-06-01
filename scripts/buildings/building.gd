class_name Building
extends Node2D
## Base for all placeable buildings. Footprint/cost/hp come from its BuildingData
## so behaviour is data-driven. take_damage() is the Phase 3 combat hook.

@export var data: BuildingData

var origin_cell: Vector2i      # top-left cell of the footprint
var hp: int


func setup(p_data: BuildingData, p_origin: Vector2i) -> void:
	data = p_data
	origin_cell = p_origin
	hp = p_data.max_hp


func take_damage(amount: int) -> void:   # Phase 3 hook
	hp = max(0, hp - amount)
	if hp == 0:
		_on_destroyed()


func _on_destroyed() -> void:
	queue_free()
