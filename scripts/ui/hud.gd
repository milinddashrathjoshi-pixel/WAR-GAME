extends CanvasLayer
## Minimal HUD: live Credits readout, build buttons, and a Victory overlay.
## Phase 4 polish: a rounded, modern UI theme is built in code and applied to
## the buttons + credits panel so it reads as a polished mobile game.

@export var placement_path: NodePath
@export var command_center_data: BuildingData
@export var barracks_data: BuildingData

@onready var _placement: PlacementController = get_node(placement_path)
@onready var _credits_label: Label = $Root/CreditsLabel
@onready var _victory_overlay: Control = $VictoryOverlay


func _ready() -> void:
	_apply_theme()
	Economy.credits_changed.connect(_on_credits_changed)
	_on_credits_changed(Economy.credits)
	_victory_overlay.visible = false
	call_deferred("_wire_level_signals")


# --- UI theme ---

func _btn_sb(bg: Color, border: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(16)
	s.set_border_width_all(2)
	s.border_color = border
	s.content_margin_left = 18
	s.content_margin_right = 18
	s.content_margin_top = 16
	s.content_margin_bottom = 16
	s.shadow_color = Color(0, 0, 0, 0.35)
	s.shadow_size = 4
	s.shadow_offset = Vector2(0, 3)
	return s


func _apply_theme() -> void:
	var t := Theme.new()
	t.set_stylebox("normal", "Button", _btn_sb(Color(0.16, 0.21, 0.30), Color(0.40, 0.52, 0.72)))
	t.set_stylebox("hover", "Button", _btn_sb(Color(0.23, 0.30, 0.42), Color(0.55, 0.70, 0.95)))
	t.set_stylebox("pressed", "Button", _btn_sb(Color(0.10, 0.13, 0.19), Color(0.35, 0.45, 0.6)))
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	t.set_font_size("font_size", "Button", 30)
	t.set_color("font_color", "Button", Color(0.90, 0.94, 1.0))
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", Color(0.75, 0.82, 0.95))
	$Root.theme = t
	_victory_overlay.theme = t

	# Credits panel.
	var cs := StyleBoxFlat.new()
	cs.bg_color = Color(0.10, 0.13, 0.19, 0.85)
	cs.set_corner_radius_all(14)
	cs.set_border_width_all(2)
	cs.border_color = Color(0.95, 0.78, 0.30)
	cs.content_margin_left = 18
	cs.content_margin_right = 18
	cs.content_margin_top = 8
	cs.content_margin_bottom = 8
	_credits_label.add_theme_stylebox_override("normal", cs)
	_credits_label.add_theme_font_size_override("font_size", 30)
	_credits_label.add_theme_color_override("font_color", Color(1.0, 0.86, 0.4))

	var vlabel := get_node_or_null("VictoryOverlay/Center/VBox/VictoryLabel")
	if vlabel:
		vlabel.add_theme_color_override("font_color", Color(1.0, 0.86, 0.4))
		vlabel.add_theme_color_override("font_outline_color", Color(0.1, 0.08, 0.0))
		vlabel.add_theme_constant_override("outline_size", 10)


func _wire_level_signals() -> void:
	var level := get_tree().get_first_node_in_group("level") as Level
	if level:
		level.victory_triggered.connect(_on_victory)


func _on_credits_changed(amount: int) -> void:
	_credits_label.text = "Credits: %d" % amount


func _on_command_center_button_pressed() -> void:
	_placement.begin_placement(command_center_data)


func _on_barracks_button_pressed() -> void:
	_placement.begin_placement(barracks_data)


func _on_cancel_button_pressed() -> void:
	_placement.cancel_placement()


func _on_victory() -> void:
	_victory_overlay.visible = true
	_victory_overlay.modulate.a = 0.0
	create_tween().tween_property(_victory_overlay, "modulate:a", 1.0, 0.4)
	Sfx.play(&"victory")


func _on_play_again_button_pressed() -> void:
	get_tree().reload_current_scene()
