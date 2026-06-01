extends Node2D
## Short-lived floating combat text (e.g. "-25"). Call start() after adding it to
## the tree; it drifts up, fades out, and frees itself.

@export var travel: float = -64.0
@export var lifetime: float = 0.8

@onready var _label: Label = $Label


func start(text: String, color: Color, world_pos: Vector2) -> void:
	global_position = world_pos
	_label.text = text
	_label.modulate = color
	var t := create_tween()
	t.tween_property(self, "position", position + Vector2(0, travel), lifetime) \
		.set_ease(Tween.EASE_OUT)
	t.parallel().tween_property(_label, "modulate:a", 0.0, lifetime)
	t.tween_callback(queue_free)
