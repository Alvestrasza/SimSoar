# Flight scoring

SimSoar stores the identifier of the rule used for every flight. New and
re-analysed uploads use `SIMSOAR_XC_V1`; flights imported by earlier releases
remain labelled `LEGACY_DISTANCE_1_8` until their IGC file is re-analysed.

## `SIMSOAR_XC_V1`

1. The scorer considers the flight in chronological order, including its
   recorded start and finish.
2. It chooses up to six legs that maximize the scored route distance. Long
   tracks are sampled to a bounded candidate set before this deterministic
   optimization.
3. The open-course score is one point per scored kilometre.
4. A route of at least 10 km receives a `1.20` closed-course multiplier when
   the finish is within the greater of 1 km or 5 percent of the scored route
   distance from the start.
5. The score, rule identifier, scored distance, multiplier, closed-course
   result, and every selected route point and leg distance are stored.

The flight detail page shows the formula and selected scoring points. The rule
registry in `lib/scoring.ts` allows later rule versions to coexist with stored
historical results instead of silently changing old scores.

## Scoring window

Before scoring, SimSoar suggests an active section of the track. The detector
removes stationary edges, separates recording gaps longer than two minutes,
keeps the continuous section with the greatest flown distance, and identifies
the end of an initial tow or engine-like climb from altitude development. Its
suggested start, end, and detection reasons remain stored with the flight.

The flight owner or a moderator can set different start and end track points.
Only points inside that window are passed to the scoring rule. Each manual
change recalculates the stored score and scoring points and creates an audit
entry. The original track and the automatic suggestion remain unchanged, so
the suggested window can be restored later.
