extends Node
## Autoload singleton "Economy". Continuously accrues Credits and is the single
## source of truth for affording/spending. Buildings and the HUD talk to it via
## the credits_changed signal so nothing polls every frame.

signal credits_changed(amount: int)

@export var starting_credits: int = 500
@export var credits_per_second: float = 5.0

var credits: int = 0
var _accumulator: float = 0.0


func _ready() -> void:
	credits = starting_credits
	credits_changed.emit(credits)


func _process(delta: float) -> void:
	_accumulator += credits_per_second * delta
	if _accumulator >= 1.0:
		var gained := int(_accumulator)
		_accumulator -= gained
		credits += gained
		credits_changed.emit(credits)


func can_afford(amount: int) -> bool:
	return credits >= amount


func spend(amount: int) -> bool:
	if not can_afford(amount):
		return false
	credits -= amount
	credits_changed.emit(credits)
	return true
