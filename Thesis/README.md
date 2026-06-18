# BuildWise — Thesis Documentation

English-language functionality documentation for the BuildWise Project Control Suite thesis.

## Files

| File | Use in thesis |
|------|----------------|
| [Chapter_03_Functional_Requirements.md](Chapter_03_Functional_Requirements.md) | Chapter 3 — Functional / system requirements (Sections 2–12 of master spec) |
| [Chapter_04_System_Design.md](Chapter_04_System_Design.md) | Chapter 4 — Architecture, organogram, security, integration diagrams |
| [Chapter_Future_Work_and_Limitations.md](Chapter_Future_Work_and_Limitations.md) | Conclusion / future work; prototype modules; known limitations; demo accounts |

## How to use

1. Open each `.md` file in Word (Paste Special → Keep formatting) or use Pandoc to convert to `.docx`.
2. Mermaid diagrams in Chapter 4 can be rendered at [mermaid.live](https://mermaid.live) and inserted as figures.
3. Adapt heading numbers to match your faculty template (e.g. 3.1, 3.2).
4. Add screenshots from the running application for Results chapters.

## System summary

**BuildWise** is a Django + React construction project control system with role-based access for a Rwandan company organogram (Managing Director through site foreman), integrated project planning, budget, procurement, workforce, reports, and approval workflows.

**Repository:** `BuildWise/` (backend + frontend)

**Seed users:** `backend/seed_users.py` — password `password123`
