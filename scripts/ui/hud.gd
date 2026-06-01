extends CanvasLayer
## Minimal HUD: live Credits readout, build buttons, and a Victory overlay shown
## when the Level emits victory_triggered. The "Play Again" button reloads the
## current scene for a quick replay loop.

@export var placement_path: NodePath
@export var command_center_data: BuildingData
@export var barracks_data: BuildingData

@onready var _placement: PlacementController = get_node(placement_path)
@onready var _credits_label: Label = $Root/CreditsLabel
@onready var _victory_overlay: Control = $VictoryOverlay


func _ready() -> void:
	Economy.credits_changed.connect(_on_credits_changed)
	_on_credits_changed(Economy.credits)
	_victory_overlay.visible = false
	# Level._ready may not have added itself to the "level" group yet — defer.
	call_deferred("_wire_level_signals")


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


func _on_play_again_button_pressed() -> void:
	get_tree().reload_current_scene()
