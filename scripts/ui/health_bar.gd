extends Node2D
## Simple HP bar drawn above its parent Building. Connects to the parent's
## hp_changed signal at runtime — attach as a child of any Building scene.

@export var width: float = 96.0
@export var height: float = 10.0
@export var offset_y: float = -96.0
@export var bg_color: Color = Color(0, 0, 0, 0.7)
@export var low_color: Color = Color(0.9, 0.2, 0.2)
@export var high_color: Color = Color(0.3, 1.0, 0.4)

var _value: float = 1.0


func _ready() -> void:
	var parent := get_parent()
	if parent and parent.has_signal("hp_changed"):
		parent.hp_changed.connect(_on_hp_changed)


func _on_hp_changed(current: int, max_hp: int) -> void:
	_value = float(current) / float(max_hp) if max_hp > 0 else 0.0
	queue_redraw()


func _draw() -> void:
	var pos := Vector2(-width * 0.5, offset_y)
	draw_rect(Rect2(pos, Vector2(width, height)), bg_color)
	draw_rect(Rect2(pos, Vector2(width * _value, height)),
		low_color.lerp(high_color, _value))
