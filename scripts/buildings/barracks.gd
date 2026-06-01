class_name Barracks
extends Building
## Tappable troop producer. A click on its area asks the Level to spawn an
## Infantry unit at the Barracks. Ignores clicks while it is a placement ghost
## or while the player is in build mode.

var is_ghost: bool = false


func _on_click_area_input_event(_viewport: Node, event: InputEvent, _shape_idx: int) -> void:
	if is_ghost:
		return
	if event is InputEventMouseButton and event.pressed \
			and event.button_index == MOUSE_BUTTON_LEFT:
		var level := get_tree().get_first_node_in_group("level") as Level
		if level == null or level.is_placing():
			return
		level.spawn_infantry(self)
