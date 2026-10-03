from app.core.rating import update_rating, coins_for_result

print("800 rating, beats Cleopatra:", update_rating(800, 1.0), "coins:", coins_for_result(1.0))
print("800 rating, loses to Cleopatra:", update_rating(800, 0.0), "coins:", coins_for_result(0.0))
print("800 rating, draws Cleopatra:", update_rating(800, 0.5), "coins:", coins_for_result(0.5))
print("2700 rating, loses to Cleopatra:", update_rating(2700, 0.0))
print("2700 rating, beats Cleopatra:", update_rating(2700, 1.0))
