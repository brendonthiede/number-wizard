# No LLM at runtime; AI works offline on the Export

"AI-driven personalised learning" in the pitch means the Guide feeds the Export to Claude offline and imports the resulting Learning Plan, or commits new Quest content to the repo. The game itself never calls a model: adaptive difficulty is a deterministic spaced-repetition scheduler and story content is pre-authored. We chose this so a child's play session makes no paid or network calls, behaviour is reproducible, and the Guide stays in the loop. Revisit if the manual round trip proves too slow to be useful.
