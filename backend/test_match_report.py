from app.core.match_report import generate_match_report

moves = ["f2f3", "e7e5", "g2g4", "d8h4"]
report = generate_match_report(moves)

print("White accuracy:", report["white_accuracy"])
print("Black accuracy:", report["black_accuracy"])
print("Turning points:", report["turning_points"])
for m in report["moves"]:
    print(m["ply"], m["mover"], m["move"], m["classification"])
