from app.core.rating import update_rating, legacy_rating_delta

print("Challenger 1200 beats AI rated 1200:", update_rating(1200, 1.0, 1200))
print("Challenger 1200 loses to AI rated 1200:", update_rating(1200, 0.0, 1200))
print("AI owner rating after AI win:", legacy_rating_delta(True))
print("AI owner rating after AI loss:", legacy_rating_delta(False))
