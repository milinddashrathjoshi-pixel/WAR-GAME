extends Node
## Autoload singleton "Sfx". Tiny sound bank — one AudioStreamPlayer per effect,
## play(name) restarts that effect. Browsers unlock audio on the first tap, which
## happens via the build buttons, so the first place/spawn sound primes it.

const SOUNDS := {
	&"place": preload("res://assets/sfx/place.wav"),
	&"spawn": preload("res://assets/sfx/spawn.wav"),
	&"hit": preload("res://assets/sfx/hit.wav"),
	&"victory": preload("res://assets/sfx/victory.wav"),
}

var _players: Dictionary = {}


func _ready() -> void:
	for key in SOUNDS:
		var p := AudioStreamPlayer.new()
		p.stream = SOUNDS[key]
		add_child(p)
		_players[key] = p


func play(name: StringName) -> void:
	if _players.has(name):
		_players[name].play()
