class_name BuildingData
extends Resource
## Designer-editable building definition. Create .tres instances in res://data/
## to add new buildings without touching code.

@export var id: StringName = &""
@export var display_name: String = "Building"
@export var footprint: Vector2i = Vector2i(3, 3)   # size in grid cells
@export var cost: int = 100                         # credits to place
@export var max_hp: int = 1000                      # used in Phase 3 combat
@export var scene: PackedScene                      # building scene to spawn
@export var icon: Texture2D                         # optional HUD button icon
