# Gantarr

A small microsaas that allows PM's and EM's to create gant charts to track various work streams and their time estimates.
Should be ultra flexible but simple to use.

## Key features
1. Group work items into work streams with labels (that appear on the left)
2. Export to PDF or PNG
3. Save a unique file to restore later - like a yml or some kind of json that can then be loaded
4. Drag and drop workstream items across dates
5. Works in browser, hosts as a single docker container. Technology choice of Tanstack Start + Vite, Loco.rs or Django - dealers choice
6. Open source.
7. Map dependencies with arrows between various work items
8. Colour code the work items with a custom legend - for example they might want green as "Business Change", orange as "Marketing" etc.
9. Create work items that span from X date and to another date.
10. View as individual working days as the X axis (at the top), or as working weeks per month.
