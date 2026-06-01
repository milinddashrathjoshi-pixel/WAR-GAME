class_name Building
extends Node2D
## Base for all placeable buildings. Footprint/cost/hp come from its BuildingData
## so behaviour is data-driven. Emits hp_changed (for health bars) and destroyed
## (for win/lose checks). Phase 4 polish: spawn pop-in, red hit-flash, floating
## damage numbers, and a hit sound when damaged.

signal hp_changed(current: int, max_hp: int)
signal destroyed

const FLOATING_TEXT := preload("res://scenes/ui/floating_text.tscn")

@export var data: BuildingData

var origin_cell: Vector2i      # top-left cell of the footprint
var hp: int

@onready var _sprite: Sprite2D = $Sprite2D


func _ready() -> void:
	# Spawn pop-in.
	scale = Vector2.ZERO
	var t := create_tween()
	t.tween_property(self, "scale", Vector2.ONE, 0.25) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


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
	_flash()
	_spawn_damage_number(amount)
	Sfx.play(&"hit")
	if hp == 0:
		destroyed.emit()
		_on_destroyed()


func _flash() -> void:
	if _sprite == null:
		return
	_sprite.modulate = Color(1.0, 0.4, 0.4)
	create_tween().tween_property(_sprite, "modulate", Color.WHITE, 0.18)


func _spawn_damage_number(amount: int) -> void:
	var ft := FLOATING_TEXT.instantiate()
	get_parent().add_child(ft)
	ft.start("-%d" % amount, Color(1.0, 0.85, 0.3), global_position + Vector2(0, -72))


func _on_destroyed() -> void:
	queue_free()
