extends CanvasLayer
## Minimal HUD: live Credits readout + build buttons that hand a BuildingData to
## the PlacementController. Button pressed signals are wired in hud.tscn.

@export var placement: PlacementController
@export var command_center_data: BuildingData
@export var barracks_data: BuildingData

@onready var _credits_label: Label = $Root/CreditsLabel


func _ready() -> void:
	Economy.credits_changed.connect(_on_credits_changed)
	_on_credits_changed(Economy.credits)


func _on_credits_changed(amount: int) -> void:
	_credits_label.text = "Credits: %d" % amount


func _on_command_center_button_pressed() -> void:
	placement.begin_placement(command_center_data)


func _on_barracks_button_pressed() -> void:
	placement.begin_placement(barracks_data)


func _on_cancel_button_pressed() -> void:
	placement.cancel_placement()
