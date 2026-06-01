class_name Building
extends Node2D
## Base for all placeable buildings. Footprint/cost/hp come from its BuildingData
## so behaviour is data-driven. Emits hp_changed (for health bars) and destroyed
## (for win/lose checks) — used by Phase 3 combat.

signal hp_changed(current: int, max_hp: int)
signal destroyed

@export var data: BuildingData

var origin_cell: Vector2i      # top-left cell of the footprint
var hp: int


func setup(p_data: BuildingData, p_origin: Vector2i) -> void:
	data = p_data
	origin_cell = p_origin
	hp = p_data.max_hp
	hp_changed.emit(hp, p_data.max_hp)


func take_damage(amount: int) -> void:
	if hp <= 0:
		return
	hp = max(0, hp - amount)
	hp_changed.emit(hp, data.max_hp)
	if hp == 0:
		destroyed.emit()
		_on_destroyed()


func _on_destroyed() -> void:
	queue_free()
