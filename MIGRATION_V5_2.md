# Cognis v5.2 Migration

## Do not rewrite
This branch evolves the current codebase.

## Migration invariants
- No direct symbolic survival actions: EAT, DRINK, FIND_FOOD.
- System2 may only output motor primitives.
- System2 targets must be perceptual references, not material ids.
- Qualia must never expose coordinates, ids, raw floats, material names, or hidden need labels.
- Non-LLM layers must be deterministic.
- Procedural learning must work without System2.
- First milestone: hydration discovery + toxic avoidance.
