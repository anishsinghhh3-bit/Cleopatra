from app.core.match_report import generate_match_report
from app.core.coach import add_commentary

moves = ["f2f3", "e7e5", "g2g4", "d8h4"]
report = generate_match_report(moves)
report = add_commentary(report)

for tp in report["turning_points"]:
    print(f"Move {tp['ply']} ({tp['classification']}): {tp['move']}, better was {tp['best_move']}")
    print(tp["explanation"])
    print()
